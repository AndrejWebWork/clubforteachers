import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { documents as staticDocuments, resources as staticResources, trainings as staticTrainings } from "../src/data.js";
import { isBlockedUpload } from "./shield.mjs";

const invitationText = `Почитувани,

Ве покануваме да се приклучите на Клубот на наставници. Ова е заедница за идеи, ресурси, обуки и професионална поддршка меѓу наставници.

Отворете ја платформата и најавете се со сметката што ќе ви ја отвори раководителот на клубот.

Со почит,
Клуб на наставници`;

function fileId(prefix) {
  return `${prefix}-${randomBytes(6).toString("hex")}`;
}

function saveUpload(uploadDir, name, data) {
  const clean = path.basename(String(name || "datoteka")).replace(/[^\w.\- ()\u0400-\u04FF]+/g, "") || "datoteka";
  if (isBlockedUpload(clean)) return { error: "Овој вид датотека не е дозволен." };
  const raw = String(data || "");
  const base64 = raw.includes(",") ? raw.split(",").pop() : raw;
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) return { error: "Датотеката мора да биде до 8 MB." };
  const stored = `${fileId("f")}-${clean.replace(/\s+/g, "-")}`;
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  writeFileSync(path.join(uploadDir, stored), buffer);
  return { url: `/uploads/${stored}`, size: buffer.length, name: clean };
}

