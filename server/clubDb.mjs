import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import {
  applySecurityHeaders,
  clearSessionCookie,
  guardUpload,
  loginLimited,
  noteLogin,
  readSessionCookie,
  sessionCookie,
  uploadHeaders,
} from "./shield.mjs";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploadDir = path.join(root, "public", "uploads");

const categories = [
  "Методика и пракса",
  "Идеи од училишта",
  "Прашања",
  "Добра практика",
  "Технологија",
  "Професионален развој",
];

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return "";
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith("DATABASE_URL="));
  if (!line) return "";
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "").replace(/([?&])channel_binding=[^&]*/g, "$1").replace(/[?&]$/, "");
}

let poolInstance;
function livePool() {
  if (poolInstance) return poolInstance;
  const connectionString = databaseUrl().replace(/([?&])channel_binding=[^&]*/g, "$1").replace(/[?&]$/, "");
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing. Add it to .env.");
  }
  poolInstance = new Pool({
    connectionString,
    max: 5,
    ssl: { rejectUnauthorized: false },
  });
  return poolInstance;
}

const pool = new Proxy({}, {
  get(_target, prop) {
    const real = livePool();
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

function hashPassword(salt, password) {
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function storePassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `sha256:${salt}:${hashPassword(salt, password)}`;
}

function digestMatches(stored, digest) {
  const [algo, , expected] = String(stored || "").split(":");
  if (algo !== "sha256" || !/^[a-f0-9]{64}$/i.test(digest) || !/^[a-f0-9]+$/i.test(expected)) return false;
  const actual = Buffer.from(digest, "hex");
  const target = Buffer.from(expected, "hex");
  return actual.length === target.length && timingSafeEqual(actual, target);
}

function loginSalt(email, stored) {
  const salt = String(stored || "").split(":")[1];
  if (salt) return salt;
  return createHash("sha256").update(`club-login:${email}`).digest("hex").slice(0, 32);
}

function id(prefix) {
  return `${prefix}-${randomBytes(6).toString("hex")}`;
}

function text(value, max) {
  return String(value || "").trim().slice(0, max);
}

function iso(value) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    school: user.school,
    location: user.location || "",
    areas: user.areas || "",
    bio: user.bio || "",
    interests: user.interests || [],
    skills: user.skills || [],
  };
}

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.access || "teacher",
    title: row.role || "",
    school: row.school || "",
    location: row.location || "",
    areas: row.areas || "",
    bio: row.bio || "",
    interests: Array.isArray(row.interests) ? row.interests : [],
    skills: Array.isArray(row.skills) ? row.skills : [],
    passwordHash: row.password_hash,
  };
}

function mapPost(row) {
  const messages = Array.isArray(row.messages) ? row.messages : [];
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    author: row.author,
    authorId: row.author_id,
    replies: row.replies,
    views: row.views,
    time: row.time_label,
    createdAt: iso(row.created_at),
    body: row.body,
    messages: messages.map((item) => ({
      author: item.author,
      text: item.text,
      createdAt: iso(item.createdAt || item.created_at),
    })),
  };
}

function mapVideo(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    url: row.url,
    createdAt: iso(row.created_at),
  };
}

function mapAttachment(row) {
  return {
    id: row.id,
    name: row.name,
    mime: row.mime,
    size: row.size,
    stored: row.stored,
    url: row.url,
    createdAt: iso(row.created_at),
  };
}

function mapMail(row) {
  return {
    id: row.id,
    subject: row.subject,
    message: row.message,
    from: row.from_email,
    to: row.recipients,
    attachments: row.attachments,
    sentAt: iso(row.sent_at),
  };
}

const postSelect = `
  SELECT p.id, p.title, p.category, p.author, p.author_id,
    (SELECT COUNT(*)::int FROM post_messages pm WHERE pm.post_id = p.id) AS replies,
    (SELECT COUNT(*)::int FROM engagement e WHERE e.kind = 'post-view' AND e.item_id = p.id) AS views,
    p.time_label, p.created_at, p.body,
    COALESCE(
      json_agg(
        json_build_object('author', m.author, 'text', m.body, 'createdAt', m.created_at)
        ORDER BY m.created_at
      ) FILTER (WHERE m.id IS NOT NULL),
      '[]'
    ) AS messages
  FROM posts p
  LEFT JOIN post_messages m ON m.post_id = p.id
`;

