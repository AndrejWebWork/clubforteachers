import { randomBytes } from "node:crypto";
import path from "node:path";
import { documents as staticDocuments, resources as staticResources, trainings as staticTrainings } from "../src/data.js";
import { dropStored, persistBytes } from "./mediaStore.mjs";
import { isBlockedUpload } from "./shield.mjs";

const invitationSubject = "Покана за Клубот на наставници";

function invitationText(fromName) {
  const who = fromName ? `${fromName} ве поканува` : "Ве покануваме";
  return `Почитувани,

${who} да се приклучите на Клубот на наставници.

Клубот е заедница за идеи, ресурси, обуки и професионална поддршка меѓу наставници. Тука се споделуваат материјали, се следат обуки и се разменуваат искуства од училницата.

Отворете ја платформата: https://clubforteachers.vercel.app
Најавете се со сметката што ќе ви ја отвори раководителот на клубот.

Со почит,
Клуб на наставници`;
}

function fileId(prefix) {
  return `${prefix}-${randomBytes(6).toString("hex")}`;
}

function storedLink(value) {
  const match = String(value || "").match(/^\/api\/media\/file\/([^/?]+)$/);
  if (!match) return "";
  try {
    const key = decodeURIComponent(match[1]);
    if (!/^files\/[\w.\-]+$/.test(key)) return "";
    return `/api/media/file/${encodeURIComponent(key)}`;
  } catch {
    return "";
  }
}

