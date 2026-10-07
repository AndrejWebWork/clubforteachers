import { clubApiMiddleware } from "../server/clubDb.mjs";

export const config = {
  api: { bodyParser: false },
};

const club = clubApiMiddleware();

export default function handler(req, res) {
  const incoming = String(req.url || "");
  if (!incoming.startsWith("/api/")) {
    const original = String(req.headers["x-vercel-original-url"] || req.headers["x-invoke-path"] || "");
    if (original.startsWith("/api/")) req.url = original;
  }
  return club(req, res, () => {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Непозната патека." }));
  });
}