async function setup() {
  try {
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  } catch {
    /* Vercel keeps the project folder read-only. */
  }
  const { ensureFeeds } = await import("./feeds.mjs");
  const { ensureEvents } = await import("./events.mjs");
  await ensureFeeds(pool);
  await ensureEvents(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS engagement (
      kind text NOT NULL,
      item_id text NOT NULL,
      actor text NOT NULL,
      first_at timestamptz NOT NULL DEFAULT NOW(),
      last_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (kind, item_id, actor)
    )
  `);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS access text");
  await pool.query("UPDATE users SET access = 'teacher' WHERE access IS NULL OR access = ''");

  const teacher = await pool.query("SELECT id FROM users WHERE email = 'ilija@klub.mk'");
  const teacherId = teacher.rows[0]?.id;
  const postCount = await pool.query("SELECT COUNT(*)::int AS count FROM posts");
  if (postCount.rows[0].count === 0 && teacherId) {
    const posts = [
      ["motivacija", "Како да го мотивираме ученикот?", "Методика и пракса", "Илија Станковски", teacherId, 2, 0, "пред 2 часа", "2026-06-10T09:00:00.000Z", "Кои пристапи ви даваат најдобри резултати кога ученикот ја губи енергијата на средината од часот? Споделете конкретни примери."],
      ["digitalni-alatki", "Дигитални алатки за наставата", "Технологија", "Марија Трајкова", teacherId, 1, 0, "пред 5 часа", "2026-06-09T12:00:00.000Z", "Кои бесплатни алатки ви се најстабилни за час од 40 минути, без долго најавување?"],
      ["dobra-praktika", "Кратки цели на почетокот на часот", "Добра практика", "Ана Петровска", teacherId, 0, 0, "вчера", "2026-06-08T08:30:00.000Z", "Ги запишувам трите цели на таблата пред да почне активноста. Учениците сами кажуваат која цел ја исполниле."],
    ];
    for (const post of posts) {
      await pool.query(
        "INSERT INTO posts (id, title, category, author, author_id, replies, views, time_label, created_at, body) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        post,
      );
    }
    await pool.query(
      "INSERT INTO post_messages (id, post_id, author, body, created_at) VALUES ($1,$2,$3,$4,$5), ($6,$7,$8,$9,$10), ($11,$12,$13,$14,$15)",
      [
        "m-1", "motivacija", "Ана Петровска", "Кај мене добро функционираат кратки избори и јасни цели за секоја активност.", "2026-06-10T10:00:00.000Z",
        "m-2", "motivacija", "Марија Трајкова", "Групната работа со поделени улоги значително ја подобри вклученоста.", "2026-06-10T11:00:00.000Z",
        "m-3", "digitalni-alatki", "Илија Станковски", "Една споделена табла и краток квиз на крајот се доволни за повеќето часови.", "2026-06-09T14:00:00.000Z",
      ],
    );
  }
  await pool.query(
    `UPDATE users SET
       bio = replace(bio, ', книговодство', ''),
       skills = (
         SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
         FROM jsonb_array_elements(skills) AS item
         WHERE item <> '"Книговодство"'::jsonb
       )
     WHERE skills @> '["Книговодство"]'::jsonb OR bio LIKE '%книговодство%'`,
  );
  const videoCount = await pool.query("SELECT COUNT(*)::int AS count FROM videos");
  if (videoCount.rows[0].count === 0) {
    await pool.query("INSERT INTO videos (id, title, description, url, created_at) VALUES ($1,$2,$3,$4,$5)", [
      "v-voved",
      "Вовед: како го користиме клубот",
      "Кратко видео за нови членови: каде се ресурсите, форумот и календарот.",
      "",
      "2026-09-20T08:00:00.000Z",
    ]);
  }
  const { ensureLearning } = await import("./learning.mjs");
  await ensureLearning(pool);
  await pool.query(
    `UPDATE download_counts SET downloads = (
       SELECT COUNT(*)::int FROM engagement e
       WHERE e.kind = download_counts.kind || '-download' AND e.item_id = download_counts.item_id
     )`,
  );
  await pool.query(
    `UPDATE library_items SET downloads = (
       SELECT COUNT(*)::int FROM engagement e
       WHERE e.kind = library_items.kind || '-download' AND e.item_id = library_items.id
     )`,
  );
  await pool.query(
    `UPDATE posts SET views = (
       SELECT COUNT(*)::int FROM engagement e
       WHERE e.kind = 'post-view' AND e.item_id = posts.id
     ), replies = (
       SELECT COUNT(*)::int FROM post_messages m WHERE m.post_id = posts.id
     )`,
  );
}

let ready;
function ensureReady() {
  if (!ready) {
    ready = setup().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

const visitorPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function actorFrom(req, body) {
  const visitor = String(body?.visitor || "");
  const guest = visitorPattern.test(visitor) ? `guest:${visitor}` : "";
  const user = await userFrom(req);
  if (user) return { actor: `user:${user.id}`, user, guest };
  return { actor: guest, user: null, guest: "" };
}

async function recordHit(kind, itemId, actor, foldGuest = "") {
  if (!actor) {
    const current = await pool.query("SELECT COUNT(*)::int AS count FROM engagement WHERE kind = $1 AND item_id = $2", [kind, itemId]);
    return current.rows[0].count;
  }
  await pool.query(
    `INSERT INTO engagement (kind, item_id, actor) VALUES ($1,$2,$3)
     ON CONFLICT (kind, item_id, actor) DO UPDATE SET last_at = NOW()`,
    [kind, itemId, actor],
  );
  if (foldGuest && foldGuest !== actor) {
    await pool.query("DELETE FROM engagement WHERE kind = $1 AND item_id = $2 AND actor = $3", [kind, itemId, foldGuest]);
  }
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM engagement WHERE kind = $1 AND item_id = $2", [kind, itemId]);
  return rows[0].count;
}

async function unreadReplies(user) {
  if (!user) return 0;
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM post_messages m
     JOIN posts p ON p.id = m.post_id
     LEFT JOIN engagement e ON e.kind = 'post-view' AND e.item_id = p.id AND e.actor = $2
     WHERE p.author_id = $1
       AND m.author <> p.author
       AND m.author <> $3
       AND m.created_at > COALESCE(e.last_at, 'epoch')`,
    [user.id, `user:${user.id}`, user.name],
  );
  return rows[0].count;
}

