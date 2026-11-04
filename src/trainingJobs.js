import { api } from "./api";
import { placeFile, uploadStatus, uploadVideoFile } from "./media";

let jobs = [];
const listeners = new Set();

function publish() {
  const snapshot = jobs.map((job) => ({ ...job }));
  listeners.forEach((listener) => listener(snapshot));
}

export function watchTrainingJobs(listener) {
  listeners.add(listener);
  listener(jobs.map((job) => ({ ...job })));
  return () => listeners.delete(listener);
}

function patch(id, next) {
  jobs = jobs.map((job) => (job.id === id ? { ...job, ...next } : job));
  publish();
}

export function dismissTrainingJob(id) {
  jobs = jobs.filter((job) => job.id !== id);
  publish();
}

async function attachMedia(payload, { cover, file, link, module, onProgress }) {
  if (cover) {
    if (!cover.type.startsWith("image/")) throw new Error("Cover мора да биде слика.");
    onProgress("Се качува cover сликата…");
    const saved = await placeFile(cover);
    if (saved.url) payload.image = saved.url;
    else if (saved.data) {
      payload.coverData = saved.data;
      payload.coverName = cover.name;
    }
  }
  if (file) payload.videoUrl = await uploadVideoFile(file, (update) => onProgress(uploadStatus(update)));
  else if (link) payload.videoUrl = link;
  if (payload.videoUrl) payload.modulePosition = Number(module) === 2 ? 2 : 1;
}

export function queueTraining({ title, cover, file, link, module, payload, mode, id }) {
  const jobId = `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  jobs = [...jobs, { id: jobId, title, note: "Се поставува во позадина…", error: "", done: false }];
  publish();
  const onProgress = (note) => patch(jobId, { note });
  (async () => {
    const body = { ...payload };
    await attachMedia(body, { cover, file, link, module, onProgress });
    onProgress("Се зачувува обуката…");
    if (mode === "edit") await api.updateTraining(id, body);
    else await api.addTraining(body);
  })()
    .then(() => {
      patch(jobId, { done: true, note: mode === "edit" ? "Промените се зачувани." : "Обуката е поставена." });
      window.setTimeout(() => dismissTrainingJob(jobId), 12000);
    })
    .catch((error) => {
      patch(jobId, { done: true, error: error.message || "Поставувањето не успеа.", note: "" });
    });
  return jobId;
}
