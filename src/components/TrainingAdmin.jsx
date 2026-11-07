import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { defaultEvalQuestions, emptyEvalQuestion } from "../evalQuestions";
import { placeFile } from "../media";
import { queueCourse, queueTraining, watchTrainingJobs } from "../trainingJobs";
import { Button, FilePick, SuccessPop, uploadFailed } from "./ui";

const inputClass = "h-11 w-full rounded-md border bg-card px-3 text-sm outline-none ring-ring focus:ring-2";

const emptyQuestion = (module = 1) => ({ prompt: "", options: ["", "", "", ""], correctIndex: 0, module });
const blankWizard = () => ({
  title: "",
  description: "",
  duration: "180 минути",
  format: "Онлајн",
  status: "Отворена",
  certificateLine: "",
  m1: { blurb: "", link: "" },
  m2: { blurb: "", link: "" },
  q1: Array.from({ length: 10 }, () => emptyQuestion(1)),
  q2: Array.from({ length: 10 }, () => emptyQuestion(2)),
  eval: defaultEvalQuestions(),
});

function EvalFields({ items, onChange }) {
  function patch(index, next) {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item));
  }
  return (
    <div className="grid max-h-[28rem] gap-3 overflow-auto">
      {items.map((question, index) => (
        <fieldset key={index} className="grid gap-2 rounded-md border p-3">
          <select className={inputClass} value={question.kind} onChange={(event) => patch(index, { kind: event.target.value, options: event.target.value === "choice" ? (question.options?.length ? question.options : ["", ""]) : [] })}>
            <option value="rating">Оценка 1–5</option>
            <option value="choice">Избор</option>
            <option value="text">Слободен одговор</option>
          </select>
          <input className={inputClass} placeholder={`Прашање ${index + 1}`} value={question.prompt} onChange={(event) => patch(index, { prompt: event.target.value })} />
          {question.kind === "choice" && (question.options || []).map((option, optionIndex) => (
            <input
              key={optionIndex}
              className={inputClass}
              placeholder={`Одговор ${optionIndex + 1}`}
              value={option}
              onChange={(event) => patch(index, { options: question.options.map((value, valueIndex) => valueIndex === optionIndex ? event.target.value : value) })}
            />
          ))}
          {question.kind === "choice" && (
            <button type="button" className="see-all w-fit" onClick={() => patch(index, { options: [...(question.options || []), ""] })}>Додај одговор</button>
          )}
          <button type="button" className="row-delete w-fit" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Отстрани прашање</button>
        </fieldset>
      ))}
    </div>
  );
}