export async function ensureLearning(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trainings (
      id text PRIMARY KEY,
      title text NOT NULL,
      category text NOT NULL,
      description text NOT NULL,
      duration text NOT NULL,
      format text NOT NULL,
      level text NOT NULL,
      status text NOT NULL,
      image text NOT NULL DEFAULT 'webinar',
      video_url text NOT NULL DEFAULT '',
      duration_seconds numeric,
      created_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS training_questions (
      id text PRIMARY KEY,
      training_id text NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
      prompt text NOT NULL,
      options jsonb NOT NULL,
      correct_index integer NOT NULL,
      position integer NOT NULL
    );
    CREATE TABLE IF NOT EXISTS training_progress (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      training_id text NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
      position_seconds numeric NOT NULL DEFAULT 0,
      furthest_seconds numeric NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL,
      PRIMARY KEY (user_id, training_id)
    );
    CREATE TABLE IF NOT EXISTS certificates (
      id text PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      training_id text NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
      holder_name text NOT NULL,
      issued_at timestamptz NOT NULL,
      UNIQUE (user_id, training_id)
    );
    CREATE TABLE IF NOT EXISTS library_items (
      id text PRIMARY KEY,
      kind text NOT NULL,
      title text NOT NULL,
      category text NOT NULL,
      type text NOT NULL,
      author text NOT NULL,
      detail text NOT NULL,
      folder text NOT NULL DEFAULT '',
      file_url text NOT NULL DEFAULT '',
      size_label text NOT NULL DEFAULT '',
      featured boolean NOT NULL DEFAULT false,
      downloads integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS download_counts (
      kind text NOT NULL,
      item_id text NOT NULL,
      downloads integer NOT NULL DEFAULT 0,
      PRIMARY KEY (kind, item_id)
    );
    CREATE TABLE IF NOT EXISTS invitations (
      id text PRIMARY KEY,
      from_name text NOT NULL,
      to_email text NOT NULL,
      body text NOT NULL,
      sent_at timestamptz NOT NULL
    );
  `);

  const trainingCount = await pool.query("SELECT COUNT(*)::int AS count FROM trainings");
  if (trainingCount.rows[0].count === 0) {
    for (const item of staticTrainings) {
      await pool.query(
        `INSERT INTO trainings (id, title, category, description, duration, format, level, status, image, video_url, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'', NOW())`,
        [item.id, item.title, item.category, item.description, item.duration, item.format, item.level, item.status, item.image],
      );
    }
  }

  const docs = await pool.query("SELECT COUNT(*)::int AS count FROM library_items WHERE kind = 'document'");
  if (docs.rows[0].count === 0) {
    for (const [index, item] of staticDocuments.entries()) {
      await pool.query(
        `INSERT INTO library_items (id, kind, title, category, type, author, detail, folder, size_label, featured, downloads, created_at)
         VALUES ($1,'document',$2,$3,$4,'Клуб на наставници',$5,$6,$7,$8,0, NOW() - ($9 || ' days')::interval)`,
        [`dok-${index + 1}`, item.title, item.folder, item.type, item.title, item.folder, item.size, Boolean(item.featured), String(index)],
      );
    }
  }
}

function mapTraining(row, questions, progress, certificate, isAdmin) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    duration: row.duration,
    format: row.format,
    level: row.level,
    status: row.status,
    image: row.image,
    videoUrl: row.video_url,
    durationSeconds: row.duration_seconds ? Number(row.duration_seconds) : 0,
    questions: questions.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      options: item.options,
      ...(isAdmin ? { correctIndex: item.correct_index } : {}),
    })),
    progress: progress
      ? { position: Number(progress.position_seconds), furthest: Number(progress.furthest_seconds) }
      : { position: 0, furthest: 0 },
    certified: Boolean(certificate),
  };
}

async function questionsFor(pool, trainingId) {
  const { rows } = await pool.query("SELECT * FROM training_questions WHERE training_id = $1 ORDER BY position, id", [trainingId]);
  return rows;
}

async function bumpDownload(pool, kind, itemId, actor, recordHit, foldGuest = "") {
  const downloads = await recordHit(`${kind}-download`, itemId, actor, foldGuest);
  await pool.query(
    `INSERT INTO download_counts (kind, item_id, downloads) VALUES ($1,$2,$3)
     ON CONFLICT (kind, item_id) DO UPDATE SET downloads = EXCLUDED.downloads`,
    [kind, itemId, downloads],
  );
  await pool.query("UPDATE library_items SET downloads = $3 WHERE id = $1 AND kind = $2", [itemId, kind, downloads]);
  return downloads;
}

export async function handleLearning({ pool, method, url, req, body, requireUser, requireAdmin, text, uploadDir, actorFrom, recordHit }) {
  if (method === "GET" && url === "/api/resources") {
    const counts = await pool.query("SELECT item_id, downloads FROM download_counts WHERE kind = 'resource'");
    const tally = new Map(counts.rows.map((row) => [row.item_id, row.downloads]));
    const uploaded = await pool.query("SELECT * FROM library_items WHERE kind = 'resource' ORDER BY created_at DESC");
    const items = [
      ...staticResources.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        kind: item.kind,
        source: item.source,
        type: item.type,
        author: item.author,
        detail: item.detail,
        date: item.date,
        fileUrl: "",
        downloads: tally.get(item.id) || 0,
      })),
      ...uploaded.rows.map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        type: row.type,
        author: row.author,
        detail: row.detail,
        date: "денес",
        fileUrl: row.file_url,
        downloads: row.downloads,
      })),
    ].sort((a, b) => b.downloads - a.downloads || a.title.localeCompare(b.title, "mk"));
    return { status: 200, body: { resources: items } };
  }

  if (method === "POST" && url === "/api/resources") {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const title = text(body.title, 140);
    const category = text(body.category, 80) || "Материјали";
    const type = text(body.type, 12) || "PDF";
    const detail = text(body.detail, 2000);
    if (!title) return { status: 400, body: { error: "Насловот е задолжителен." } };
    let fileUrl = "";
    if (body.data) {
      const saved = saveUpload(uploadDir, body.name || `${title}.${type.toLowerCase()}`, body.data);
      if (saved.error) return { status: 400, body: { error: saved.error } };
      fileUrl = saved.url;
    }
    const itemId = fileId("res");
    await pool.query(
      `INSERT INTO library_items (id, kind, title, category, type, author, detail, file_url, size_label, created_at)
       VALUES ($1,'resource',$2,$3,$4,$5,$6,$7,'', NOW())`,
      [itemId, title, category, type, auth.user.name, detail || title, fileUrl],
    );
    return { status: 201, body: { resource: { id: itemId, title, category, type, author: auth.user.name, detail, fileUrl, downloads: 0, date: "денес" } } };
  }

  const resourceDownload = url.match(/^\/api\/resources\/([^/]+)\/download$/);
  if (method === "POST" && resourceDownload) {
    const { actor, user, guest } = await actorFrom(req, body);
    const downloads = await bumpDownload(pool, "resource", resourceDownload[1], actor, recordHit, user ? guest : "");
    return { status: 200, body: { downloads } };
  }

  if (method === "GET" && url === "/api/documents") {
    const { rows } = await pool.query("SELECT * FROM library_items WHERE kind = 'document' ORDER BY created_at DESC");
    return {
      status: 200,
      body: {
        documents: rows.map((row) => ({
          id: row.id,
          title: row.title,
          type: row.type,
          folder: row.folder,
          size: row.size_label,
          date: new Date(row.created_at).toLocaleDateString("mk-MK"),
          featured: row.featured,
          body: row.detail,
          fileUrl: row.file_url,
          downloads: row.downloads,
        })),
      },
    };
  }

  if (method === "POST" && url === "/api/documents") {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const title = text(body.title, 140);
    const type = text(body.type, 12) || "PDF";
    const folder = text(body.folder, 80) || "Други документи";
    const detail = text(body.body, 2000);
    if (!title) return { status: 400, body: { error: "Насловот е задолжителен." } };
    let fileUrl = "";
    let sizeLabel = "12 KB";
    if (body.data) {
      const saved = saveUpload(uploadDir, body.name || title, body.data);
      if (saved.error) return { status: 400, body: { error: saved.error } };
      fileUrl = saved.url;
      sizeLabel = saved.size > 1024 * 1024 ? `${(saved.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(saved.size / 1024))} KB`;
    }
    const itemId = fileId("dok");
    await pool.query(
      `INSERT INTO library_items (id, kind, title, category, type, author, detail, folder, file_url, size_label, created_at)
       VALUES ($1,'document',$2,$3,$4,$5,$6,$7,$8,$9, NOW())`,
      [itemId, title, folder, type, auth.user.name, detail || title, folder, fileUrl, sizeLabel],
    );
    return { status: 201, body: { document: { id: itemId, title, type, folder, size: sizeLabel, date: "денес", featured: false, body: detail, fileUrl, downloads: 0 } } };
  }

  const documentDownload = url.match(/^\/api\/documents\/([^/]+)\/download$/);
  if (method === "POST" && documentDownload) {
    const { actor, user, guest } = await actorFrom(req, body);
    const downloads = await bumpDownload(pool, "document", documentDownload[1], actor, recordHit, user ? guest : "");
    return { status: 200, body: { downloads } };
  }

  if (method === "GET" && url === "/api/trainings") {
    const { rows } = await pool.query("SELECT id, title, category, description, duration, format, level, status, image, video_url FROM trainings ORDER BY created_at DESC");
    return {
      status: 200,
      body: {
        trainings: rows.map((row) => ({
          id: row.id,
          title: row.title,
          category: row.category,
          description: row.description,
          duration: row.duration,
          format: row.format,
          level: row.level,
          status: row.status,
          image: row.image,
          videoUrl: row.video_url,
        })),
      },
    };
  }

  if (method === "POST" && url === "/api/trainings") {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const title = text(body.title, 140);
    const description = text(body.description, 1000);
    if (!title) return { status: 400, body: { error: "Насловот е задолжителен." } };
    let videoUrl = text(body.videoUrl, 2000);
    if (body.data) {
      const saved = saveUpload(uploadDir, body.name || "obuka.mp4", body.data);
      if (saved.error) return { status: 400, body: { error: saved.error } };
      videoUrl = saved.url;
    }
    if (videoUrl && !videoUrl.startsWith("/uploads/") && !videoUrl.startsWith("/api/media/file/") && !/^https:\/\//.test(videoUrl)) {
      return { status: 400, body: { error: "Линкот мора да почнува со https://." } };
    }
    const trainingId = fileId("obuka");
    await pool.query(
      `INSERT INTO trainings (id, title, category, description, duration, format, level, status, image, video_url, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'project',$9, NOW())`,
      [
        trainingId,
        title,
        text(body.category, 80) || "Обука",
        description,
        text(body.duration, 40) || "1 час",
        text(body.format, 40) || "Онлајн",
        text(body.level, 40) || "Сите нивоа",
        text(body.status, 40) || "Отворена",
        videoUrl,
      ],
    );
    return { status: 201, body: { training: { id: trainingId, title, videoUrl } } };
  }

  const quizMatch = url.match(/^\/api\/trainings\/([^/]+)\/quiz$/);
  if (method === "PUT" && quizMatch) {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const found = await pool.query("SELECT id FROM trainings WHERE id = $1", [quizMatch[1]]);
    if (!found.rows[0]) return { status: 404, body: { error: "Обуката не е пронајдена." } };
    const questions = Array.isArray(body.questions) ? body.questions : [];
    const clean = [];
    for (const question of questions) {
      const prompt = text(question.prompt, 300);
      const options = Array.isArray(question.options) ? question.options.map((option) => text(option, 180)) : [];
      const correctIndex = Number(question.correctIndex);
      if (!prompt || options.length !== 4 || options.some((option) => !option) || correctIndex < 0 || correctIndex > 3) {
        return { status: 400, body: { error: "Секое прашање има текст и точно 4 одговори, со еден точен." } };
      }
      clean.push({ prompt, options, correctIndex });
    }
    await pool.query("DELETE FROM training_questions WHERE training_id = $1", [quizMatch[1]]);
    for (const [index, question] of clean.entries()) {
      await pool.query(
        "INSERT INTO training_questions (id, training_id, prompt, options, correct_index, position) VALUES ($1,$2,$3,$4::jsonb,$5,$6)",
        [fileId("q"), quizMatch[1], question.prompt, JSON.stringify(question.options), question.correctIndex, index],
      );
    }
    return { status: 200, body: { ok: true } };
  }

  if (method === "POST" && quizMatch) {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const training = await pool.query("SELECT * FROM trainings WHERE id = $1", [quizMatch[1]]);
    if (!training.rows[0]) return { status: 404, body: { error: "Обуката не е пронајдена." } };
    const progress = await pool.query("SELECT furthest_seconds FROM training_progress WHERE user_id = $1 AND training_id = $2", [auth.user.id, quizMatch[1]]);
    const furthest = Number(progress.rows[0]?.furthest_seconds || 0);
    const duration = Number(training.rows[0].duration_seconds || 0);
    const finished = training.rows[0].video_url ? duration > 0 && furthest >= duration - 3 : furthest >= 1;
    if (!finished) return { status: 400, body: { error: "Прво догледајте ја обуката. Прескокнување напред не е дозволено." } };
    const questions = await questionsFor(pool, quizMatch[1]);
    if (!questions.length) return { status: 400, body: { error: "За оваа обука сè уште нема тест." } };
    const answers = Array.isArray(body.answers) ? body.answers.map(Number) : [];
    const passed = questions.every((question, index) => answers[index] === question.correct_index);
    if (!passed) return { status: 200, body: { passed: false } };
    const existing = await pool.query("SELECT id, issued_at FROM certificates WHERE user_id = $1 AND training_id = $2", [auth.user.id, quizMatch[1]]);
    let certificateId = existing.rows[0]?.id;
    if (!certificateId) {
      certificateId = fileId("cert");
      await pool.query(
        "INSERT INTO certificates (id, user_id, training_id, holder_name, issued_at) VALUES ($1,$2,$3,$4, NOW())",
        [certificateId, auth.user.id, quizMatch[1], auth.user.name],
      );
    }
    return { status: 200, body: { passed: true, certificateId } };
  }

  const progressMatch = url.match(/^\/api\/trainings\/([^/]+)\/progress$/);
  if (method === "POST" && progressMatch) {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const training = await pool.query("SELECT video_url, duration_seconds FROM trainings WHERE id = $1", [progressMatch[1]]);
    if (!training.rows[0]) return { status: 404, body: { error: "Обуката не е пронајдена." } };
    const current = await pool.query("SELECT position_seconds, furthest_seconds, updated_at FROM training_progress WHERE user_id = $1 AND training_id = $2", [auth.user.id, progressMatch[1]]);
    const row = current.rows[0];
    const previous = Number(row?.furthest_seconds || 0);
    const gap = row ? Math.max(0, (Date.now() - new Date(row.updated_at).getTime()) / 1000) : 2;
    const watched = Math.min(Math.max(0, Number(body.watched) || 0), gap + 1.5);
    let furthest = previous + watched;
    if (!training.rows[0].video_url && body.completed) furthest = Math.max(furthest, 1);
    const position = Math.min(Math.max(0, Number(body.position) || 0), furthest);
    const duration = Number(body.duration);
    if (Number.isFinite(duration) && duration > 0) {
      await pool.query("UPDATE trainings SET duration_seconds = $1 WHERE id = $2 AND (duration_seconds IS NULL OR duration_seconds = 0)", [duration, progressMatch[1]]);
    }
    await pool.query(
      `INSERT INTO training_progress (user_id, training_id, position_seconds, furthest_seconds, updated_at)
       VALUES ($1,$2,$3,$4, NOW())
       ON CONFLICT (user_id, training_id) DO UPDATE SET position_seconds = $3, furthest_seconds = $4, updated_at = NOW()`,
      [auth.user.id, progressMatch[1], position, furthest],
    );
    return { status: 200, body: { position, furthest } };
  }

  const certificateMatch = url.match(/^\/api\/trainings\/([^/]+)\/certificate$/);
  if (method === "GET" && certificateMatch) {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const { rows } = await pool.query(
      `SELECT c.id, c.holder_name, c.issued_at, t.title
       FROM certificates c JOIN trainings t ON t.id = c.training_id
       WHERE c.user_id = $1 AND c.training_id = $2`,
      [auth.user.id, certificateMatch[1]],
    );
    if (!rows[0]) return { status: 404, body: { error: "Сертификатот се отклучува по точен тест." } };
    return {
      status: 200,
      body: {
        certificate: {
          id: rows[0].id,
          name: rows[0].holder_name,
          title: rows[0].title,
          issuedAt: rows[0].issued_at,
        },
      },
    };
  }

  const trainingMatch = url.match(/^\/api\/trainings\/([^/]+)$/);
  if (method === "GET" && trainingMatch) {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const { rows } = await pool.query("SELECT * FROM trainings WHERE id = $1", [trainingMatch[1]]);
    if (!rows[0]) return { status: 404, body: { error: "Обуката не е пронајдена." } };
    const questions = await questionsFor(pool, trainingMatch[1]);
    const progress = await pool.query("SELECT * FROM training_progress WHERE user_id = $1 AND training_id = $2", [auth.user.id, trainingMatch[1]]);
    const certificate = await pool.query("SELECT id FROM certificates WHERE user_id = $1 AND training_id = $2", [auth.user.id, trainingMatch[1]]);
    const isAdmin = auth.user.role === "admin";
    return { status: 200, body: { training: mapTraining(rows[0], questions, progress.rows[0], certificate.rows[0], isAdmin) } };
  }

  if (method === "PATCH" && trainingMatch) {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const title = text(body.title, 140);
    if (!title) return { status: 400, body: { error: "Насловот е задолжителен." } };
    let videoUrl = text(body.videoUrl, 2000);
    if (body.data) {
      const saved = saveUpload(uploadDir, body.name || "obuka.mp4", body.data);
      if (saved.error) return { status: 400, body: { error: saved.error } };
      videoUrl = saved.url;
    }
    await pool.query(
      `UPDATE trainings SET title = $1, category = $2, description = $3, duration = $4, format = $5, level = $6, status = $7,
        video_url = CASE WHEN $8 = '' THEN video_url ELSE $8 END
       WHERE id = $9`,
      [
        title,
        text(body.category, 80),
        text(body.description, 1000),
        text(body.duration, 40),
        text(body.format, 40),
        text(body.level, 40),
        text(body.status, 40) || "Отворена",
        videoUrl,
        trainingMatch[1],
      ],
    );
    return { status: 200, body: { ok: true } };
  }

  if (method === "POST" && url === "/api/invitations") {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const email = text(body.email, 120).toLowerCase();
    if (!email.includes("@")) return { status: 400, body: { error: "Внесете валидна е-пошта." } };
    await pool.query("INSERT INTO invitations (id, from_name, to_email, body, sent_at) VALUES ($1,$2,$3,$4, NOW())", [
      fileId("inv"),
      auth.user.name,
      email,
      invitationText,
    ]);
    return {
      status: 201,
      body: {
        invitation: {
          to: email,
          subject: "Покана за Клубот на наставници",
          body: invitationText,
        },
      },
    };
  }

  return null;
}