async function userFrom(req) {
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const token = bearer || readSessionCookie(req);
  if (!token || !/^[a-f0-9]{32,128}$/i.test(token)) return null;
  const { rows } = await pool.query(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1 AND s.expires_at > NOW()",
    [token],
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

async function requireUser(req) {
  const user = await userFrom(req);
  if (!user) return { error: { status: 401, body: { error: "Најавете се за да продолжите." } } };
  return { user };
}

async function requireAdmin(req) {
  const result = await requireUser(req);
  if (result.error) return result;
  if (result.user.role !== "admin") {
    return { error: { status: 403, body: { error: "Оваа акција е достапна само за раководител." } } };
  }
  return result;
}

async function loadPost(postId) {
  const { rows } = await pool.query(`${postSelect} WHERE p.id = $1 GROUP BY p.id`, [postId]);
  return rows[0] ? mapPost(rows[0]) : null;
}

function readBody(req, limit = 6_000_000) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === "string" && req.body) {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.reject(Object.assign(new Error("json"), { status: 400 }));
    }
  }
  if (req.readableEnded) return Promise.resolve({});
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("json"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

async function handle(method, url, req) {
  await ensureReady();

  const mediaFile = url.match(/^\/api\/media\/file\/([^/]+)$/);
  if (method === "GET" && mediaFile) {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const { fileKey, mediaConfig, watchUrl } = await import("./mediaStore.mjs");
    const key = fileKey(mediaFile[1]);
    const config = mediaConfig(root);
    if (!key || !config.remote) return { status: 404, body: { error: "Видеото не е пронајдено." } };
    return { status: 302, redirect: watchUrl(config, key) };
  }

  if (method === "GET" && url === "/api/media/storage") {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const { mediaConfig } = await import("./mediaStore.mjs");
    return { status: 200, body: { mode: mediaConfig(root).remote ? "remote" : "local" } };
  }

  if (method === "POST" && url === "/api/media/video") {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const { compressVideo, mediaConfig, publishVideo, saveVideoStream } = await import("./mediaStore.mjs");
    let leftover = "";
    try {
      const saved = await saveVideoStream(req, uploadDir, req.headers["x-file-name"]);
      leftover = saved.path;
      const packed = await compressVideo(saved.path);
      leftover = packed.path;
      const config = mediaConfig(root);
      if (config.remote) {
        const remoteUrl = await publishVideo(config, packed.path);
        if (existsSync(packed.path)) unlinkSync(packed.path);
        leftover = "";
        return { status: 201, body: { url: remoteUrl, bytes: packed.size } };
      }
      leftover = "";
      return { status: 201, body: { url: `/uploads/${path.basename(packed.path)}`, bytes: packed.size } };
    } catch (error) {
      if (leftover && existsSync(leftover)) unlinkSync(leftover);
      const status = error.status || 500;
      if (status === 400) return { status: 400, body: { error: "Дозволени се само видео датотеки." } };
      if (status === 413) return { status: 413, body: { error: "Видеото е преголемо." } };
      if (status === 503) return { status: 503, body: { error: "Компресијата не е достапна на серверот." } };
      if (status === 502) return { status: 502, body: { error: "Компресираното видео не стигна до надворешниот склад." } };
      throw error;
    }
  }

  if (method === "GET" && url === "/api/posts") {
    const { rows } = await pool.query(`${postSelect} GROUP BY p.id ORDER BY p.created_at DESC`);
    return { status: 200, body: { posts: rows.map(mapPost) } };
  }

  if (method === "GET" && url === "/api/me") {
    const user = await userFrom(req);
    if (!user) return { status: 401, body: { error: "Нема активна најава." } };
    return { status: 200, body: { user: publicUser(user) } };
  }

  if (method === "GET" && url === "/api/videos") {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const { rows } = await pool.query("SELECT * FROM videos ORDER BY created_at DESC");
    return { status: 200, body: { videos: rows.map(mapVideo) } };
  }

  if (method === "GET" && url === "/api/attachments") {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const { rows } = await pool.query("SELECT id, name, mime, size, url, created_at FROM attachments ORDER BY created_at DESC");
    return { status: 200, body: { attachments: rows.map((row) => ({ id: row.id, name: row.name, mime: row.mime, size: row.size, url: row.url, createdAt: iso(row.created_at) })) } };
  }

  if (method === "GET" && url === "/api/accounts") {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const { rows } = await pool.query("SELECT * FROM users ORDER BY name");
    return { status: 200, body: { accounts: rows.map((row) => publicUser(mapUser(row))) } };
  }

  if (method === "GET" && url === "/api/mail") {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const { rows } = await pool.query("SELECT * FROM mail ORDER BY sent_at DESC");
    return { status: 200, body: { messages: rows.map(mapMail) } };
  }

  if (method === "GET" && url === "/api/events") {
    const { listEvents } = await import("./events.mjs");
    return { status: 200, body: { events: await listEvents(pool) } };
  }

  if (method === "GET" && (url === "/api/notices" || url === "/api/calendar" || url === "/api/push/key")) {
    const feeds = await import("./feeds.mjs");
    if (url === "/api/push/key") return { status: 200, body: { publicKey: feeds.pushPublicKey() } };
    if (url === "/api/notices") return { status: 200, body: { notices: await feeds.listNotices(pool) } };
    return { status: 200, body: { items: await feeds.listCalendar(pool) } };
  }

  let body = {};
  if (method === "POST" || method === "PATCH" || method === "PUT") {
    const heavy = ["/api/documents", "/api/resources", "/api/attachments", "/api/accounts/import"].includes(url) || url.startsWith("/api/trainings");
    try {
      body = await readBody(req, heavy ? 8_000_000 : 100_000);
    } catch (error) {
      const status = error.status || 400;
      return { status, body: { error: status === 413 ? "Датотеката е преголема." : "Неисправно барање." } };
    }
  }

  if (method === "POST" && url === "/api/media/ticket") {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const { mediaConfig, videoTicket } = await import("./mediaStore.mjs");
    const config = mediaConfig(root);
    if (!config.remote) return { status: 400, body: { error: "Бесплатниот надворешен склад не е поврзан." } };
    return { status: 200, body: videoTicket(config, body.name) };
  }

  if (method === "PATCH" && url === "/api/me") {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const name = text(body.name, 80);
    const title = text(body.title, 120);
    const school = text(body.school, 120);
    const location = text(body.location, 120);
    const areas = text(body.areas, 200);
    const bio = text(body.bio, 2000);
    const interests = Array.isArray(body.interests) ? body.interests.map((item) => text(item, 40)).filter(Boolean) : [];
    const skills = Array.isArray(body.skills) ? body.skills.map((item) => text(item, 40)).filter(Boolean) : [];
    if (!name || !title) return { status: 400, body: { error: "Името и позицијата се задолжителни." } };
    await pool.query(
      "UPDATE users SET name = $1, role = $2, school = $3, location = $4, areas = $5, bio = $6, interests = $7::jsonb, skills = $8::jsonb WHERE id = $9",
      [name, title, school, location, areas, bio, JSON.stringify(interests), JSON.stringify(skills), auth.user.id],
    );
    const updated = await pool.query("SELECT * FROM users WHERE id = $1", [auth.user.id]);
    return { status: 200, body: { user: publicUser(mapUser(updated.rows[0])) } };
  }

  if (method === "POST" && (url === "/api/login/salt" || url === "/api/login") && loginLimited(req)) {
    return { status: 429, body: { error: "Премногу обиди. Почекајте и обидете се повторно." } };
  }

  if (method === "POST" && url === "/api/login/salt") {
    const email = text(body.email, 120).toLowerCase();
    const { rows } = await pool.query("SELECT password_hash FROM users WHERE email = $1", [email]);
    return { status: 200, body: { salt: loginSalt(email, rows[0]?.password_hash) } };
  }

  if (method === "POST" && url === "/api/login") {
    const email = text(body.email, 120).toLowerCase();
    const digest = String(body.digest || "");
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = rows[0] ? mapUser(rows[0]) : null;
    if (!user || !digestMatches(user.passwordHash, digest)) {
      noteLogin(req, false);
      return { status: 401, body: { error: "Е-поштата или лозинката не се точни." } };
    }
    noteLogin(req, true);
    const token = randomBytes(32).toString("hex");
    await pool.query("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '14 days')", [token, user.id]);
    return { status: 200, body: { user: publicUser(user) }, cookie: sessionCookie(token, req) };
  }

  if (method === "POST" && url === "/api/logout") {
    const header = req.headers.authorization || "";
    const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const token = bearer || readSessionCookie(req);
    if (token) await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
    return { status: 200, body: { ok: true }, cookie: clearSessionCookie(req) };
  }

  if (method === "POST" && url === "/api/posts") {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const title = text(body.title, 140);
    const category = text(body.category, 80);
    const message = text(body.body, 4000);
    if (!title || !message) return { status: 400, body: { error: "Насловот и текстот се задолжителни." } };
    if (!categories.includes(category)) return { status: 400, body: { error: "Изберете категорија од списокот." } };
    const postId = id("tema");
    const createdAt = new Date().toISOString();
    await pool.query(
      "INSERT INTO posts (id, title, category, author, author_id, replies, views, time_label, created_at, body) VALUES ($1,$2,$3,$4,$5,0,0,'штотуку',$6,$7)",
      [postId, title, category, auth.user.name, auth.user.id, createdAt, message],
    );
    return { status: 201, body: { post: await loadPost(postId) } };
  }

  if (method === "POST" && url === "/api/notifications") {
    const { user, actor } = await actorFrom(req, body);
    const forum = await unreadReplies(user);
    const { notificationBundle } = await import("./feeds.mjs");
    return { status: 200, body: await notificationBundle(pool, actor, forum) };
  }

  const viewMatch = url.match(/^\/api\/posts\/([^/]+)\/view$/);
  if (method === "POST" && viewMatch) {
    const found = await pool.query("SELECT id FROM posts WHERE id = $1", [viewMatch[1]]);
    if (!found.rows[0]) return { status: 404, body: { error: "Темата не е пронајдена." } };
    const { actor, user, guest } = await actorFrom(req, body);
    const views = await recordHit("post-view", viewMatch[1], actor, user ? guest : "");
    await pool.query("UPDATE posts SET views = $2 WHERE id = $1", [viewMatch[1], views]);
    const forum = await unreadReplies(user);
    const { notificationBundle } = await import("./feeds.mjs");
    const bundle = await notificationBundle(pool, actor, forum);
    return { status: 200, body: { views, unread: bundle.count, items: bundle.items } };
  }

  const replyMatch = url.match(/^\/api\/posts\/([^/]+)\/replies$/);
  if (method === "POST" && replyMatch) {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const existing = await pool.query("SELECT id, title, author_id FROM posts WHERE id = $1", [replyMatch[1]]);
    if (!existing.rows[0]) return { status: 404, body: { error: "Темата не е пронајдена." } };
    const message = text(body.text, 2000);
    if (!message) return { status: 400, body: { error: "Напишете одговор." } };
    const createdAt = new Date().toISOString();
    await pool.query("INSERT INTO post_messages (id, post_id, author, body, created_at) VALUES ($1,$2,$3,$4,$5)", [
      id("msg"),
      replyMatch[1],
      auth.user.name,
      message,
      createdAt,
    ]);
    await pool.query(
      "UPDATE posts SET replies = (SELECT COUNT(*)::int FROM post_messages WHERE post_id = $1), time_label = 'штотуку' WHERE id = $1",
      [replyMatch[1]],
    );
    if (existing.rows[0].author_id && existing.rows[0].author_id !== auth.user.id) {
      const { pushForumReply } = await import("./feeds.mjs");
      await pushForumReply(pool, existing.rows[0].author_id, existing.rows[0].title, `/forum/${replyMatch[1]}`);
    }
    return { status: 201, body: { post: await loadPost(replyMatch[1]) } };
  }

  const postMatch = url.match(/^\/api\/posts\/([^/]+)$/);
  if (method === "DELETE" && postMatch) {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const result = await pool.query("DELETE FROM posts WHERE id = $1", [postMatch[1]]);
    if (!result.rowCount) return { status: 404, body: { error: "Темата не е пронајдена." } };
    return { status: 200, body: { ok: true } };
  }

  if (method === "POST" && url === "/api/accounts") {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const name = text(body.name, 80);
    const email = text(body.email, 120).toLowerCase();
    const passwordHash = String(body.passwordHash || "");
    const role = body.role === "admin" ? "admin" : "teacher";
    const school = text(body.school, 120) || "Клуб на наставници";
    const title = text(body.title, 120) || (role === "admin" ? "Раководител" : "Наставник");
    if (!name || !email.includes("@") || !/^sha256:[a-f0-9]{32}:[a-f0-9]{64}$/i.test(passwordHash)) {
      return { status: 400, body: { error: "Потребни се име, валидна е-пошта и лозинка од најмалку 8 знаци." } };
    }
    const userId = randomUUID();
    try {
      await pool.query(
        `INSERT INTO users (id, email, password_hash, name, role, school, location, areas, bio, interests, skills, access)
         VALUES ($1,$2,$3,$4,$5,$6,'','','',$7::jsonb,$8::jsonb,$9)`,
        [userId, email, passwordHash, name, title, school, "[]", "[]", role],
      );
    } catch (error) {
      if (error.code === "23505") return { status: 409, body: { error: "Веќе постои сметка со оваа е-пошта." } };
      throw error;
    }
    return { status: 201, body: { account: { id: userId, name, email, role, school, title, location: "", areas: "", bio: "", interests: [], skills: [] } } };
  }

  if (method === "POST" && url === "/api/accounts/import") {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const { parseMemberFile } = await import("./members.mjs");
    const members = parseMemberFile(body);
    if (!members.length) return { status: 400, body: { error: "Во датотеката нема е-пошти." } };
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const created = [];
    const skipped = [];
    for (const member of members) {
      const password = Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join("");
      try {
        await pool.query(
          `INSERT INTO users (id, email, password_hash, name, role, school, location, areas, bio, interests, skills, access)
           VALUES ($1,$2,$3,$4,'Наставник','Клуб на наставници','','','',$5::jsonb,$6::jsonb,'teacher')`,
          [randomUUID(), member.email, storePassword(password), member.name, "[]", "[]"],
        );
        created.push({ name: member.name, email: member.email, password });
      } catch (error) {
        if (error.code === "23505") skipped.push({ email: member.email, reason: "Веќе постои." });
        else throw error;
      }
    }
    return { status: 201, body: { created, skipped } };
  }

  const accountMatch = url.match(/^\/api\/accounts\/([^/]+)$/);
  if (method === "PATCH" && accountMatch) {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const found = await pool.query("SELECT * FROM users WHERE id = $1", [accountMatch[1]]);
    if (!found.rows[0]) return { status: 404, body: { error: "Сметката не е пронајдена." } };
    const user = mapUser(found.rows[0]);
    const role = body.role === "admin" ? "admin" : "teacher";
    if (user.role === "admin" && role !== "admin") {
      const admins = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE access = 'admin'");
      if (admins.rows[0].count < 2) return { status: 400, body: { error: "Мора да остане барем еден раководител." } };
    }
    await pool.query("UPDATE users SET access = $1 WHERE id = $2", [role, user.id]);
    return { status: 200, body: { account: { ...publicUser(user), role } } };
  }

  if (method === "POST" && url === "/api/videos") {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const title = text(body.title, 140);
    const description = text(body.description, 1000);
    const videoUrl = text(body.url, 2000);
    if (!title) return { status: 400, body: { error: "Насловот е задолжителен." } };
    if (videoUrl && !videoUrl.startsWith("/api/media/file/") && !/^https:\/\//.test(videoUrl)) {
      return { status: 400, body: { error: "Линкот мора да почнува со https://." } };
    }
    const video = { id: id("v"), title, description, url: videoUrl, createdAt: new Date().toISOString() };
    await pool.query("INSERT INTO videos (id, title, description, url, created_at) VALUES ($1,$2,$3,$4,$5)", [
      video.id,
      video.title,
      video.description,
      video.url,
      video.createdAt,
    ]);
    return { status: 201, body: { video } };
  }

  const videoMatch = url.match(/^\/api\/videos\/([^/]+)$/);
  if (method === "DELETE" && videoMatch) {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const existing = await pool.query("SELECT url FROM videos WHERE id = $1", [videoMatch[1]]);
    const { removeLocalUpload } = await import("./mediaStore.mjs");
    removeLocalUpload(uploadDir, existing.rows[0]?.url);
    await pool.query("DELETE FROM videos WHERE id = $1", [videoMatch[1]]);
    return { status: 200, body: { ok: true } };
  }

  if (method === "POST" && url === "/api/attachments") {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const name = text(body.name, 120).replace(/[^\w.\- ()\u0400-\u04FF]+/g, "") || "prilog";
    if (/\.(html?|svg|js|mjs|xml|xhtml)$/i.test(name)) {
      return { status: 400, body: { error: "Овој вид датотека не е дозволен." } };
    }
    const mime = text(body.mime, 80) || "application/octet-stream";
    const raw = String(body.data || "");
    const base64 = raw.includes(",") ? raw.split(",").pop() : raw;
    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length || buffer.length > 4 * 1024 * 1024) {
      return { status: 400, body: { error: "Прилогот мора да биде до 4 MB." } };
    }
    const fileId = id("f");
    const stored = `${fileId}-${name.replace(/\s+/g, "-")}`;
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    writeFileSync(path.join(uploadDir, stored), buffer);
    const createdAt = new Date().toISOString();
    const fileUrl = `/uploads/${stored}`;
    await pool.query(
      "INSERT INTO attachments (id, name, mime, size, stored, url, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [fileId, name, mime, buffer.length, stored, fileUrl, createdAt],
    );
    return { status: 201, body: { attachment: { id: fileId, name, mime, size: buffer.length, url: fileUrl, createdAt } } };
  }

  const fileMatch = url.match(/^\/api\/attachments\/([^/]+)$/);
  if (method === "DELETE" && fileMatch) {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const found = await pool.query("SELECT stored FROM attachments WHERE id = $1", [fileMatch[1]]);
    const stored = found.rows[0]?.stored;
    if (stored) {
      const target = path.join(uploadDir, path.basename(stored));
      if (existsSync(target)) unlinkSync(target);
    }
    await pool.query("DELETE FROM attachments WHERE id = $1", [fileMatch[1]]);
    return { status: 200, body: { ok: true } };
  }

  if (method === "POST" && url === "/api/mail") {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const subject = text(body.subject, 160);
    const message = text(body.message, 4000);
    const attachmentIds = Array.isArray(body.attachmentIds) ? body.attachmentIds.map(String) : [];
    if (!subject || !message) return { status: 400, body: { error: "Насловот и пораката се задолжителни." } };
    let recipients = [];
    if (body.allTeachers) {
      const { rows } = await pool.query("SELECT name, email FROM users WHERE access = 'teacher'");
      recipients = rows;
    } else {
      const ids = Array.isArray(body.recipientIds) ? body.recipientIds.map(String) : [];
      if (ids.length) {
        const { rows } = await pool.query("SELECT name, email FROM users WHERE id = ANY($1::text[])", [ids]);
        recipients = rows;
      }
    }
    if (!recipients.length) return { status: 400, body: { error: "Изберете барем еден примач." } };
    let files = [];
    if (attachmentIds.length) {
      const { rows } = await pool.query("SELECT id, name, url FROM attachments WHERE id = ANY($1::text[])", [attachmentIds]);
      files = rows;
    }
    const entry = {
      id: id("m"),
      subject,
      message,
      from: auth.user.email,
      to: recipients.map((item) => ({ name: item.name, email: item.email })),
      attachments: files.map((item) => ({ id: item.id, name: item.name, url: item.url })),
      sentAt: new Date().toISOString(),
    };
    await pool.query(
      "INSERT INTO mail (id, subject, message, from_email, recipients, attachments, sent_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)",
      [entry.id, entry.subject, entry.message, entry.from, JSON.stringify(entry.to), JSON.stringify(entry.attachments), entry.sentAt],
    );
    return { status: 201, body: { message: entry } };
  }

  if (method === "POST" && url === "/api/events") {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const { addEvent } = await import("./events.mjs");
    const result = await addEvent(pool, id("nastan"), {
      title: text(body.title, 140),
      kind: text(body.kind, 40),
      date: text(body.date, 10),
      time: text(body.time, 8),
      location: text(body.location, 80),
      status: text(body.status, 20),
      detail: text(body.detail, 1000),
    });
    if (result.error) return { status: 400, body: { error: result.error } };
    return { status: 201, body: result };
  }

  const eventMatch = url.match(/^\/api\/events\/([^/]+)$/);
  if (method === "DELETE" && eventMatch) {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const { removeEvent } = await import("./events.mjs");
    const result = await removeEvent(pool, decodeURIComponent(eventMatch[1]));
    if (result.error) return { status: 404, body: { error: result.error } };
    return { status: 200, body: result };
  }

  if (method === "POST" && (url === "/api/notices" || url === "/api/calendar")) {
    const auth = await requireAdmin(req);
    if (auth.error) return auth.error;
    const feeds = await import("./feeds.mjs");
    const result = url === "/api/notices"
      ? await feeds.addNotice(pool, id("oglas"), {
        title: text(body.title, 140),
        category: text(body.category, 40),
        day: text(body.day, 2),
        month: text(body.month, 8).toUpperCase(),
        status: text(body.status, 40) || "НОВО",
        priority: Boolean(body.priority),
        body: text(body.text, 1000),
      })
      : await feeds.addCalendarEntry(pool, id("cal"), {
        title: text(body.title, 140),
        category: text(body.category, 40),
        day: body.day,
        time: text(body.time, 8),
        location: text(body.location, 80),
        body: text(body.text, 1000),
      });
    if (result.error) return { status: 400, body: { error: result.error } };
    return { status: 201, body: result };
  }

  if (method === "POST" && url === "/api/push/subscribe") {
    const user = await userFrom(req);
    const { saveSubscription } = await import("./feeds.mjs");
    const result = await saveSubscription(pool, body, user);
    if (result.error) return { status: 400, body: { error: result.error } };
    return { status: 200, body: result };
  }

  if (method === "POST" && url === "/api/feeds/seen") {
    const { actor } = await actorFrom(req, body);
    const { markFeedSeen, notificationBundle } = await import("./feeds.mjs");
    await markFeedSeen(pool, actor, text(body.kind, 20));
    const user = await userFrom(req);
    return { status: 200, body: await notificationBundle(pool, actor, await unreadReplies(user)) };
  }

  const { handleLearning } = await import("./learning.mjs");
  const extra = await handleLearning({
    pool,
    method,
    url,
    req,
    body,
    requireUser,
    requireAdmin,
    text,
    id,
    uploadDir,
    actorFrom,
    recordHit,
  });
  if (extra) return extra;

  return { status: 404, body: { error: "Непозната патека." } };
}

