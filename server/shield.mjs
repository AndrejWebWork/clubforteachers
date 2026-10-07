import path from "node:path";

const WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 8;
const attempts = new Map();

const BLOCKED_EXT = new Set([".html", ".htm", ".svg", ".js", ".mjs", ".cjs", ".xml", ".xhtml", ".shtml"]);
const INLINE_EXT = new Set([".mp4", ".webm", ".ogg", ".mov", ".png", ".jpg", ".jpeg", ".gif", ".webp"]);

export function isBlockedUpload(name) {
  return BLOCKED_EXT.has(path.extname(String(name || "")).toLowerCase());
}

export function applySecurityHeaders(req, res) {
  const dev = process.env.NODE_ENV !== "production";
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src 'self'${dev ? " 'unsafe-inline' 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "media-src 'self' blob: https:",
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
      "connect-src 'self' ws: wss: https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  if (req.headers["x-forwarded-proto"] === "https" || req.socket?.encrypted) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
}

export function guardUpload(url) {
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    return 400;
  }
  const name = path.basename(decoded);
  if (!decoded.startsWith("/uploads/") || decoded.slice("/uploads/".length) !== name || name === "." || name === "..") {
    return 400;
  }
  if (isBlockedUpload(name)) return 403;
  return 0;
}

export function uploadHeaders(url) {
  const name = path.basename(decodeURIComponent(url.split("?")[0]));
  const headers = { "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" };
  if (!INLINE_EXT.has(path.extname(name).toLowerCase())) {
    headers["Content-Disposition"] = `attachment; filename="${name.replace(/["\r\n]/g, "")}"`;
  }
  return headers;
}

function clientKey(req) {
  return req.socket?.remoteAddress || "local";
}

export function loginLimited(req) {
  const now = Date.now();
  const list = (attempts.get(clientKey(req)) || []).filter((time) => now - time < WINDOW_MS);
  attempts.set(clientKey(req), list);
  return list.length >= LOGIN_LIMIT;
}

export function noteLogin(req, ok) {
  const key = clientKey(req);
  if (ok) {
    attempts.delete(key);
    return;
  }
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((time) => now - time < WINDOW_MS);
  list.push(now);
  attempts.set(key, list);
}

function secureCookie(req) {
  return req.headers["x-forwarded-proto"] === "https" || req.socket?.encrypted ? "; Secure" : "";
}

export function readSessionCookie(req) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === "kn-session") return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function sessionCookie(token, req) {
  return `kn-session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1209600${secureCookie(req)}`;
}

export function clearSessionCookie(req) {
  return `kn-session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie(req)}`;
}
