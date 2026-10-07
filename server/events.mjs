import { events as seedEvents } from "../src/data.js";

const kinds = ["Вебинар", "Работилница", "Обука", "Средба"];
const statuses = ["Претстои", "Завршен"];
const months = ["Јан", "Фев", "Мар", "Апр", "Мај", "Јун", "Јул", "Авг", "Сеп", "Окт", "Ное", "Дек"];

export async function ensureEvents(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS club_events (
      id text PRIMARY KEY,
      title text NOT NULL,
      kind text NOT NULL,
      event_date text NOT NULL,
      time text NOT NULL,
      location text NOT NULL,
      status text NOT NULL,
      detail text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  const count = await pool.query("SELECT COUNT(*)::int AS count FROM club_events");
  if (count.rows[0].count > 0) return;
  for (const item of seedEvents) {
    await pool.query(
      `INSERT INTO club_events (id, title, kind, event_date, time, location, status, detail, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [item.id, item.title, item.kind, item.date, item.time, item.location, item.status, item.detail, `${item.date}T09:00:00.000Z`],
    );
  }
}

function mapEvent(row) {
  const [year, month, day] = String(row.event_date).slice(0, 10).split("-");
  return {
    id: row.id,
    date: `${year}-${month}-${day}`,
    day: String(Number(day)),
    month: months[Number(month) - 1] || "",
    title: row.title,
    kind: row.kind,
    location: row.location,
    time: String(row.time).slice(0, 5),
    status: row.status,
    detail: row.detail,
  };
}

export async function listEvents(pool) {
  const { rows } = await pool.query("SELECT * FROM club_events ORDER BY event_date, time");
  return rows.map(mapEvent);
}

export async function addEvent(pool, id, item) {
  if (!kinds.includes(item.kind)) return { error: "Изберете вид на настан." };
  if (!statuses.includes(item.status)) return { error: "Изберете дали настанот претстои или е завршен." };
  if (!item.title || !item.detail) return { error: "Насловот и описот се задолжителни." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return { error: "Изберете датум." };
  const month = Number(item.date.slice(5, 7));
  const day = Number(item.date.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) return { error: "Датумот не е исправен." };
  if (!item.time || !item.location) return { error: "Потребни се час и место." };
  await pool.query(
    `INSERT INTO club_events (id, title, kind, event_date, time, location, status, detail, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())`,
    [id, item.title, item.kind, item.date, item.time, item.location, item.status, item.detail],
  );
  const { rows } = await pool.query("SELECT * FROM club_events WHERE id = $1", [id]);
  return { event: mapEvent(rows[0]) };
}

export async function removeEvent(pool, eventId) {
  const result = await pool.query("DELETE FROM club_events WHERE id = $1", [eventId]);
  if (!result.rowCount) return { error: "Настанот не е пронајден." };
  return { ok: true };
}
