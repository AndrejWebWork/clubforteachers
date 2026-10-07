import { getToken } from "./api";

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
      let payload = {};
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = {};
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(payload.error || "Качувањето не успеа."));
        return;
      }
      resolve(payload);
    };
    xhr.onerror = () => reject(new Error("Качувањето не успеа."));
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
  if (!response.ok) return null;
  return response.json();
}

export async function uploadVideoFile(file, onProgress) {
  if (!file) return "";
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
