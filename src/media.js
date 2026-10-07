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

export async function uploadVideoFile(file, onProgress) {
  if (!file) return "";
  const token = getToken();
  const auth = token ? { Authorization: `Bearer ${token}` } : {};
  const saved = await sendFile({
    url: "/api/media/video",
    method: "POST",
    file,
    headers: { ...auth, "X-File-Name": encodeURIComponent(file.name || "video.mp4") },
    onProgress,
  });
  return saved.url;
}
