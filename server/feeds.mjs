import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import webpush from "web-push";
import { calendarItems, noticeCategories, notices } from "../src/data.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const calendarCategories = ["Обуки", "Настани", "Работилници", "Рокови", "Други активности"];
const kinds = new Set(["notice", "calendar", "forum"]);

function envValue(name) {
  if (process.env[name]) return process.env[name];
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return "";
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${name}=`));
  if (!line) return "";
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
}

function vapid() {
  const publicKey = envValue("VAPID_PUBLIC_KEY");
  const privateKey = envValue("VAPID_PRIVATE_KEY");
  const subject = envValue("VAPID_SUBJECT") || "mailto:klub@klub.mk";
  if (!publicKey || !privateKey) return null;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { publicKey };
}

export function pushPublicKey() {
  return vapid()?.publicKey || "";
}

export async function ensureFeeds(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS board_notices (
      id text PRIMARY KEY,
      title text NOT NULL,
      category text NOT NULL,
      day text NOT NULL,
      month text NOT NULL,
      status text NOT NULL,
      priority boolean NOT NULL DEFAULT false,
      body text NOT NULL,
      created_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS calendar_entries (
      id text PRIMARY KEY,
      day integer NOT NULL,
      title text NOT NULL,
      category text NOT NULL,
      time text NOT NULL,
      location text NOT NULL,
      body text NOT NULL,
      created_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint text PRIMARY KEY,
      p256dh text NOT NULL,
      auth text NOT NULL,
      user_id uuid,
      notices boolean NOT NULL DEFAULT true,
      calendar boolean NOT NULL DEFAULT true,
      forum boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL
    );
    ALTER TABLE calendar_entries ADD COLUMN IF NOT EXISTS entry_year integer NOT NULL DEFAULT 2026;
    ALTER TABLE calendar_entries ADD COLUMN IF NOT EXISTS entry_month integer NOT NULL DEFAULT 6;
    CREATE TABLE IF NOT EXISTS feed_seen (
      actor text NOT NULL,
      kind text NOT NULL,
      seen_at timestamptz NOT NULL,
      PRIMARY KEY (actor, kind)
    );
  `);
  const noticeCount = await pool.query("SELECT COUNT(*)::int AS count FROM board_notices");
  if (noticeCount.rows[0].count === 0) {
    for (const [index, item] of notices.entries()) {
      const createdAt = new Date(Date.UTC(2025, 5, 1, 12, 0, 0) - index * 3600000).toISOString();
      await pool.query(
        `INSERT INTO board_notices (id, title, category, day, month, status, priority, body, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [`oglas-${index + 1}`, item.title, item.category, item.day, item.month, item.status, Boolean(item.priority), item.text, createdAt],
      );
    }
  }
  const calendarCount = await pool.query("SELECT COUNT(*)::int AS count FROM calendar_entries");
  if (calendarCount.rows[0].count === 0) {
    for (const [index, item] of calendarItems.entries()) {
      const createdAt = new Date(Date.UTC(2025, 5, 1, 12, 0, 0) - index * 3600000).toISOString();
      await pool.query(
        `INSERT INTO calendar_entries (id, day, entry_year, entry_month, title, category, time, location, body, created_at)
         VALUES ($1,$2,2026,6,$3,$4,$5,$6,$7,$8)`,
        [item.id, item.day, item.title, item.category, item.time, item.location, item.text, createdAt],
      );
    }
  }
}

function mapNotice(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    day: row.day,
    month: row.month,
    status: row.status,
    priority: row.priority,
    text: row.body,
    createdAt: row.created_at,
  };
}

function mapCalendar(row) {
  return {
    id: row.id,
    day: row.day,
    year: row.entry_year,
    month: row.entry_month,
    title: row.title,
    category: row.category,
    time: row.time,
    location: row.location,
    text: row.body,
    createdAt: row.created_at,
  };
}

export async function listNotices(pool) {
  const { rows } = await pool.query("SELECT * FROM board_notices ORDER BY created_at DESC");
  return rows.map(mapNotice);
}

export async function listCalendar(pool) {
  const { rows } = await pool.query("SELECT * FROM calendar_entries ORDER BY entry_year, entry_month, day, time");
  return rows.map(mapCalendar);
}

async function sendPush(pool, rows, payload) {
  if (!vapid() || !rows.length) return;
  const body = JSON.stringify(payload);
  await Promise.all(rows.map(async (row) => {
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, body);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [row.endpoint]);
      }
    }
  }));
}

async function notify(pool, { column, userId, title, body, url }) {
  const flag = column === "notices" || column === "calendar" || column === "forum" ? column : "";
  if (!flag) return;
  const query = userId
    ? `SELECT * FROM push_subscriptions WHERE ${flag} = true AND user_id = $1`
    : `SELECT * FROM push_subscriptions WHERE ${flag} = true`;
  const { rows } = await pool.query(query, userId ? [userId] : []);
  await sendPush(pool, rows, { title, body, url });
}

export async function addNotice(pool, id, item) {
  if (!noticeCategories.includes(item.category)) return { error: "Изберете категорија од списокот." };
  if (!item.title || !item.body) return { error: "Насловот и текстот се задолжителни." };
  const createdAt = new Date().toISOString();
  await pool.query(
    `INSERT INTO board_notices (id, title, category, day, month, status, priority, body, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, item.title, item.category, item.day || "01", item.month || "ЈУН", item.status || "НОВО", Boolean(item.priority), item.body, createdAt],
  );
  await notify(pool, { column: "notices", title: "Нов оглас", body: item.title, url: "/oglasi" });
  return { notice: { id, ...item, text: item.body, createdAt } };
}

export async function addCalendarEntry(pool, id, item) {
  const year = Number(item.year);
  const month = Number(item.month);
  const day = Number(item.day);
  const last = new Date(year, month, 0).getDate();
  if (!calendarCategories.includes(item.category)) return { error: "Изберете категорија од списокот." };
  if (![2026, 2027].includes(year) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > last) {
    return { error: "Датумот мора да биде во 2026 или 2027." };
  }
  if (!item.title || !item.body) return { error: "Потребни се наслов и опис." };
  const createdAt = new Date().toISOString();
  await pool.query(
    `INSERT INTO calendar_entries (id, day, entry_year, entry_month, title, category, time, location, body, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, day, year, month, item.title, item.category, item.time || "12:00", item.location || "Онлајн", item.body, createdAt],
  );
  await notify(pool, { column: "calendar", title: "Ново во календарот", body: item.title, url: "/kalendar" });
  return { entry: { id, day, year, month, title: item.title, category: item.category, time: item.time || "12:00", location: item.location || "Онлајн", text: item.body, createdAt } };
}

export async function saveSubscription(pool, body, user) {
  const sub = body.subscription || body;
  const endpoint = String(sub.endpoint || "");
  const p256dh = String(sub.keys?.p256dh || "");
  const auth = String(sub.keys?.auth || "");
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return { error: "Претплатата не е целосна." };
  await pool.query(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id, notices, calendar, forum, created_at)
     VALUES ($1,$2,$3,$4,true,true,true, NOW())
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = $2, auth = $3, user_id = COALESCE($4, push_subscriptions.user_id), notices = true, calendar = true, forum = true`,
    [endpoint, p256dh, auth, user?.id || null],
  );
  return { ok: true };
}

export async function pushForumReply(pool, userId, title, url) {
  if (!userId) return;
  await notify(pool, { column: "forum", userId, title: "Нов одговор на форумот", body: title, url });
}

const baseline = "2026-01-01T00:00:00.000Z";

async function unseenRows(pool, actor, kind) {
  const table = kind === "notice" ? "board_notices" : "calendar_entries";
  const { rows } = await pool.query(
    `SELECT id, title, created_at FROM ${table}
     WHERE created_at > COALESCE((SELECT seen_at FROM feed_seen WHERE actor = $1 AND kind = $2), $3::timestamptz)
     ORDER BY created_at DESC
     LIMIT 8`,
    [actor || "", kind, baseline],
  );
  return rows;
}

export async function notificationBundle(pool, actor, forumCount) {
  const noticesUnseen = actor ? await unseenRows(pool, actor, "notice") : [];
  const calendarUnseen = actor ? await unseenRows(pool, actor, "calendar") : [];
  const items = [
    ...noticesUnseen.map((row) => ({ kind: "Оглас", title: row.title, to: "/oglasi", createdAt: row.created_at })),
    ...calendarUnseen.map((row) => ({ kind: "Календар", title: row.title, to: "/kalendar", createdAt: row.created_at })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (forumCount > 0) items.unshift({ kind: "Форум", title: forumCount === 1 ? "1 нов одговор" : `${forumCount} нови одговори`, to: "/forum", createdAt: new Date().toISOString() });
  return {
    count: noticesUnseen.length + calendarUnseen.length + forumCount,
    notices: noticesUnseen.length,
    calendar: calendarUnseen.length,
    forum: forumCount,
    items,
  };
}

export async function markFeedSeen(pool, actor, kind) {
  if (!actor || !kinds.has(kind)) return;
  await pool.query(
    `INSERT INTO feed_seen (actor, kind, seen_at) VALUES ($1,$2, NOW())
     ON CONFLICT (actor, kind) DO UPDATE SET seen_at = NOW()`,
    [actor, kind],
  );
}
