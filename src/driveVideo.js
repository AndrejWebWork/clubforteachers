export function driveVideoPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const own = raw.match(/^\/api\/media\/drive\/([\w-]{8,})$/);
  if (own) return `/api/media/drive/${own[1]}`;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return "";
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "drive.google.com" && host !== "docs.google.com" && host !== "drive.usercontent.google.com") return "";
  const fromPath = parsed.pathname.match(/\/d\/([\w-]{8,})/);
  const queryId = parsed.searchParams.get("id") || "";
  const id = fromPath?.[1] || (/^[\w-]{8,}$/.test(queryId) ? queryId : "");
  if (!id) return "";
  return `/api/media/drive/${id}`;
}