async function saveUpload(uploadDir, name, data, root) {
  const clean = path.basename(String(name || "datoteka")).replace(/[^\w.\- ()\u0400-\u04FF]+/g, "") || "datoteka";
  if (isBlockedUpload(clean)) return { error: "Овој вид датотека не е дозволен." };
  const raw = String(data || "");
  const base64 = raw.includes(",") ? raw.split(",").pop() : raw;
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) return { error: "Датотеката мора да биде до 8 MB." };
  return persistBytes({ root, uploadDir, name: clean, buffer });
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
      module_no integer NOT NULL DEFAULT 1,
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
    CREATE TABLE IF NOT EXISTS training_passes (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      training_id text NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
      passed_at timestamptz NOT NULL,
      PRIMARY KEY (user_id, training_id)
    );
    CREATE TABLE IF NOT EXISTS training_evaluations (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      training_id text NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
      rating integer NOT NULL,
      comment text NOT NULL,
      created_at timestamptz NOT NULL,
      PRIMARY KEY (user_id, training_id)
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
    CREATE TABLE IF NOT EXISTS training_modules (
      id text PRIMARY KEY,
      training_id text NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
      position integer NOT NULL,
      title text NOT NULL,
      video_url text NOT NULL DEFAULT '',
      duration_seconds numeric NOT NULL DEFAULT 0,
      UNIQUE (training_id, position)
    );
    CREATE TABLE IF NOT EXISTS module_progress (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module_id text NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
      position_seconds numeric NOT NULL DEFAULT 0,
      furthest_seconds numeric NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL,
      PRIMARY KEY (user_id, module_id)
    );
    CREATE TABLE IF NOT EXISTS masterclasses (
      id text PRIMARY KEY,
      title text NOT NULL,
      description text NOT NULL,
      starts_at timestamptz NOT NULL,
      minutes integer NOT NULL,
      join_info text NOT NULL,
      created_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS masterclass_evaluations (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      masterclass_id text NOT NULL REFERENCES masterclasses(id) ON DELETE CASCADE,
      rating integer NOT NULL,
      comment text NOT NULL,
      created_at timestamptz NOT NULL,
      PRIMARY KEY (user_id, masterclass_id)
    );
    CREATE TABLE IF NOT EXISTS hidden_items (
      kind text NOT NULL,
      item_id text NOT NULL,
      PRIMARY KEY (kind, item_id)
    );
  `);
  await pool.query("ALTER TABLE trainings ADD COLUMN IF NOT EXISTS module_no integer NOT NULL DEFAULT 1");

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

  const retiredTitles = [
    "Годишна програма за работа",
    "Шаблон за подготовка на час",
    "Водич за формативно оценување",
    "Евиденција за проектни активности",
    "Согласност за учество на настан",
    "Програма за менторска поддршка",
  ];
  await pool.query("DELETE FROM library_items WHERE kind = 'document' AND title = ANY($1::text[])", [retiredTitles]);
  for (const [index, item] of staticDocuments.entries()) {
    const found = await pool.query("SELECT id FROM library_items WHERE kind = 'document' AND title = $1", [item.title]);
    if (found.rowCount) continue;
    await pool.query(
      `INSERT INTO library_items (id, kind, title, category, type, author, detail, folder, size_label, featured, downloads, created_at)
       VALUES ($1,'document',$2,$3,$4,'Клуб на наставници',$5,$6,$7,false,0, NOW() - ($8 || ' days')::interval)`,
      [`dok-club-${index + 1}`, item.title, item.folder, item.type, item.body || item.title, item.folder, item.size, String(index)],
    );
  }
  await ensureModules(pool);
}

async function ensureModules(pool) {
  const { rows } = await pool.query("SELECT id, video_url FROM trainings");
  for (const row of rows) {
    const count = await pool.query("SELECT COUNT(*)::int AS count FROM training_modules WHERE training_id = $1", [row.id]);
    if (count.rows[0].count > 0) continue;
    await pool.query(
      "INSERT INTO training_modules (id, training_id, position, title, video_url) VALUES ($1,$2,1,'Модул 1',$3), ($4,$2,2,'Модул 2','')",
      [fileId("mod"), row.id, row.video_url || "", fileId("mod")],
    );
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
    module: Number(row.module_no) === 2 ? 2 : 1,
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

function moduleNumber(value) {
  return Number(value) === 2 ? 2 : 1;
}

async function videosReady(pool, userId, trainingId) {
  const { rows } = await pool.query(
    `SELECT m.duration_seconds, COALESCE(p.furthest_seconds, 0) AS furthest
     FROM training_modules m
     LEFT JOIN module_progress p ON p.module_id = m.id AND p.user_id = $1
     WHERE m.training_id = $2 AND m.video_url <> ''`,
    [userId, trainingId],
  );
  if (!rows.length) {
    const progress = await pool.query("SELECT furthest_seconds FROM training_progress WHERE user_id = $1 AND training_id = $2", [userId, trainingId]);
    return Number(progress.rows[0]?.furthest_seconds || 0) >= 1;
  }
  return rows.every((row) => Number(row.duration_seconds) > 0 && Number(row.furthest) >= Number(row.duration_seconds) - 3);
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

export async function listResources(pool) {
  const [counts, hidden, uploaded] = await Promise.all([
    pool.query("SELECT item_id, downloads FROM download_counts WHERE kind = 'resource'"),
    pool.query("SELECT item_id FROM hidden_items WHERE kind = 'resource'"),
    pool.query("SELECT * FROM library_items WHERE kind = 'resource' ORDER BY created_at DESC"),
  ]);
  const tally = new Map(counts.rows.map((row) => [row.item_id, row.downloads]));
  const hiddenIds = new Set(hidden.rows.map((row) => row.item_id));
  return [
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
  ].filter((item) => !hiddenIds.has(item.id)).sort((a, b) => b.downloads - a.downloads || a.title.localeCompare(b.title, "mk"));
}

export async function listDocuments(pool) {
  const { rows } = await pool.query("SELECT * FROM library_items WHERE kind = 'document' ORDER BY created_at DESC");
  return rows.map((row) => ({
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
  }));
}

export async function listTrainings(pool, userId) {
  const { rows } = await pool.query(
    `SELECT id, title, category, description, duration, format, level, status, image, video_url, module_no,
      (SELECT COUNT(*)::int FROM training_modules m WHERE m.training_id = trainings.id) AS module_count,
      CASE WHEN $1::uuid IS NULL THEN false ELSE EXISTS (
        SELECT 1 FROM certificates c WHERE c.training_id = trainings.id AND c.user_id = $1::uuid
      ) END AS certified
     FROM trainings ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map((row) => ({
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
    module: moduleNumber(row.module_no),
    moduleCount: Number(row.module_count) || 2,
    certified: Boolean(row.certified),
  }));
}

export async function listMasterclasses(pool, user) {
  const unlocked = user.role === "admin" || user.membership === "polno";
  const { rows } = await pool.query(
    `SELECT m.*, EXISTS (
       SELECT 1 FROM masterclass_evaluations e WHERE e.masterclass_id = m.id AND e.user_id = $1
     ) AS evaluated
     FROM masterclasses m ORDER BY m.starts_at`,
    [user.id],
  );
  return {
    unlocked,
    masterclasses: rows.map((row) => ({
      id: row.id,
      title: row.title,
      startsAt: row.starts_at,
      minutes: row.minutes,
      locked: !unlocked,
      ...(unlocked ? { description: row.description, joinInfo: row.join_info, evaluated: Boolean(row.evaluated) } : {}),
    })),
  };
}

export async function handleLearning({ pool, method, url, req, body, requireUser, requireAdmin, text, uploadDir, root, actorFrom, recordHit }) {
  if (method === "GET" && url === "/api/resources") {
    return { status: 200, body: { resources: await listResources(pool) } };
  }

  if (method === "POST" && url === "/api/resources") {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const title = text(body.title, 140);
    const category = text(body.category, 80) || "Материјали";
    const type = text(body.type, 12) || "PDF";
    const detail = text(body.detail, 2000);
    if (!title) return { status: 400, body: { error: "Насловот е задолжителен." } };
    let fileUrl = storedLink(body.url);
    if (!fileUrl && body.data) {
      const saved = await saveUpload(uploadDir, body.name || `${title}.${type.toLowerCase()}`, body.data, root);
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

  const resourceItem = url.match(/^\/api\/resources\/([^/]+)$/);
  if (method === "DELETE" && resourceItem) {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const existing = await pool.query("SELECT file_url FROM library_items WHERE id = $1 AND kind = 'resource'", [resourceItem[1]]);
    if (!existing.rowCount) {
      await pool.query("INSERT INTO hidden_items (kind, item_id) VALUES ('resource', $1) ON CONFLICT DO NOTHING", [resourceItem[1]]);
      return { status: 200, body: { ok: true } };
    }
    await dropStored(root, uploadDir, existing.rows[0].file_url);
    await pool.query("DELETE FROM library_items WHERE id = $1 AND kind = 'resource'", [resourceItem[1]]);
    return { status: 200, body: { ok: true } };
  }

  const resourceDownload = url.match(/^\/api\/resources\/([^/]+)\/download$/);
  if (method === "POST" && resourceDownload) {
    const { actor, user, guest } = await actorFrom(req, body);
    const downloads = await bumpDownload(pool, "resource", resourceDownload[1], actor, recordHit, user ? guest : "");
    return { status: 200, body: { downloads } };
  }

  if (method === "GET" && url === "/api/documents") {
    return { status: 200, body: { documents: await listDocuments(pool) } };
  }

  if (method === "POST" && url === "/api/documents") {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const title = text(body.title, 140);
    const type = text(body.type, 12) || "PDF";
    const folder = text(body.folder, 80) || "Други документи";
    const detail = text(body.body, 2000);
    if (!title) return { status: 400, body: { error: "Насловот е задолжителен." } };
    let fileUrl = storedLink(body.url);
    let sizeLabel = body.size ? (Number(body.size) > 1024 * 1024 ? `${(Number(body.size) / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(Number(body.size) / 1024))} KB`) : "12 KB";
    if (!fileUrl && body.data) {
      const saved = await saveUpload(uploadDir, body.name || title, body.data, root);
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
    const auth = await requireUser(req);
    const userId = auth.error ? null : auth.user.id;
    return { status: 200, body: { trainings: await listTrainings(pool, userId) } };
  }

  if (method === "POST" && url === "/api/trainings") {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const title = text(body.title, 140);
    const description = text(body.description, 1000);
    if (!title) return { status: 400, body: { error: "Насловот е задолжителен." } };
    let videoUrl = text(body.videoUrl, 2000);
    if (body.data) {
      const saved = await saveUpload(uploadDir, body.name || "obuka.mp4", body.data, root);
      if (saved.error) return { status: 400, body: { error: saved.error } };
      videoUrl = saved.url;
    }
    if (videoUrl && !videoUrl.startsWith("/uploads/") && !videoUrl.startsWith("/api/media/file/") && !/^https:\/\//.test(videoUrl)) {
      return { status: 400, body: { error: "Линкот мора да почнува со https://." } };
    }
    const trainingId = fileId("obuka");
    await pool.query(
      `INSERT INTO trainings (id, title, category, description, duration, format, level, status, image, video_url, module_no, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'project',$9,$10, NOW())`,
      [
        trainingId,
        title,
        text(body.category, 80) || "Обука",
        description,
        text(body.duration, 40) || "1 час и 30 минути",
        text(body.format, 40) || "Онлајн",
        text(body.level, 40) || "Сите нивоа",
        text(body.status, 40) || "Отворена",
        videoUrl,
        moduleNumber(body.module),
      ],
    );
    await ensureModules(pool);
    if (videoUrl) await pool.query("UPDATE training_modules SET video_url = $1 WHERE training_id = $2 AND position = 1", [videoUrl, trainingId]);
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
    if (!(await videosReady(pool, auth.user.id, quizMatch[1]))) {
      return { status: 400, body: { error: "Тестот се отвора откако ќе ги изгледате видеата од модулите." } };
    }
    const questions = await questionsFor(pool, quizMatch[1]);
    if (!questions.length) return { status: 400, body: { error: "За оваа обука сè уште нема тест." } };
    const answers = Array.isArray(body.answers) ? body.answers.map(Number) : [];
    const passed = questions.every((question, index) => answers[index] === question.correct_index);
    if (!passed) return { status: 200, body: { passed: false } };
    await pool.query(
      `INSERT INTO training_passes (user_id, training_id, passed_at) VALUES ($1,$2, NOW())
       ON CONFLICT (user_id, training_id) DO NOTHING`,
      [auth.user.id, quizMatch[1]],
    );
    const existing = await pool.query("SELECT id FROM certificates WHERE user_id = $1 AND training_id = $2", [auth.user.id, quizMatch[1]]);
    if (existing.rows[0]) return { status: 200, body: { passed: true, certificateId: existing.rows[0].id } };
    return { status: 200, body: { passed: true, needsEvaluation: true } };
  }

  const evaluationMatch = url.match(/^\/api\/trainings\/([^/]+)\/evaluation$/);
  if (method === "POST" && evaluationMatch) {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const rating = Number(body.rating);
    const comment = text(body.comment, 2000);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { status: 400, body: { error: "Оценката е од 1 до 5." } };
    if (!comment) return { status: 400, body: { error: "Напишете кратка евалуација." } };
    const passed = await pool.query("SELECT 1 FROM training_passes WHERE user_id = $1 AND training_id = $2", [auth.user.id, evaluationMatch[1]]);
    const already = await pool.query("SELECT id FROM certificates WHERE user_id = $1 AND training_id = $2", [auth.user.id, evaluationMatch[1]]);
    if (!passed.rowCount && !already.rowCount) return { status: 400, body: { error: "Прво положете го тестот на обуката." } };
    await pool.query(
      `INSERT INTO training_evaluations (user_id, training_id, rating, comment, created_at) VALUES ($1,$2,$3,$4, NOW())
       ON CONFLICT (user_id, training_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = NOW()`,
      [auth.user.id, evaluationMatch[1], rating, comment],
    );
    let certificateId = already.rows[0]?.id;
    if (!certificateId) {
      certificateId = fileId("cert");
      await pool.query(
        "INSERT INTO certificates (id, user_id, training_id, holder_name, issued_at) VALUES ($1,$2,$3,$4, NOW())",
        [certificateId, auth.user.id, evaluationMatch[1], auth.user.name],
      );
    }
    return { status: 200, body: { certificateId } };
  }

  const progressMatch = url.match(/^\/api\/trainings\/([^/]+)\/progress$/);
  if (method === "POST" && progressMatch) {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const training = await pool.query("SELECT video_url, duration_seconds FROM trainings WHERE id = $1", [progressMatch[1]]);
    if (!training.rows[0]) return { status: 404, body: { error: "Обуката не е пронајдена." } };
    if (body.moduleId) {
      const moduleRow = await pool.query("SELECT id, video_url, duration_seconds FROM training_modules WHERE id = $1 AND training_id = $2", [text(body.moduleId, 40), progressMatch[1]]);
      if (!moduleRow.rows[0]) return { status: 404, body: { error: "Модулот не е пронајден." } };
      const currentModule = await pool.query("SELECT position_seconds, furthest_seconds, updated_at FROM module_progress WHERE user_id = $1 AND module_id = $2", [auth.user.id, moduleRow.rows[0].id]);
      const saved = currentModule.rows[0];
      const previous = Number(saved?.furthest_seconds || 0);
      const gap = saved ? Math.max(0, (Date.now() - new Date(saved.updated_at).getTime()) / 1000) : 2;
      const watched = Math.min(Math.max(0, Number(body.watched) || 0), gap + 1.5);
      let furthest = previous + watched;
      if (!moduleRow.rows[0].video_url && body.completed) furthest = Math.max(furthest, 1);
      const position = Math.min(Math.max(0, Number(body.position) || 0), furthest);
      const duration = Number(body.duration);
      if (Number.isFinite(duration) && duration > 0) {
        await pool.query("UPDATE training_modules SET duration_seconds = $1 WHERE id = $2 AND duration_seconds = 0", [duration, moduleRow.rows[0].id]);
      }
      await pool.query(
        `INSERT INTO module_progress (user_id, module_id, position_seconds, furthest_seconds, updated_at)
         VALUES ($1,$2,$3,$4, NOW())
         ON CONFLICT (user_id, module_id) DO UPDATE SET position_seconds = $3, furthest_seconds = $4, updated_at = NOW()`,
        [auth.user.id, moduleRow.rows[0].id, position, furthest],
      );
      const ready = await videosReady(pool, auth.user.id, progressMatch[1]);
      return { status: 200, body: { position, furthest, modulesReady: ready } };
    }
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
    const modules = await pool.query(
      `SELECT m.id, m.position, m.title, m.video_url, m.duration_seconds,
        COALESCE(p.position_seconds, 0) AS position_seconds, COALESCE(p.furthest_seconds, 0) AS furthest_seconds
       FROM training_modules m
       LEFT JOIN module_progress p ON p.module_id = m.id AND p.user_id = $2
       WHERE m.training_id = $1 ORDER BY m.position`,
      [trainingMatch[1], auth.user.id],
    );
    const isAdmin = auth.user.role === "admin";
    const training = mapTraining(rows[0], questions, progress.rows[0], certificate.rows[0], isAdmin);
    training.modules = modules.rows.map((item) => ({
      id: item.id,
      position: Number(item.position),
      title: item.title,
      videoUrl: item.video_url,
      durationSeconds: Number(item.duration_seconds) || 0,
      progress: { position: Number(item.position_seconds), furthest: Number(item.furthest_seconds) },
    }));
    training.moduleCount = training.modules.length || 2;
    training.modulesReady = await videosReady(pool, auth.user.id, trainingMatch[1]);
    return { status: 200, body: { training } };
  }

  if (method === "DELETE" && trainingMatch) {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const existing = await pool.query("SELECT video_url FROM trainings WHERE id = $1", [trainingMatch[1]]);
    if (!existing.rows[0]) return { status: 404, body: { error: "Обуката не е пронајдена." } };
    await dropStored(root, uploadDir, existing.rows[0].video_url);
    await pool.query("DELETE FROM trainings WHERE id = $1", [trainingMatch[1]]);
    return { status: 200, body: { ok: true } };
  }

  if (method === "PATCH" && trainingMatch) {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    if (body.module && !body.title) {
      const updated = await pool.query("UPDATE trainings SET module_no = $1 WHERE id = $2", [moduleNumber(body.module), trainingMatch[1]]);
      if (!updated.rowCount) return { status: 404, body: { error: "Обуката не е пронајдена." } };
      return { status: 200, body: { ok: true } };
    }
    const title = text(body.title, 140);
    if (!title) return { status: 400, body: { error: "Насловот е задолжителен." } };
    let videoUrl = text(body.videoUrl, 2000);
    if (body.data) {
      const saved = await saveUpload(uploadDir, body.name || "obuka.mp4", body.data, root);
      if (saved.error) return { status: 400, body: { error: saved.error } };
      videoUrl = saved.url;
    }
    const modulePosition = Number(body.modulePosition) === 2 ? 2 : Number(body.modulePosition) === 1 ? 1 : 0;
    const mainVideo = modulePosition === 2 ? "" : videoUrl;
    await pool.query(
      `UPDATE trainings SET title = $1, category = $2, description = $3, duration = $4, format = $5, level = $6, status = $7,
        video_url = CASE WHEN $8 = '' THEN video_url ELSE $8 END,
        module_no = CASE WHEN $10 = 0 THEN module_no ELSE $10 END
       WHERE id = $9`,
      [
        title,
        text(body.category, 80),
        text(body.description, 1000),
        text(body.duration, 40),
        text(body.format, 40),
        text(body.level, 40),
        text(body.status, 40) || "Отворена",
        mainVideo,
        trainingMatch[1],
        body.module ? moduleNumber(body.module) : 0,
      ],
    );
    if (videoUrl && modulePosition) {
      await ensureModules(pool);
      await pool.query("UPDATE training_modules SET video_url = $1 WHERE training_id = $2 AND position = $3", [videoUrl, trainingMatch[1], modulePosition]);
    }
    return { status: 200, body: { ok: true } };
  }

  if (method === "POST" && url === "/api/invitations") {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const email = text(body.email, 120).toLowerCase();
    if (!email.includes("@")) return { status: 400, body: { error: "Внесете валидна е-пошта." } };
    const letter = invitationText(auth.user.name);
    await pool.query("INSERT INTO invitations (id, from_name, to_email, body, sent_at) VALUES ($1,$2,$3,$4, NOW())", [
      fileId("inv"),
      auth.user.name,
      email,
      letter,
    ]);
    return {
      status: 201,
      body: {
        invitation: {
          to: email,
          subject: invitationSubject,
          body: letter,
        },
      },
    };
  }

  if (method === "GET" && url === "/api/masterclasses") {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    return { status: 200, body: await listMasterclasses(pool, auth.user) };
  }

  if (method === "POST" && url === "/api/masterclasses") {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const title = text(body.title, 140);
    const description = text(body.description, 2000);
    const joinInfo = text(body.joinInfo, 1000);
    const minutes = Number(body.minutes);
    const startsAt = new Date(body.startsAt);
    if (!title || !description || !joinInfo) return { status: 400, body: { error: "Насловот, описот и информациите за вклучување се задолжителни." } };
    if (!Number.isInteger(minutes) || minutes < 1) return { status: 400, body: { error: "Внесете траење во минути." } };
    if (Number.isNaN(startsAt.getTime())) return { status: 400, body: { error: "Внесете датум и време." } };
    const masterId = fileId("mk");
    await pool.query(
      "INSERT INTO masterclasses (id, title, description, starts_at, minutes, join_info, created_at) VALUES ($1,$2,$3,$4,$5,$6, NOW())",
      [masterId, title, description, startsAt.toISOString(), minutes, joinInfo],
    );
    return { status: 201, body: { id: masterId } };
  }

  const masterMatch = url.match(/^\/api\/masterclasses\/([^/]+)$/);
  if (method === "DELETE" && masterMatch) {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    await pool.query("DELETE FROM masterclasses WHERE id = $1", [masterMatch[1]]);
    return { status: 200, body: { ok: true } };
  }

  const masterEval = url.match(/^\/api\/masterclasses\/([^/]+)\/evaluation$/);
  if (method === "POST" && masterEval) {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    if (auth.user.role !== "admin" && auth.user.membership !== "polno") {
      return { status: 403, body: { error: "Мастеркласот е достапен со полно членство." } };
    }
    const rating = Number(body.rating);
    const comment = text(body.comment, 2000);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment) {
      return { status: 400, body: { error: "Оценката е од 1 до 5 и евалуацијата е задолжителна." } };
    }
    const found = await pool.query("SELECT id FROM masterclasses WHERE id = $1", [masterEval[1]]);
    if (!found.rowCount) return { status: 404, body: { error: "Мастеркласот не е пронајден." } };
    await pool.query(
      `INSERT INTO masterclass_evaluations (user_id, masterclass_id, rating, comment, created_at) VALUES ($1,$2,$3,$4, NOW())
       ON CONFLICT (user_id, masterclass_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = NOW()`,
      [auth.user.id, masterEval[1], rating, comment],
    );
    return { status: 200, body: { ok: true } };
  }

  return null;
}