export function clubApiMiddleware() {
  return async function clubApi(req, res, next) {
    applySecurityHeaders(req, res);
    const url = (req.url || "").split("?")[0];
    if (url.startsWith("/uploads/")) {
      const blocked = guardUpload(url);
      if (blocked) {
        res.statusCode = blocked;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(blocked === 403 ? "Недозволен вид датотека." : "Неисправна патека.");
        return;
      }
      for (const [key, value] of Object.entries(uploadHeaders(url))) res.setHeader(key, value);
      return next();
    }
    if (!url.startsWith("/api/")) return next();
    try {
      const result = await handle(req.method || "GET", url, req);
      if (result.redirect) {
        res.statusCode = result.status;
        res.setHeader("Location", result.redirect);
        res.setHeader("Cache-Control", "private, no-store");
        res.end();
        return;
      }
      res.statusCode = result.status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      if (result.cookie) res.setHeader("Set-Cookie", result.cookie);
      res.end(JSON.stringify(result.body));
    } catch (error) {
      const status = error.status || 500;
      const detail = String(error?.message || "unknown").replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://***");
      if (status === 500) console.error("Database request failed:", detail);
      const safe = detail.replace(/postgres(?:ql)?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim().slice(0, 180);
      const message = status === 413
        ? "Видеото е преголемо."
        : safe.includes("DATABASE_URL is missing")
          ? "DATABASE_URL не е поставен на Vercel."
          : safe
            ? `Базата не можеше да го заврши барањето. ${safe}`
            : "Базата не можеше да го заврши барањето.";
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: message }));
    }
  };
}
