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

function presign({ config, method, key, expires }) {
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

async function signedCall(config, method, resource, payload = "") {
  const host = config.host;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = createHash("sha256").update(payload).digest("hex");
  const canonical = [method, resource, "", `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`, "host;x-amz-content-sha256;x-amz-date", payloadHash].join("\n");
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, createHash("sha256").update(canonical).digest("hex")].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretKey, dateStamp, config.region)).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`;
  return fetch(`https://${host}${resource}`, {
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
  if (names.includes(config.bucket)) return;
  const created = await signedCall(config, "PUT", `/${config.bucket}`);
  if (!created.ok && created.status !== 409) {
    const detail = await created.text();
    const code = detail.match(/<Code>([^<]+)<\/Code>/)?.[1] || "bucket-create";
    throw Object.assign(new Error(code), { status: 502 });
  }
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
  if (!/^videos\/[\w.\-]+$/.test(key)) return "";
  return key;
}

export function videoTicket(config, originalName) {
  const key = videoKey(originalName);
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
