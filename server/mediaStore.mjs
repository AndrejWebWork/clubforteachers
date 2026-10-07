import { spawn } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

function readEnvFile(root) {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return {};
  const values = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^(FILEBASE_[A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return values;
}

export function mediaConfig(root) {
  const file = readEnvFile(root);
  const value = (key) => process.env[key] || file[key] || "";
  const accessKey = value("FILEBASE_ACCESS_KEY");
  const secretKey = value("FILEBASE_SECRET_KEY");
  const bucket = value("FILEBASE_BUCKET");
  return {
    remote: Boolean(accessKey && secretKey && bucket),
    provider: "filebase",
    accessKey,
    secretKey,
    bucket,
    host: "s3.filebase.io",
    region: "auto",
  };
}

function encodeKey(key) {
  return key.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function signingKey(secret, dateStamp, region) {
  const dateKey = createHmac("sha256", Buffer.from(`AWS4${secret}`)).update(dateStamp).digest();
  const regionKey = createHmac("sha256", dateKey).update(region).digest();
  const serviceKey = createHmac("sha256", regionKey).update("s3").digest();
  return createHmac("sha256", serviceKey).update("aws4_request").digest();
}

function presign({ config, method, key, expires, extra = [] }) {
  const host = config.host;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credential = `${config.accessKey}/${dateStamp}/${config.region}/s3/aws4_request`;
  const canonicalUri = `/${config.bucket}/${encodeKey(key)}`;
  const query = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", credential],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expires)],
    ["X-Amz-SignedHeaders", "host"],
    ...extra,
  ]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([name, item]) => `${encodeURIComponent(name)}=${encodeURIComponent(item)}`)
    .join("&");
  const canonical = [method, canonicalUri, query, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretKey, dateStamp, config.region)).update(stringToSign).digest("hex");
  return `https://${host}${canonicalUri}?${query}&X-Amz-Signature=${signature}`;
}

async function signedCall(config, method, resource, payload = "", query = "") {
  const host = config.host;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = createHash("sha256").update(payload).digest("hex");
  const canonicalQuery = query.split("&").filter(Boolean).map((part) => (part.includes("=") ? part : `${part}=`)).sort().join("&");
  const canonical = [method, resource, canonicalQuery, `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`, "host;x-amz-content-sha256;x-amz-date", payloadHash].join("\n");
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretKey, dateStamp, config.region)).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`;
  return fetch(`https://${host}${resource}${query ? `?${query}` : ""}`, {
    method,
    headers: {
      authorization,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    body: payload || undefined,
  });
}

export async function ensureBucket(config) {
  if (config.provider !== "filebase") return;
  const listed = await signedCall(config, "GET", "/");
  const xml = await listed.text();
  if (!listed.ok) {
    const code = xml.match(/<Code>([^<]+)<\/Code>/)?.[1] || "bucket-list";
    throw Object.assign(new Error(code), { status: 502 });
  }
  const names = [...xml.matchAll(/<Name>([^<]+)<\/Name>/g)].map((match) => match[1]);
  if (!names.includes(config.bucket)) {
  const created = await signedCall(config, "PUT", `/${config.bucket}`);
  if (!created.ok && created.status !== 409) {
    const detail = await created.text();
    const code = detail.match(/<Code>([^<]+)<\/Code>/)?.[1] || "bucket-create";
    throw Object.assign(new Error(code), { status: 502 });
  }
  }
  const cors = `<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration><CORSRule><AllowedOrigin>*</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`;
  await signedCall(config, "PUT", `/${config.bucket}`, cors, "cors");
}

