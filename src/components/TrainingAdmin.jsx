import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { placeFile } from "../media";
import { queueTraining, watchTrainingJobs } from "../trainingJobs";
import { Button, FilePick, SuccessPop, uploadFailed } from "./ui";

const inputClass = "h-11 w-full rounded-md border bg-card px-3 text-sm outline-none ring-ring focus:ring-2";

const emptyQuestion = () => ({ prompt: "", options: ["", "", "", ""], correctIndex: 0 });

export default function TrainingAdmin() {
  const [trainings, setTrainings] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(null);
  const [form, setForm] = useState({ title: "", category: "Обука", description: "", duration: "180 минути", format: "Онлајн", level: "Сите нивоа", status: "Отворена", module: 1, driveLink: "" });
  const [editing, setEditing] = useState(null);
  const [course, setCourse] = useState(null);
  const [editPulse, setEditPulse] = useState(0);
  const [quizPulse, setQuizPulse] = useState(0);
  const [quizNote, setQuizNote] = useState("");
  const courseRef = useRef(null);
  const quizRef = useRef(null);
  const [questions, setQuestions] = useState([]);

  function load() {
    return api.trainings().then((data) => setTrainings(data.trainings));
  }

  useEffect(() => {
    if (!course || !courseRef.current) return;
    const node = courseRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    node.focus({ preventScroll: true });
  }, [editPulse]);

  useEffect(() => {
    if (!quizPulse || !quizRef.current) return;
    const node = quizRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    node.focus({ preventScroll: true });
  }, [quizPulse]);

  useEffect(() => {
    load().catch((reason) => setError(reason.message));
    let seen = [];
    return watchTrainingJobs((next) => {
      const finished = next.some((job) => job.done && !job.error && !seen.some((item) => item.id === job.id && item.done));
      seen = next;
      if (finished) load().catch(() => {});
    });
  }, []);

  async function run(action, upload = false) {
    setError("");
    setNotice("");
    try {
      await action();
      await load();
    } catch (reason) {
      setError(reason.message);
      if (upload) uploadFailed(reason.message);
    }
  }

  return (
    <div className="grid gap-5">
      {error && <p className="text-sm font-semibold text-brand-urgent">{error}</p>}
      {notice && <p className="text-sm font-semibold text-brand-deep">{notice}</p>}
      <SuccessPop title={done?.title} text={done?.text} onClose={() => setDone(null)} />
      <div className="admin-split">
      <form
        className="panel grid"
        onSubmit={(event) => {
          event.preventDefault();
          const file = event.currentTarget.elements.video.files?.[0];
          const cover = event.currentTarget.elements.cover.files?.[0];
          const title = form.title.trim();
          queueTraining({
            title,
            cover,
            file,
            link: form.driveLink.trim(),
            module: form.module,
            payload: { ...form, title },
            mode: "create",
          });
          setForm({ title: "", category: "Обука", description: "", duration: "180 минути", format: "Онлајн", level: "Сите нивоа", status: "Отворена", module: 1, driveLink: "" });
          event.currentTarget.reset();
          setDone({
            title: "Поставувањето продолжи",
            text: `„${title}“ се поставува во позадина. Може да излезете од админот и да ги проверите другите страници.`,
          });
        }}
      >
        <h2 className="section-heading">Нова обука</h2>
        <input className={inputClass} placeholder="Наслов" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        <textarea className="min-h-28 rounded-md border bg-card px-3 py-2 text-sm" rows={4} placeholder="Опис" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={inputClass} placeholder="Категорија" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
          <input className={`${inputClass} sm:col-span-2`} placeholder="Траење" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} />
          <input className={inputClass} placeholder="Формат" value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value })} />
          <select className={inputClass} value={form.status === "Отворена" ? "Отворена" : "Затворена"} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option>Отворена</option>
            <option>Затворена</option>
          </select>
          <select className={inputClass} value={form.module} onChange={(event) => setForm({ ...form, module: Number(event.target.value) })}>
            <option value={1}>Модул 1</option>
            <option value={2}>Модул 2</option>
          </select>
        </div>
        <span className="text-sm font-medium text-muted-foreground">Нова тема што досега ја нема добива свое сортирање кај обуките. Празното место го задржува истиот текст.</span>
        <div className="text-sm font-bold text-brand-deep">
          Cover слика
          <FilePick name="cover" accept="image/jpeg,image/png,image/webp,image/gif" />
          <span className="mt-1 block font-medium text-muted-foreground">Се појавува на картичката на обуката. Ако не се прикачи, останува подготвената слика.</span>
        </div>
        <div className="text-sm font-bold text-brand-deep">
          Видео на обуката
          <FilePick name="video" accept="video/mp4,video/webm,video/quicktime" />
          <input className={`${inputClass} mt-2`} placeholder="или јавен Google Drive линк до снимката" value={form.driveLink} onChange={(event) => setForm({ ...form, driveLink: event.target.value })} />
          <span className="mt-1 block font-medium text-muted-foreground">Директно качување е до 25 MB. За подолга снимка залепете јавен Google Drive линк. Линкот се пушта овде, а фајлот мора да биде споделен со секој што го има линкот.</span>
        </div>
        <Button type="submit">Постави обука</Button>
      </form>

      <section className="panel">
        <h2 className="section-heading">Додадени обуки</h2>
        {trainings.length === 0 && <p className="text-sm text-muted-foreground">Сè уште нема обуки.</p>}
        <div className="added-list divide-y">
        {trainings.map((item) => (
          <div key={item.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <b className="text-brand-deep">{item.title}</b>
                <p className="text-sm text-muted-foreground">{item.category} · Модул {item.module || 1} · {item.status} · {item.videoUrl ? "со видео" : "без видео"}</p>
                <div className="mt-2">
                  <span className="block text-xs font-bold text-brand-deep">Смени cover</span>
                  <FilePick
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(event) => {
                      const cover = event.target.files?.[0];
                      event.target.value = "";
                      if (!cover) return;
                      run(async () => {
                        if (!cover.type.startsWith("image/")) throw new Error("Cover мора да биде слика.");
                        const saved = await placeFile(cover);
                        const body = saved.url ? { image: saved.url } : { coverData: saved.data, coverName: cover.name };
                        await api.updateTraining(item.id, body);
                      });
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="h-9 rounded-md border bg-card px-2 text-sm font-bold text-brand-deep"
                  value={item.module || 1}
                  onChange={(event) => run(() => api.updateTraining(item.id, { module: Number(event.target.value) }))}
                >
                  <option value={1}>Модул 1</option>
                  <option value={2}>Модул 2</option>
                </select>
                <button type="button" className="row-delete" onClick={() => run(() => api.deleteTraining(item.id))}>Избриши</button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCourse({
                      id: item.id,
                      title: item.title || "",
                      category: item.category || "",
                      description: item.description || "",
                      duration: item.duration || "",
                      format: item.format || "",
                      level: item.level || "Сите нивоа",
                      status: item.status === "Затворена" ? "Затворена" : "Отворена",
                      module: item.module || 1,
                      videoLink: "",
                    });
                    setEditPulse((value) => value + 1);
                  }}
                >
                  Уреди
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => run(async () => {
                    const data = await api.training(item.id);
                    setQuizNote("");
                    setEditing(data.training);
                    setQuestions(data.training.questions.length ? data.training.questions.map((question) => ({
                      prompt: question.prompt,
                      options: Array.isArray(question.options) ? question.options : ["", "", "", ""],
                      correctIndex: question.correctIndex ?? 0,
                    })) : [emptyQuestion()]);
                    setQuizPulse((value) => value + 1);
                  })}
                >
                  Тест
                </Button>
              </div>
            </div>
          </div>
        ))}
        </div>
      </section>
      </div>

      {course && (
        <form
          key={`${course.id}-${editPulse}`}
          ref={courseRef}
          tabIndex={-1}
          className="panel edit-arrive grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const file = event.currentTarget.elements.video.files?.[0];
            const cover = event.currentTarget.elements.cover.files?.[0];
            const title = course.title.trim();
            queueTraining({
              title,
              cover,
              file,
              link: course.videoLink.trim(),
              module: course.module,
              id: course.id,
              mode: "edit",
              payload: {
                title,
                category: course.category,
                description: course.description,
                duration: course.duration,
                format: course.format,
                level: course.level,
                status: course.status,
                module: Number(course.module),
              },
            });
            setCourse(null);
            setDone({
              title: "Зачувувањето продолжи",
              text: `„${title}“ се зачувува во позадина. Може да ги проверите другите страници.`,
            });
          }}
        >
          <h2 className="section-heading">Уреди „{course.title}“</h2>
          <input className={inputClass} placeholder="Наслов" value={course.title} onChange={(event) => setCourse({ ...course, title: event.target.value })} required />
          <textarea className="min-h-28 rounded-md border bg-card px-3 py-2 text-sm" rows={4} placeholder="Опис" value={course.description} onChange={(event) => setCourse({ ...course, description: event.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={inputClass} placeholder="Категорија" value={course.category} onChange={(event) => setCourse({ ...course, category: event.target.value })} />
            <input className={inputClass} placeholder="Траење" value={course.duration} onChange={(event) => setCourse({ ...course, duration: event.target.value })} />
            <input className={inputClass} placeholder="Формат" value={course.format} onChange={(event) => setCourse({ ...course, format: event.target.value })} />
            <select className={inputClass} value={course.status} onChange={(event) => setCourse({ ...course, status: event.target.value })}>
              <option>Отворена</option>
              <option>Затворена</option>
            </select>
            <select className={inputClass} value={course.module} onChange={(event) => setCourse({ ...course, module: Number(event.target.value) })}>
              <option value={1}>Модул 1</option>
              <option value={2}>Модул 2</option>
            </select>
          </div>
          <div className="text-sm font-bold text-brand-deep">
            Нова cover слика
            <FilePick name="cover" accept="image/jpeg,image/png,image/webp,image/gif" />
            <span className="mt-1 block font-medium text-muted-foreground">Ако не изберете нова, останува сегашната.</span>
          </div>
          <div className="text-sm font-bold text-brand-deep">
            Нова снимка
            <FilePick name="video" accept="video/mp4,video/webm,video/quicktime" />
            <input className={`${inputClass} mt-2`} placeholder="или јавен Google Drive линк. Се пушта овде, не на Drive." value={course.videoLink} onChange={(event) => setCourse({ ...course, videoLink: event.target.value })} />
            <span className="mt-1 block font-medium text-muted-foreground">Директно качување е до 25 MB. За подолга снимка залепете јавен Google Drive линк. Празно поле ја остава сегашната снимка.</span>
          </div>
          <div className="flex gap-2">
            <Button type="submit">Зачувај</Button>
            <Button type="button" variant="outline" onClick={() => setCourse(null)}>Откажи</Button>
          </div>
        </form>
      )}

      {editing && (
        <form
          key={quizPulse}
          ref={quizRef}
          tabIndex={-1}
          className="panel edit-arrive grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setQuizNote("");
            setError("");
            const incomplete = !questions.length || questions.some((question) => !question.prompt.trim() || question.options.some((option) => !String(option).trim()));
            if (incomplete) {
              setQuizNote("Секое прашање треба текст и 4 пополнети одговори. Означете го точниот.");
              return;
            }
            try {
              await api.saveQuiz(editing.id, questions);
              setQuizNote("Тестот е зачуван.");
            } catch (reason) {
              setQuizNote(reason.message);
            }
          }}
        >
          <h2 className="section-heading">Тест за „{editing.title}“</h2>
          <div className="added-list grid gap-4">
          {questions.map((question, index) => (
            <fieldset key={index} className="grid gap-2 rounded-md border p-3">
              <input className={inputClass} placeholder="Прашање" value={question.prompt} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item))} />
              {question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${index}`} checked={question.correctIndex === optionIndex} onChange={() => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, correctIndex: optionIndex } : item))} />
                  <input className={inputClass} placeholder={`Одговор ${optionIndex + 1}`} value={option} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, options: item.options.map((value, valueIndex) => valueIndex === optionIndex ? event.target.value : value) } : item))} />
                </label>
              ))}
              <button type="button" className="row-delete w-fit" onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Отстрани прашање</button>
            </fieldset>
          ))}
          </div>
          {quizNote && <p className={`text-sm font-semibold ${quizNote === "Тестот е зачуван." ? "text-brand-deep" : "text-brand-urgent"}`}>{quizNote}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setQuestions((current) => [...current, emptyQuestion()])}>Додај прашање</Button>
            <Button type="submit">Зачувај тест</Button>
          </div>
        </form>
      )}
    </div>
  );
}
