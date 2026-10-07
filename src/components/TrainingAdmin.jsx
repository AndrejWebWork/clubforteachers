import { useEffect, useState } from "react";
import { api } from "../api";
import { uploadStatus, uploadVideoFile } from "../media";
import { Button, FilePick, SuccessPop, uploadFailed } from "./ui";

const inputClass = "h-11 w-full rounded-md border bg-card px-3 text-sm outline-none ring-ring focus:ring-2";

const emptyQuestion = () => ({ prompt: "", options: ["", "", "", ""], correctIndex: 0 });

export default function TrainingAdmin() {
  const [trainings, setTrainings] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(null);
  const [form, setForm] = useState({ title: "", category: "Обука", description: "", duration: "1 час", format: "Онлајн", level: "Сите нивоа", status: "Отворена" });
  const [editing, setEditing] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [uploadNote, setUploadNote] = useState("");

  function load() {
    return api.trainings().then((data) => setTrainings(data.trainings));
  }

  useEffect(() => {
    load().catch((reason) => setError(reason.message));
  }, []);

  async function run(action, upload = false) {
    setError("");
    setNotice("");
    try {
      await action();
      await load();
    } catch (reason) {
      setUploadNote("");
      setError(reason.message);
      if (upload) uploadFailed(reason.message);
    }
  }

  return (
    <div className="grid gap-5">
      {error && <p className="text-sm font-semibold text-brand-urgent">{error}</p>}
      {notice && <p className="text-sm font-semibold text-brand-deep">{notice}</p>}
      <SuccessPop title={done?.title} text={done?.text} onClose={() => setDone(null)} />
      <form
        className="panel grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const file = event.currentTarget.elements.video.files?.[0];
          const node = event.currentTarget;
          const title = form.title.trim();
          run(async () => {
            const payload = { ...form };
            setUploadNote("");
            if (file) payload.videoUrl = await uploadVideoFile(file, (update) => setUploadNote(uploadStatus(update)));
            await api.addTraining(payload);
            setForm({ title: "", category: "Обука", description: "", duration: "1 час", format: "Онлајн", level: "Сите нивоа", status: "Отворена" });
            setUploadNote("");
            node.reset();
            setDone({
              title: "Обуката е прикачена",
              text: `„${title}“ е успешно поставена и е достапна кај обуките.`,
            });
          }, Boolean(file));
        }}
      >
        <h2 className="section-heading">Нова обука</h2>
        <input className={inputClass} placeholder="Наслов" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        <textarea className="rounded-md border bg-card px-3 py-2 text-sm" rows={3} placeholder="Опис" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={inputClass} placeholder="Категорија" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
          <input className={inputClass} placeholder="Траење" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} />
          <input className={inputClass} placeholder="Формат" value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value })} />
          <select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option>Отворена</option>
            <option>Наскоро</option>
            <option>Завршена</option>
          </select>
        </div>
        <div className="text-sm font-bold text-brand-deep">
          Видео на обуката
          <FilePick name="video" accept="video/mp4,video/webm,video/quicktime" />
          <span className="mt-1 block font-medium text-muted-foreground">Се стеснува до 1080p. Во базата останува само врската, не самиот фајл.</span>
        </div>
        {uploadNote && <p className="text-sm font-bold text-brand-deep">{uploadNote}</p>}
        <Button type="submit">Постави обука</Button>
      </form>

      <section className="panel divide-y">
        {trainings.map((item) => (
          <div key={item.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <b className="text-brand-deep">{item.title}</b>
                <p className="text-sm text-muted-foreground">{item.status} · {item.videoUrl ? "со видео" : "без видео"}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => run(async () => {
                  const data = await api.training(item.id);
                  setEditing(data.training);
                  setQuestions(data.training.questions.length ? data.training.questions.map((question) => ({
                    prompt: question.prompt,
                    options: question.options,
                    correctIndex: question.correctIndex ?? 0,
                  })) : [emptyQuestion()]);
                })}
              >
                Тест
              </Button>
            </div>
          </div>
        ))}
      </section>

      {editing && (
        <form
          className="panel grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              await api.saveQuiz(editing.id, questions);
              setNotice("Тестот е зачуван.");
            });
          }}
        >
          <h2 className="section-heading">Тест за „{editing.title}“</h2>
          {questions.map((question, index) => (
            <fieldset key={index} className="grid gap-2 rounded-md border p-3">
              <input className={inputClass} placeholder="Прашање" value={question.prompt} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item))} />
              {question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${index}`} checked={question.correctIndex === optionIndex} onChange={() => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, correctIndex: optionIndex } : item))} />
                  <input className={inputClass} placeholder={`Одговор ${optionIndex + 1}`} value={option} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, options: item.options.map((value, valueIndex) => valueIndex === optionIndex ? event.target.value : value) } : item))} />
                </label>
              ))}
              <button type="button" className="text-left text-xs font-bold text-muted-foreground" onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Отстрани прашање</button>
            </fieldset>
          ))}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setQuestions((current) => [...current, emptyQuestion()])}>Додај прашање</Button>
            <Button type="submit">Зачувај тест</Button>
          </div>
        </form>
      )}
    </div>
  );
}
