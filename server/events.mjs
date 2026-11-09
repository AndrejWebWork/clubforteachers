const kinds = ["Вебинар", "Работилница", "Обука", "Средба"];
const statuses = ["Претстои", "Завршен"];
const months = ["Јан", "Фев", "Мар", "Апр", "Мај", "Јуни", "Јули", "Авг", "Сеп", "Окт", "Ное", "Дек"];

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
    );
    ALTER TABLE club_events ADD COLUMN IF NOT EXISTS cover_url text NOT NULL DEFAULT '';
    CREATE TABLE IF NOT EXISTS event_signups (
      event_id text NOT NULL,
      user_id uuid NOT NULL,
      name text NOT NULL,
      email text NOT NULL,
      joined_at timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (event_id, user_id)
    )
  `);
}

function calendarKind(kind) {
  if (kind === "Работилница") return "Работилници";
  if (kind === "Обука") return "Обуки";
  return "Настани";
}

async function placeOnCalendar(pool, eventId, item) {
  const year = Number(String(item.date).slice(0, 4));
  const month = Number(String(item.date).slice(5, 7));
  const day = Number(String(item.date).slice(8, 10));
  if (![2026, 2027].includes(year) || month < 1 || month > 12 || day < 1 || day > 31) return;
  const id = `evt-${eventId}`;
  await pool.query(
    `INSERT INTO calendar_entries (id, day, entry_year, entry_month, title, category, time, location, body, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())
     ON CONFLICT (id) DO UPDATE SET day = $2, entry_year = $3, entry_month = $4, title = $5, category = $6, time = $7, location = $8, body = $9`,
    [id, day, year, month, item.title, calendarKind(item.kind), item.time || "12:00", item.location || "Онлајн", item.detail || item.title],
  );
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
    cover: row.cover_url || "",
    createdAt: row.created_at,
  };
}

export async function listEvents(pool) {
  const { rows } = await pool.query("SELECT * FROM club_events ORDER BY event_date, time");
  for (const row of rows) {
    await placeOnCalendar(pool, row.id, {
      date: String(row.event_date).slice(0, 10),
      title: row.title,
      kind: row.kind,
      time: String(row.time).slice(0, 5),
      location: row.location,
      detail: row.detail,
    });
  }
  return rows.map(mapEvent);
}

export async function listSignups(pool) {
  const { rows } = await pool.query("SELECT event_id, name, email FROM event_signups ORDER BY name");
  return rows.map((row) => ({ eventId: row.event_id, name: row.name, email: row.email }));
}

export async function mySignups(pool, userId) {
  const { rows } = await pool.query("SELECT event_id FROM event_signups WHERE user_id = $1", [userId]);
  return rows.map((row) => row.event_id);
}

export async function toggleSignup(pool, eventId, user) {
  const event = await pool.query("SELECT id FROM club_events WHERE id = $1", [eventId]);
  if (!event.rowCount) return { error: "Настанот не е пронајден." };
  const existing = await pool.query("SELECT 1 FROM event_signups WHERE event_id = $1 AND user_id = $2", [eventId, user.id]);
  if (existing.rowCount) {
    await pool.query("DELETE FROM event_signups WHERE event_id = $1 AND user_id = $2", [eventId, user.id]);
    return { joined: false };
  }
  await pool.query(
    "INSERT INTO event_signups (event_id, user_id, name, email) VALUES ($1,$2,$3,$4)",
    [eventId, user.id, user.name, user.email],
  );
  return { joined: true };
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
    `INSERT INTO club_events (id, title, kind, event_date, time, location, status, detail, created_at, cover_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW(), $9)`,
    [id, item.title, item.kind, item.date, item.time, item.location, item.status, item.detail, item.cover || ""],
  );
  const { rows } = await pool.query("SELECT * FROM club_events WHERE id = $1", [id]);
  const event = mapEvent(rows[0]);
  await placeOnCalendar(pool, id, event);
  return { event };
}

export async function removeEvent(pool, eventId) {
  const result = await pool.query("DELETE FROM club_events WHERE id = $1", [eventId]);
  if (!result.rowCount) return { error: "Настанот не е пронајден." };
  await pool.query("DELETE FROM calendar_entries WHERE id = $1", [`evt-${eventId}`]);
  await pool.query("DELETE FROM event_signups WHERE event_id = $1", [eventId]);
  return { ok: true };
}