export default function TrainingAdmin() {
  const [trainings, setTrainings] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(null);
  const [step, setStep] = useState(1);
  const [wizard, setWizard] = useState(blankWizard);
  const [results, setResults] = useState(null);
  const coverRef = useRef(null);
  const file1 = useRef(null);
  const file2 = useRef(null);
  const certRef = useRef(null);
  const wizardFormRef = useRef(null);
  const [coverFile, setCoverFile] = useState(null);
  const [video1, setVideo1] = useState(null);
  const [video2, setVideo2] = useState(null);
  const [templateFile, setTemplateFile] = useState(null);
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
    const node = wizardFormRef.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [step]);

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
        ref={wizardFormRef}
        className="panel grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (step < 7) {
            setStep(step + 1);
            return;
          }
          const ready = [...wizard.q1, ...wizard.q2].every((question) => question.prompt.trim() && question.options.every((option) => option.trim()));
          if (!ready) {
            setError("Секој модул има 10 прашања, со текст и 4 одговори.");
            return;
          }
          const evalReady = wizard.eval.filter((item) => item.prompt.trim());
          if (evalReady.length < 3) {
            setError("Ставете најмалку три прашања за евалуација.");
            return;
          }
          const title = wizard.title.trim();
          queueCourse({
            title,
            info: {
              title,
              category: "Обука",
              description: wizard.description,
              duration: wizard.duration,
              format: wizard.format,
              level: "Сите нивоа",
              status: wizard.status,
              certificateLine: wizard.certificateLine,
            },
            module1: { blurb: wizard.m1.blurb, link: wizard.m1.link.trim(), file: video1 || file1.current?.files?.[0], cover: coverFile || coverRef.current?.files?.[0] },
            module2: { blurb: wizard.m2.blurb, link: wizard.m2.link.trim(), file: video2 || file2.current?.files?.[0] },
            questions: [...wizard.q1, ...wizard.q2],
            evalQuestions: evalReady,
            template: templateFile || certRef.current?.files?.[0],
          });
          setWizard(blankWizard());
          setStep(1);
          setCoverFile(null);
          setVideo1(null);
          setVideo2(null);
          setTemplateFile(null);
          if (coverRef.current) coverRef.current.value = "";
          if (file1.current) file1.current.value = "";
          if (file2.current) file2.current.value = "";
          if (certRef.current) certRef.current.value = "";
          setDone({ title: "Обуката се објавува", text: `„${title}“ се поставува. Ќе се појави кај Обуки кога ќе заврши качувањето.` });
        }}
      >
        <h2 className="section-heading">Нова обука · чекор {step} од 7</h2>
        <p className="text-sm text-muted-foreground">Податоци, два модула, два теста, евалуација, па шаблон за сертификат. Наставникот оди модул, тест со 80%, следен модул, тест, евалуација и сертификат.</p>
        <div className={step === 1 ? "grid gap-3" : "hidden"}>
            <input className={inputClass} placeholder="Наслов" value={wizard.title} onChange={(event) => setWizard({ ...wizard, title: event.target.value })} required={step === 1} />
            <textarea className="min-h-28 rounded-md border bg-card px-3 py-2 text-sm" rows={4} placeholder="Опис на обуката" value={wizard.description} onChange={(event) => setWizard({ ...wizard, description: event.target.value })} />
            <input className={inputClass} placeholder="Траење" value={wizard.duration} onChange={(event) => setWizard({ ...wizard, duration: event.target.value })} />
            <input className={inputClass} placeholder="Формат" value={wizard.format} onChange={(event) => setWizard({ ...wizard, format: event.target.value })} />
            <select className={inputClass} value={wizard.status} onChange={(event) => setWizard({ ...wizard, status: event.target.value })}>
              <option>Отворена</option>
              <option>Затворена</option>
            </select>
            <div className="text-sm font-bold text-brand-deep">
              Cover слика
              <FilePick inputRef={coverRef} accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} />
            </div>
        </div>
        <div className={step === 2 ? "grid gap-3" : "hidden"}>
            <h3 className="font-bold text-brand-deep">Модул 1</h3>
            <textarea className="min-h-20 rounded-md border bg-card px-3 py-2 text-sm" rows={3} placeholder="Краток опис на модулот" value={wizard.m1.blurb} onChange={(event) => setWizard({ ...wizard, m1: { ...wizard.m1, blurb: event.target.value } })} />
            <FilePick inputRef={file1} accept="video/mp4,video/webm,video/quicktime" onChange={(event) => setVideo1(event.target.files?.[0] || null)} />
            <input className={inputClass} placeholder="или јавен Google Drive линк" value={wizard.m1.link} onChange={(event) => setWizard({ ...wizard, m1: { ...wizard.m1, link: event.target.value } })} />
            <span className="text-sm text-muted-foreground">Директно качување е до 500 MB.</span>
        </div>
        <div className={step === 3 ? "grid gap-3" : "hidden"}>
            <h3 className="font-bold text-brand-deep">Модул 2</h3>
            <textarea className="min-h-20 rounded-md border bg-card px-3 py-2 text-sm" rows={3} placeholder="Краток опис на модулот" value={wizard.m2.blurb} onChange={(event) => setWizard({ ...wizard, m2: { ...wizard.m2, blurb: event.target.value } })} />
            <FilePick inputRef={file2} accept="video/mp4,video/webm,video/quicktime" onChange={(event) => setVideo2(event.target.files?.[0] || null)} />
            <input className={inputClass} placeholder="или јавен Google Drive линк" value={wizard.m2.link} onChange={(event) => setWizard({ ...wizard, m2: { ...wizard.m2, link: event.target.value } })} />
        </div>
        {(step === 4 || step === 5) && (
          <div className="grid max-h-[28rem] gap-3 overflow-auto">
            <h3 className="font-bold text-brand-deep">Тест · модул {step === 4 ? 1 : 2} · 10 прашања</h3>
            {(step === 4 ? wizard.q1 : wizard.q2).map((question, index) => (
              <fieldset key={index} className="grid gap-2 rounded-md border p-3">
                <input className={inputClass} placeholder={`Прашање ${index + 1}`} value={question.prompt} onChange={(event) => {
                  const key = step === 4 ? "q1" : "q2";
                  setWizard({ ...wizard, [key]: wizard[key].map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item) });
                }} />
                {question.options.map((option, optionIndex) => (
                  <label key={optionIndex} className="flex items-center gap-2">
                    <input type="radio" name={`w-${step}-${index}`} checked={question.correctIndex === optionIndex} onChange={() => {
                      const key = step === 4 ? "q1" : "q2";
                      setWizard({ ...wizard, [key]: wizard[key].map((item, itemIndex) => itemIndex === index ? { ...item, correctIndex: optionIndex } : item) });
                    }} />
                    <input className={inputClass} placeholder={`Одговор ${optionIndex + 1}`} value={option} onChange={(event) => {
                      const key = step === 4 ? "q1" : "q2";
                      setWizard({ ...wizard, [key]: wizard[key].map((item, itemIndex) => itemIndex === index ? { ...item, options: item.options.map((value, valueIndex) => valueIndex === optionIndex ? event.target.value : value) } : item) });
                    }} />
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        )}
        {step === 6 && (
          <>
            <h3 className="font-bold text-brand-deep">Прашања за евалуација</h3>
            <p className="text-sm text-muted-foreground">Наставникот ги одговара по тестот на модул 2, пред да го добие сертификатот.</p>
            <EvalFields items={wizard.eval} onChange={(evalQuestions) => setWizard({ ...wizard, eval: evalQuestions })} />
            <Button type="button" variant="outline" onClick={() => setWizard({ ...wizard, eval: [...wizard.eval, emptyEvalQuestion()] })}>Додај прашање</Button>
          </>
        )}
        <div className={step === 7 ? "grid gap-3" : "hidden"}>
            <h3 className="font-bold text-brand-deep">Шаблон за сертификат</h3>
            <p className="text-sm text-muted-foreground">Вметнете PDF или слика. На шаблонот се запишуваат името, презимето и датумот на издавање.</p>
            <FilePick inputRef={certRef} accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setTemplateFile(event.target.files?.[0] || null)} />
            <input className={inputClass} placeholder="Ред на сертификатот, на пример: за активно учество" value={wizard.certificateLine} onChange={(event) => setWizard({ ...wizard, certificateLine: event.target.value })} />
            <p className="text-sm text-muted-foreground">Со Објави, обуката влегува кај Обуки: два модула, два теста, евалуација и сертификат.</p>
        </div>
        <div className="flex gap-2">
          {step > 1 && <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>Назад</Button>}
          <Button type="submit">{step === 7 ? "Објави" : "Следно"}</Button>
        </div>
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
                  onClick={() => run(async () => {
                    const data = await api.training(item.id);
                    const training = data.training;
                    setCourse({
                      id: item.id,
                      title: training.title || "",
                      category: training.category || "",
                      description: training.description || "",
                      duration: training.duration || "",
                      format: training.format || "",
                      level: training.level || "Сите нивоа",
                      status: training.status === "Затворена" ? "Затворена" : "Отворена",
                      module: training.module || 1,
                      videoLink: "",
                      certificateLine: training.certificateLine || "",
                      evalQuestions: training.evalQuestions?.length ? training.evalQuestions : defaultEvalQuestions(),
                    });
                    setEditPulse((value) => value + 1);
                  })}
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => run(async () => {
                    const data = await api.trainingResults(item.id);
                    setResults({ title: item.title, ...data });
                  })}
                >
                  Резултати
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
            const template = event.currentTarget.elements.template.files?.[0];
            const title = course.title.trim();
            queueTraining({
              title,
              cover,
              file,
              template,
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
                certificateLine: course.certificateLine,
                evalQuestions: (course.evalQuestions || []).filter((item) => item.prompt.trim()),
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
          <h3 className="font-bold text-brand-deep">Прашања за евалуација</h3>
          <EvalFields items={course.evalQuestions || []} onChange={(evalQuestions) => setCourse({ ...course, evalQuestions })} />
          <Button type="button" variant="outline" onClick={() => setCourse({ ...course, evalQuestions: [...(course.evalQuestions || []), emptyEvalQuestion()] })}>Додај прашање</Button>
          <div className="text-sm font-bold text-brand-deep">
            Шаблон за сертификат
            <FilePick name="template" accept="application/pdf,image/jpeg,image/png,image/webp" />
            <input className={`${inputClass} mt-2`} placeholder="Ред на сертификатот" value={course.certificateLine || ""} onChange={(event) => setCourse({ ...course, certificateLine: event.target.value })} />
            <span className="mt-1 block font-medium text-muted-foreground">Ако не изберете нов шаблон, останува сегашниот. На шаблонот се запишуваат име, презиме и датум.</span>
          </div>
          <div className="text-sm font-bold text-brand-deep">
            Нова снимка
            <FilePick name="video" accept="video/mp4,video/webm,video/quicktime" />
            <input className={`${inputClass} mt-2`} placeholder="или јавен Google Drive линк. Се пушта овде, не на Drive." value={course.videoLink} onChange={(event) => setCourse({ ...course, videoLink: event.target.value })} />
            <span className="mt-1 block font-medium text-muted-foreground">Директно качување е до 500 MB. За подолга снимка залепете јавен Google Drive линк. Празно поле ја остава сегашната снимка.</span>
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
          <p className="text-sm text-muted-foreground">Секој модул има свој тест. Наставникот продолжува ако има најмалку 80% точни.</p>
          <div className="added-list grid gap-4">
          {questions.map((question, index) => (
            <fieldset key={index} className="grid gap-2 rounded-md border p-3">
              <select className={inputClass} value={question.module === 2 ? 2 : 1} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, module: Number(event.target.value) } : item))}>
                <option value={1}>Модул 1</option>
                <option value={2}>Модул 2</option>
              </select>
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
            <Button type="button" variant="outline" onClick={() => setQuestions((current) => [...current, emptyQuestion(1)])}>Додај прашање</Button>
            <Button type="submit">Зачувај тест</Button>
          </div>
        </form>
      )}

      {results && (
        <section className="panel grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-heading">Резултати · {results.title}</h2>
            <Button type="button" variant="outline" onClick={() => setResults(null)}>Затвори</Button>
          </div>
          <div>
            <h3 className="font-bold text-brand-deep">Положени тестови</h3>
            {!results.passes?.length && <p className="text-sm text-muted-foreground">Сè уште никој не положил тест.</p>}
            {results.passes?.map((row) => (
              <p key={`${row.email}-${row.module}`} className="text-sm">{row.name} · модул {row.module} · {row.score}%</p>
            ))}
          </div>
          <div>
            <h3 className="font-bold text-brand-deep">Сертификати</h3>
            {!results.certificates?.length && <p className="text-sm text-muted-foreground">Сè уште нема издаден сертификат.</p>}
            {results.certificates?.map((row) => (
              <p key={row.email} className="text-sm">{row.name} · {row.email}</p>
            ))}
          </div>
          <div>
            <h3 className="font-bold text-brand-deep">Евалуација · {results.evaluation?.count || 0} одговори</h3>
            {["ratings", "useful", "recommend"].map((key) => (
              <div key={key} className="mt-2">
                <p className="text-xs font-bold uppercase text-muted-foreground">{key === "ratings" ? "Оценка" : key === "useful" ? "Корисна" : "Препорака"}</p>
                {(results.evaluation?.[key] || []).map((row) => (
                  <p key={row.label} className="text-sm">{row.label}: {row.percent}% ({row.count})</p>
                ))}
              </div>
            ))}
            {(results.evaluation?.answers || []).length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-bold uppercase text-muted-foreground">Одговори</p>
                {results.evaluation.answers.map((row, index) => (
                  <p key={`${row.prompt}-${index}`} className="break-words text-sm"><b>{row.prompt}:</b> {row.value}</p>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
