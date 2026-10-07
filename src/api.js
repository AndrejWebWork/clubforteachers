import { digestPassword, sealPassword } from "./password";
import { visitorId } from "./visitor";

const TOKEN_KEY = "kn-token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Барањето не успеа.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  me: () => request("/api/me"),
  updateProfile: (body) => request("/api/me", { method: "PATCH", body }),
  login: async (email, password) => {
    const { salt } = await request("/api/login/salt", { method: "POST", body: { email } });
    const digest = await digestPassword(salt, password);
    return request("/api/login", { method: "POST", body: { email, digest } });
  },
  logout: () => request("/api/logout", { method: "POST", body: {} }),
  posts: () => request("/api/posts"),
  createPost: (body) => request("/api/posts", { method: "POST", body }),
  reply: (id, text) => request(`/api/posts/${id}/replies`, { method: "POST", body: { text } }),
  viewPost: (id) => request(`/api/posts/${id}/view`, { method: "POST", body: { visitor: visitorId() } }),
  notifications: () => request("/api/notifications", { method: "POST", body: { visitor: visitorId() } }),
  seeFeed: (kind) => request("/api/feeds/seen", { method: "POST", body: { kind, visitor: visitorId() } }),
  notices: () => request("/api/notices"),
  addNotice: (body) => request("/api/notices", { method: "POST", body }),
  calendar: () => request("/api/calendar"),
  addCalendar: (body) => request("/api/calendar", { method: "POST", body }),
  events: () => request("/api/events"),
  addEvent: (body) => request("/api/events", { method: "POST", body }),
  deleteEvent: (id) => request(`/api/events/${id}`, { method: "DELETE" }),
  pushKey: () => request("/api/push/key"),
  deletePost: (id) => request(`/api/posts/${id}`, { method: "DELETE" }),
  accounts: () => request("/api/accounts"),
  createAccount: async (body) => {
    const { password, ...rest } = body;
    const passwordHash = await sealPassword(password);
    return request("/api/accounts", { method: "POST", body: { ...rest, passwordHash } });
  },
  importAccounts: async (file) => {
    if (file.name.toLowerCase().endsWith(".docx")) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      const step = 0x8000;
      for (let index = 0; index < bytes.length; index += step) {
        binary += String.fromCharCode(...bytes.subarray(index, index + step));
      }
      return request("/api/accounts/import", { method: "POST", body: { name: file.name, data: btoa(binary) } });
    }
    return request("/api/accounts/import", { method: "POST", body: { name: file.name, text: await file.text() } });
  },
  setRole: (id, role) => request(`/api/accounts/${id}`, { method: "PATCH", body: { role } }),
  mediaStorage: () => request("/api/media/storage"),
  videos: () => request("/api/videos"),
  addVideo: (body) => request("/api/videos", { method: "POST", body }),
  deleteVideo: (id) => request(`/api/videos/${id}`, { method: "DELETE" }),
  attachments: () => request("/api/attachments"),
  addAttachment: (body) => request("/api/attachments", { method: "POST", body }),
  deleteAttachment: (id) => request(`/api/attachments/${id}`, { method: "DELETE" }),
  mail: () => request("/api/mail"),
  sendMail: (body) => request("/api/mail", { method: "POST", body }),
  resources: () => request("/api/resources"),
  addResource: (body) => request("/api/resources", { method: "POST", body }),
  downloadResource: (id) => request(`/api/resources/${id}/download`, { method: "POST", body: { visitor: visitorId() } }),
  documents: () => request("/api/documents"),
  addDocument: (body) => request("/api/documents", { method: "POST", body }),
  downloadDocument: (id) => request(`/api/documents/${id}/download`, { method: "POST", body: { visitor: visitorId() } }),
  trainings: () => request("/api/trainings"),
  training: (id) => request(`/api/trainings/${id}`),
  addTraining: (body) => request("/api/trainings", { method: "POST", body }),
  updateTraining: (id, body) => request(`/api/trainings/${id}`, { method: "PATCH", body }),
  saveQuiz: (id, questions) => request(`/api/trainings/${id}/quiz`, { method: "PUT", body: { questions } }),
  submitQuiz: (id, answers) => request(`/api/trainings/${id}/quiz`, { method: "POST", body: { answers } }),
  saveProgress: (id, body) => request(`/api/trainings/${id}/progress`, { method: "POST", body }),
  certificate: (id) => request(`/api/trainings/${id}/certificate`),
  invite: (email) => request("/api/invitations", { method: "POST", body: { email } }),
};
