import { getToken } from "./api";

const LARGE_VIDEO = 800 * 1024 * 1024;

function uploadError(xhr) {
  if (!xhr.status) return "Прелистувачот не стигна до складот.";
  let payload = {};
  try {
    payload = JSON.parse(xhr.responseText);
  } catch {
    payload = {};
  }
  if (payload.error) return payload.error;
  const code = String(xhr.responseText || "").match(/<Code>([^<]+)<\/Code>/)?.[1] || "";
  if (code === "EntityTooLarge" || xhr.status === 413) return "Датотеката е преголема за едно качување.";
  if (xhr.status === 403 || code === "AccessDenied" || code === "SignatureDoesNotMatch") return "Складот ја одби датотеката.";
  return "Качувањето не успеа.";
}

function sendFile({ url, method, file, headers, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([key, value]) => {
      if (value) xhr.setRequestHeader(key, value);
    });
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(uploadError(xhr)));
        return;
      }
      let payload = {};
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = {};
      }
      resolve(payload);
    };
    xhr.onerror = () => reject(new Error("Прелистувачот не стигна до складот."));
    xhr.send(file);
  });
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function ticket(path, name) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name: name || "datoteka" }),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;
  if (response.status === 400 || response.status === 404) return null;
  throw new Error(payload.error || "Качувањето не успеа.");
}

function sendPart(url, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded);
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(uploadError(xhr)));
        return;
      }
      resolve(xhr.getResponseHeader("etag") || xhr.getResponseHeader("ETag") || "");
    };
    xhr.onerror = () => reject(new Error("Прелистувачот не стигна до складот."));
    xhr.send(blob);
  });
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Качувањето не успеа.");
  return payload;
}

async function uploadLargeVideo(file, onProgress) {
  const opened = await postJson("/api/media/upload/start", { name: file.name || "video.mp4", size: file.size });
  const tags = [];
  let sent = 0;
  try {
    for (const part of opened.parts) {
      const etag = await sendPart(part.url, file.slice(part.start, part.end), (loaded) => {
        if (onProgress) onProgress(Math.min(99, Math.round(((sent + loaded) / file.size) * 100)));
      });
      if (!etag) throw new Error("Качувањето не успеа.");
      sent += part.end - part.start;
      tags.push({ partNumber: part.partNumber, etag });
    }
    const finished = await postJson("/api/media/upload/finish", { key: opened.key, uploadId: opened.uploadId, parts: tags });
    if (onProgress) onProgress(100);
    return finished.url;
  } catch (error) {
    await postJson("/api/media/upload/abort", { key: opened.key, uploadId: opened.uploadId }).catch(() => {});
    throw error;
  }
}

export async function uploadVideoFile(file, onProgress) {
  if (!file) return "";
  if (file.size > LARGE_VIDEO) return uploadLargeVideo(file, onProgress);
  const granted = await ticket("/api/media/ticket", file.name || "video.mp4");
  if (granted?.uploadUrl) {
    await sendFile({
      url: granted.uploadUrl,
      method: "PUT",
      file,
      headers: { "Content-Type": file.type || "video/mp4" },
      onProgress,
    });
    return granted.publicUrl;
  }
  const saved = await sendFile({
    url: "/api/media/video",
    method: "POST",
    file,
    headers: { ...authHeaders(), "X-File-Name": encodeURIComponent(file.name || "video.mp4") },
    onProgress,
  });
  return saved.url;
}

export async function placeFile(file) {
  if (!file) return {};
  const granted = await ticket("/api/media/file-ticket", file.name || "datoteka");
  if (granted?.uploadUrl) {
    await sendFile({
      url: granted.uploadUrl,
      method: "PUT",
      file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });
    return { url: granted.publicUrl, name: file.name, size: file.size };
  }
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Датотеката не може да се прочита."));
    reader.readAsDataURL(file);
  });
  return { data, name: file.name, size: file.size };
}
