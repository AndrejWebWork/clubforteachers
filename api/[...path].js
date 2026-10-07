import { clubApiMiddleware } from "../server/clubDb.mjs";

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
};

const club = clubApiMiddleware();

export default function handler(req, res) {
  const parts = [].concat(req.query?.path || []).filter(Boolean);
  if (parts.length && !String(req.url || "").startsWith("/api/")) {
    const query = String(req.url || "").includes("?") ? `?${String(req.url).split("?")[1]}` : "";
    req.url = `/api/${parts.join("/")}${query}`;
  }
  return club(req, res, () => {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Непозната патека." }));
  });
}