export function videoKey(originalName) {
  const safe = String(originalName || "video.mp4").replace(/[^\w.\-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "video.mp4";
  return `videos/${Date.now()}-${randomBytes(4).toString("hex")}-${safe}`;
}

export function watchPath(key) {
  return `/api/media/file/${encodeURIComponent(key)}`;
}

export function fileKey(token) {
  const key = decodeURIComponent(token || "");
  if (!/^(videos|files)\/[\w.\-]+$/.test(key)) return "";
  return key;
}

export function scratchDir(preferred) {
  try {
    if (!existsSync(preferred)) mkdirSync(preferred, { recursive: true });
    return preferred;
  } catch {
    const fallback = path.join("/tmp", "club-uploads");
    if (!existsSync(fallback)) mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function safeName(name) {
  return String(name || "datoteka").replace(/[^\w.\-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "datoteka";
}

export async function putBytes(config, key, buffer, contentType = "application/octet-stream") {
  const host = config.host;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = createHash("sha256").update(buffer).digest("hex");
  const resource = `/${config.bucket}/${encodeKey(key)}`;
  const canonical = ["PUT", resource, "", `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`, "content-type;host;x-amz-content-sha256;x-amz-date", payloadHash].join("\n");
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretKey, dateStamp, config.region)).update(stringToSign).digest("hex");
  const response = await fetch(`https://${host}${resource}`, {
    method: "PUT",
    headers: {
      authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=${signature}`,
      "content-type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    body: buffer,
  });
  if (!response.ok) throw Object.assign(new Error("remote"), { status: 502 });
}

export async function persistBytes({ root, uploadDir, name, buffer, contentType }) {
  const safe = safeName(name);
  const config = mediaConfig(root);
  if (config.remote) {
    await ensureBucket(config);
    const key = `files/${Date.now()}-${randomBytes(4).toString("hex")}-${safe}`;
    await putBytes(config, key, buffer, contentType || "application/octet-stream");
    return { url: watchPath(key), size: buffer.length, name: safe, key };
  }
  if (process.env.VERCEL) return { error: "Складот за датотеки не е поврзан." };
  const dir = scratchDir(uploadDir);
  const stored = `${Date.now()}-${randomBytes(4).toString("hex")}-${safe}`;
  const { writeFileSync } = await import("node:fs");
  writeFileSync(path.join(dir, stored), buffer);
  return { url: `/uploads/${stored}`, size: buffer.length, name: safe };
}

export async function dropStored(root, uploadDir, url) {
  const config = mediaConfig(root);
  const match = String(url || "").match(/\/api\/media\/file\/([^/?]+)/);
  if (match && config.remote) {
    const key = fileKey(match[1]);
    if (key) await removeStored(config, key).catch(() => {});
    return;
  }
  removeLocalUpload(uploadDir, url);
}

export const LARGE_VIDEO = 800 * 1024 * 1024;

export function videoTicket(config, originalName) {
  const key = videoKey(originalName);
  return {
    uploadUrl: presign({ config, method: "PUT", key, expires: 21600 }),
    publicUrl: watchPath(key),
  };
}

function xmlEscape(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function openLargeUpload(config, originalName, size) {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes < 5 * 1024 * 1024) throw Object.assign(new Error("size"), { status: 400 });
  await ensureBucket(config);
  const key = videoKey(originalName);
  const resource = `/${config.bucket}/${encodeKey(key)}`;
  const opened = await signedCall(config, "POST", resource, "", "uploads");
  const xml = await opened.text();
  const uploadId = xml.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
  if (!opened.ok || !uploadId) throw Object.assign(new Error("remote"), { status: 502 });
  const preferred = 16 * 1024 * 1024;
  const partSize = bytes > preferred * 10000 ? Math.ceil(bytes / 10000) : Math.min(preferred, Math.max(5 * 1024 * 1024, Math.floor(bytes / 2)));
  const count = Math.ceil(bytes / partSize);
  const parts = [];
  for (let index = 0; index < count; index += 1) {
    const start = index * partSize;
    parts.push({
      partNumber: index + 1,
      start,
      end: Math.min(bytes, start + partSize),
      url: presign({
        config,
        method: "PUT",
        key,
        expires: 21600,
        extra: [["partNumber", String(index + 1)], ["uploadId", uploadId]],
      }),
    });
  }
  return { key, uploadId, publicUrl: watchPath(key), parts };
}

export async function finishLargeUpload(config, key, uploadId, parts) {
  if (!/^videos\/[\w.\-]+$/.test(key)) throw Object.assign(new Error("key"), { status: 400 });
  const ordered = [...parts].sort((left, right) => left.partNumber - right.partNumber);
  const body = `<CompleteMultipartUpload>${ordered.map((part) => `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${xmlEscape(part.etag)}</ETag></Part>`).join("")}</CompleteMultipartUpload>`;
  const response = await signedCall(config, "POST", `/${config.bucket}/${encodeKey(key)}`, body, `uploadId=${encodeURIComponent(uploadId)}`);
  if (!response.ok) throw Object.assign(new Error("remote"), { status: 502 });
  return watchPath(key);
}

export async function abortLargeUpload(config, key, uploadId) {
  if (!/^videos\/[\w.\-]+$/.test(String(key)) || !uploadId) return;
  await signedCall(config, "DELETE", `/${config.bucket}/${encodeKey(key)}`, "", `uploadId=${encodeURIComponent(uploadId)}`).catch(() => {});
}

export function fileTicket(config, originalName) {
  const key = `files/${Date.now()}-${randomBytes(4).toString("hex")}-${safeName(originalName)}`;
  return {
    uploadUrl: presign({ config, method: "PUT", key, expires: 3600 }),
    publicUrl: watchPath(key),
  };
}

export function watchUrl(config, key) {
  return presign({ config, method: "GET", key, expires: 43200 });
}

export function saveVideoStream(req, uploadDir, originalName) {
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  const safe = decodeURIComponent(String(originalName || "video.mp4")).replace(/[^\w.\-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "video.mp4";
  const ext = path.extname(safe).toLowerCase();
  if (![".mp4", ".webm", ".ogg", ".mov"].includes(ext)) {
    return Promise.reject(Object.assign(new Error("type"), { status: 400 }));
  }
  const stored = `${Date.now()}-${randomBytes(4).toString("hex")}-${safe}`;
  const target = path.join(uploadDir, stored);
  return new Promise((resolve, reject) => {
    const output = createWriteStream(target);
    let size = 0;
    let failed = false;
    const fail = (error) => {
      if (failed) return;
      failed = true;
      output.destroy();
      req.destroy();
      if (existsSync(target)) unlinkSync(target);
      reject(error);
    };
    req.on("data", (chunk) => {
      size += chunk.length;
      if (!output.write(chunk)) req.pause();
    });
    output.on("drain", () => req.resume());
    req.on("end", () => {
      if (failed) return;
      output.end(() => resolve({ url: `/uploads/${stored}`, path: target, size }));
    });
    req.on("error", fail);
    output.on("error", fail);
  });
}

function runTool(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let detail = "";
    child.stderr.on("data", (chunk) => {
      detail = (detail + chunk.toString()).slice(-1500);
    });
    child.on("error", (error) => {
      if (error.code === "ENOENT") reject(Object.assign(new Error("ffmpeg"), { status: 503 }));
      else reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(Object.assign(new Error(detail || command), { status: 500 }));
    });
  });
}

export async function compressVideo(inputPath) {
  const output = inputPath.replace(/\.[^.]+$/, "") + "-1080.mp4";
  try {
    await runTool("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-vf",
      "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "26",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      output,
    ]);
  } catch (error) {
    if (existsSync(output)) unlinkSync(output);
    throw error;
  }
  const outSize = statSync(output).size;
  const inSize = statSync(inputPath).size;
  if (outSize >= inSize && inputPath.toLowerCase().endsWith(".mp4")) {
    unlinkSync(output);
    return { path: inputPath, size: inSize };
  }
  unlinkSync(inputPath);
  return { path: output, size: outSize };
}

export async function publishVideo(config, filePath) {
  await ensureBucket(config);
  const key = videoKey(path.basename(filePath));
  const size = statSync(filePath).size;
  const response = await fetch(presign({ config, method: "PUT", key, expires: 3600 }), {
    method: "PUT",
    duplex: "half",
    headers: { "content-type": "video/mp4", "content-length": String(size) },
    body: createReadStream(filePath),
  });
  if (!response.ok) throw Object.assign(new Error("remote"), { status: 502 });
  return watchPath(key);
}

export async function removeStored(config, key) {
  const response = await signedCall(config, "DELETE", `/${config.bucket}/${encodeKey(key)}`);
  if (!response.ok && response.status !== 204) throw Object.assign(new Error("remote-delete"), { status: 502 });
}

export function removeLocalUpload(uploadDir, url) {
  if (!url?.startsWith("/uploads/")) return;
  const name = path.basename(url);
  const target = path.join(uploadDir, name);
  if (existsSync(target)) unlinkSync(target);
}
