import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Pause, Play, RotateCcw, Volume1, Volume2, VolumeX } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../compositor/AppCompositor";
import { driveVideoPath } from "../driveVideo";
import { evalList, ratingPrompt } from "../evalQuestions";
import { Button, PageHeader } from "../components/ui";

function formatTime(value) {
  const total = Math.max(0, Math.floor(value || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function mediaKind(url) {
  const value = driveVideoPath(url) || String(url || "");
  if (!value) return "none";
  if (value.startsWith("/api/media/file/") || value.startsWith("/api/media/drive/") || value.startsWith("/uploads/")) return "file";
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "file";
  }
  if (/\.(mp4|webm|ogg|mov|m4v)$/i.test(parsed.pathname)) return "file";
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("vimeo.com")) return "embed";
  return "link";
}

function embedSrc(url) {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}`;
  if (host.endsWith("youtube.com")) {
    const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
  }
  if (host.endsWith("vimeo.com")) {
    const id = parsed.pathname.split("/").filter(Boolean).pop();
    return id ? `https://player.vimeo.com/video/${id}` : "";
  }
  return "";
}

export default function TrainingPlayer() {
  const { trainingId } = useParams();
  const navigate = useNavigate();
  const { signedIn, authReady } = useApp();
  const videoRef = useRef(null);
  const furthestRef = useRef(0);
  const pendingRef = useRef(0);
  const lastTick = useRef(0);
  const trainingRef = useRef(null);
  const [training, setTraining] = useState(null);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [length, setLength] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [quizNote, setQuizNote] = useState("");
  const [activeId, setActiveId] = useState("");
  const [awaitingEval, setAwaitingEval] = useState(false);
  const [evalAnswers, setEvalAnswers] = useState([]);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("kn-volume");
    const value = Number(saved);
    return saved !== null && Number.isFinite(value) && value >= 0 && value <= 1 ? value : 1;
  });
  const loudRef = useRef(volume > 0 ? volume : 1);

  useEffect(() => {
    if (!signedIn) return;
    api.training(trainingId)
      .then((data) => {
        document.title = `${data.training.title} · Клуб на наставници`;
        setTraining(data.training);
        furthestRef.current = data.training.progress.furthest;
        setFurthest(data.training.progress.furthest);
        setTime(data.training.progress.position);
        setAnswers(data.training.questions.map(() => -1));
        const first = data.training.modules?.[0];
        if (first) {
          setActiveId(first.id);
          furthestRef.current = first.progress.furthest;
          setFurthest(first.progress.furthest);
          setTime(first.progress.position);
        }
      })
      .catch((reason) => setError(reason.message));
  }, [signedIn, trainingId]);

  const active = training?.modules?.find((item) => item.id === activeId) || training?.modules?.[0] || null;
  trainingRef.current = training;

  function rememberProgress(data, moduleId, position, knownDuration) {
    furthestRef.current = data.furthest;
    setFurthest(data.furthest);
    setTraining((current) => {
      if (!current) return current;
      return {
        ...current,
        modulesReady: data.modulesReady ?? current.modulesReady,
        modules: (current.modules || []).map((item) => item.id === moduleId ? {
          ...item,
          durationSeconds: knownDuration > 1 ? knownDuration : item.durationSeconds,
          progress: { position, furthest: data.furthest },
        } : item),
      };
    });
  }

  function sendProgress(module, video, extra = 0) {
    const current = trainingRef.current;
    if (!module || !current) return Promise.resolve();
    const watched = pendingRef.current + extra;
    pendingRef.current = 0;
    if (watched <= 0) return Promise.resolve();
    const known = Number.isFinite(video?.duration) ? video.duration : 0;
    const position = known > 1 && video?.ended ? known : video?.currentTime || 0;
    return api.saveProgress(current.id, {
      moduleId: module.id,
      position,
      watched,
      duration: known,
    }).then((data) => {
      rememberProgress(data, module.id, position, known);
      if (data.moduleReady) api.training(current.id).then((fresh) => setTraining(fresh.training)).catch(() => {});
      if (video && video.currentTime > data.furthest + 1.5) video.currentTime = data.furthest;
    }).catch(() => {});
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active?.videoUrl) return;
    const place = () => {
      if (Number.isFinite(video.duration)) setLength(video.duration);
      const level = Math.min(1, Math.max(0, Number(localStorage.getItem("kn-volume") ?? 1)));
      video.volume = level;
      video.muted = level === 0;
      const start = Math.min(active.progress.position || 0, furthestRef.current);
      if (Math.abs(video.currentTime - start) > 0.4) video.currentTime = start;
    };
    const guard = () => {
      video.playbackRate = 1;
      if (video.currentTime > furthestRef.current + 0.6) video.currentTime = furthestRef.current;
    };
    const tick = () => {
      if (video.currentTime > furthestRef.current + 0.6) {
        video.currentTime = furthestRef.current;
        setTime(furthestRef.current);
        return;
      }
      setTime(video.currentTime);
      if (!video.paused && video.currentTime <= furthestRef.current + 0.6) {
        const delta = lastTick.current ? Math.max(0, video.currentTime - lastTick.current) : 0;
        if (delta > 0 && delta < 2) pendingRef.current += delta;
        furthestRef.current = Math.max(furthestRef.current, video.currentTime);
        setFurthest(furthestRef.current);
      }
      lastTick.current = video.currentTime;
    };
    video.addEventListener("loadedmetadata", place);
    video.addEventListener("seeking", guard);
    video.addEventListener("seeked", guard);
    video.addEventListener("ratechange", guard);
    video.addEventListener("timeupdate", tick);
    return () => {
      video.removeEventListener("loadedmetadata", place);
      video.removeEventListener("seeking", guard);
      video.removeEventListener("seeked", guard);
      video.removeEventListener("ratechange", guard);
      video.removeEventListener("timeupdate", tick);
    };
  }, [active]);

  useEffect(() => {
    if (!active?.id || mediaKind(active.videoUrl) !== "file") return undefined;
    const module = active;
    const timer = setInterval(() => sendProgress(module, videoRef.current), 4000);
    return () => {
      clearInterval(timer);
      sendProgress(module, videoRef.current);
    };
  }, [active?.id, active?.videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || mediaKind(active?.videoUrl) !== "file") return;
    const level = Math.min(1, Math.max(0, volume));
    video.volume = level;
    video.muted = level === 0;
  }, [volume, active?.id, active?.videoUrl]);

  if (!authReady) return <section className="panel">Се вчитува...</section>;
  if (!signedIn) {
    return (
      <section className="panel max-w-xl">
        <p className="text-sm text-muted-foreground">Пријавете се за да ја следите обуката. Местото каде што ќе застанете се памети.</p>
        <Button asChild className="mt-4"><Link to="/najava">Пријави се на обуката</Link></Button>
      </section>
    );
  }
  if (error) return <section className="panel">{error}</section>;
  if (!training) return <section className="panel">Се вчитува обуката...</section>;

  const duration = length || active?.durationSeconds || 0;
  const passedModules = training.passedModules || [];
  const moduleNo = active?.position === 2 ? 2 : 1;
  const moduleQuestions = (training.questions || []).filter((question) => (question.module || 1) === moduleNo);
  const thisDone = Boolean(active) && (!active.videoUrl || (mediaKind(active.videoUrl) === "file" && playableDone(active)));
  const quizOpen = thisDone && !passedModules.includes(moduleNo) && (moduleNo === 1 || passedModules.includes(1)) && !training.certified;
  const kind = mediaKind(active?.videoUrl);
  const level = Math.min(1, Math.max(0, volume));

  function setLevel(next) {
    const value = Math.min(1, Math.max(0, next));
    if (value > 0) loudRef.current = value;
    setVolume(value);
    localStorage.setItem("kn-volume", String(value));
  }

  function changeVolume(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    setLevel((event.clientX - rect.left) / rect.width);
  }

  function playableDone(item) {
    const seen = item.id === active?.id ? furthest : item.progress?.furthest || 0;
    const total = item.id === active?.id ? duration || item.durationSeconds : item.durationSeconds;
    return total > 1 && seen >= total - 1.5;
  }

  function rewind() {
    const node = videoRef.current;
    if (!node) return;
    node.currentTime = Math.max(0, node.currentTime - 10);
  }

  function toggle() {
    const node = videoRef.current;
    if (!node) return;
    if (node.paused) node.play();
    else node.pause();
    setPlaying(!node.paused);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Button asChild variant="ghost" className="no-print mb-4">
        <Link to="/obuki"><ArrowLeft className="h-4 w-4" /> Назад кон обуките</Link>
      </Button>
      <PageHeader eyebrow={training.category} title={training.title} description={training.description} />
      <div className="mb-4 flex flex-wrap gap-2">
        {(training.modules || []).map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sort-chip ${active?.id === item.id ? "active" : ""}`}
            onClick={() => {
              if (item.position === 2 && !passedModules.includes(1)) return;
              setActiveId(item.id);
              furthestRef.current = item.progress.furthest;
              setFurthest(item.progress.furthest);
              setTime(item.progress.position);
              setLength(item.durationSeconds || 0);
              setPlaying(false);
              lastTick.current = 0;
              setAnswers([]);
              setAwaitingEval(false);
            }}
          >
            {item.title}{item.position === 2 && !passedModules.includes(1) ? " · по тестот на модул 1" : ""}{item.videoUrl ? "" : " · без видео"}{playableDone(item) ? " · изгледан" : ""}{passedModules.includes(item.position) ? " · положен" : ""}
          </button>
        ))}
      </div>
      {active?.blurb && <p className="mb-3 text-sm text-muted-foreground">{active.blurb}</p>}
      <p className="module-note">
        <b>{moduleNo === 2 ? "Модул 2" : "Модул 1"}</b>
        {moduleNo === 2
          ? "Откако ќе ја поминете снимката од Модул 2, ќе ви се појави тест со 10 прашања каде што е потребно да одговорите точно на 80% од прашањата. Потоа треба да пополните форма за евалуација, за на крај да можете да генерирате ваш сертификат."
          : "Потребно е да ја изгледате Модул 1, а потоа ќе ви се појави тест со 10 прашања, каде што е потребно да одговорите точно на 80% од прашањата. Потоа можете да пристапите кон Модул 2."}
      </p>
      {kind === "file" ? (
        <section className="lesson-player">
          <div className="lesson-stage">
            <video
              key={active.id}
              ref={videoRef}
              src={driveVideoPath(active.videoUrl) || active.videoUrl}
              playsInline
              controls={false}
              onClick={toggle}
              onPlay={() => {
                const node = videoRef.current;
                if (node && level > 0) {
                  node.muted = false;
                  node.volume = level;
                }
                setPlaying(true);
              }}
              onPause={() => setPlaying(false)}
              onEnded={() => {
                const node = videoRef.current;
                if (node && Number.isFinite(node.duration)) {
                  furthestRef.current = Math.max(furthestRef.current, node.duration);
                  setFurthest(furthestRef.current);
                  setTime(node.duration);
                }
                setPlaying(false);
                sendProgress(active, node, 1.5);
              }}
              onContextMenu={(event) => event.preventDefault()}
            />
            {!playing && (
              <button type="button" className="lesson-btn lesson-play" onClick={toggle} aria-label="Пушти">
                <Play className="h-7 w-7" />
              </button>
            )}
            <div className="lesson-bar">
              <div className="lesson-volume">
                <button
                  type="button"
                  className="lesson-btn"
                  onClick={() => setLevel(level === 0 ? loudRef.current || 1 : 0)}
                  aria-label={level === 0 ? "Вклучи го гласот" : "Исклучи го гласот"}
                >
                  {level === 0 ? <VolumeX className="h-4 w-4" /> : level < 0.5 ? <Volume1 className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <div
                  className="lesson-track"
                  role="slider"
                  tabIndex={0}
                  aria-label="Глас"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(level * 100)}
                  onPointerDown={(event) => {
                    changeVolume(event);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) changeVolume(event);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowRight" || event.key === "ArrowUp") setLevel(level + 0.05);
                    if (event.key === "ArrowLeft" || event.key === "ArrowDown") setLevel(level - 0.05);
                  }}
                >
                  <span className="lesson-rail" />
                  <span className="lesson-seen" style={{ width: `${level * 100}%` }} />
                  <span className="lesson-head" style={{ left: `${level * 100}%` }} />
                </div>
              </div>
              <div className="lesson-controls">
              <button type="button" className="lesson-btn" onClick={toggle} aria-label={playing ? "Пауза" : "Пушти"}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button type="button" className="lesson-btn" onClick={rewind} aria-label="10 секунди назад">
                <RotateCcw className="h-4 w-4" />
              </button>
              <div
                className="lesson-track"
                role="slider"
                tabIndex={0}
                aria-label="Време на обуката. Напред може да се оди само до прегледаниот дел."
                aria-valuemin={0}
                aria-valuemax={Math.floor(duration || 0)}
                aria-valuenow={Math.floor(Math.min(time, furthest))}
                onPointerDown={(event) => {
                  const node = videoRef.current;
                  const rect = event.currentTarget.getBoundingClientRect();
                  if (!node || !duration || rect.width <= 0) return;
                  const next = ((event.clientX - rect.left) / rect.width) * duration;
                  if (next > furthestRef.current + 0.2) return;
                  node.currentTime = Math.max(0, next);
                  setTime(node.currentTime);
                }}
              >
                <span className="lesson-rail" />
                <span className="lesson-seen" style={{ width: `${duration ? (furthest / duration) * 100 : 0}%` }} />
                <span className="lesson-head" style={{ left: `${duration ? (Math.min(time, furthest) / duration) * 100 : 0}%` }} />
              </div>
              <span className="lesson-time">{formatTime(time)} / {formatTime(duration)} · {Math.round(furthest)} / {duration > 1 ? Math.round(duration) : "…"} сек</span>
              </div>
            </div>
          </div>
          <p>Може да паузирате и да се вратите назад. Напред се оди само со гледање.</p>
        </section>
      ) : kind === "embed" || kind === "link" ? (
        <section className="lesson-player">
          {kind === "embed" && embedSrc(active.videoUrl) ? (
            <iframe className="lesson-frame" src={embedSrc(active.videoUrl)} title={active.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          ) : (
            <div className="lesson-stage lesson-link">
              <p>Снимката е на линк. Отворете ја и изгледајте ја.</p>
              <Button asChild variant="yellow">
                <a href={active.videoUrl} target="_blank" rel="noreferrer">Отвори ја снимката</a>
              </Button>
            </div>
          )}
        </section>
      ) : (
        <section className="panel">
          <p className="leading-7">За {active?.title || "овој модул"} сè уште нема поставено видео.</p>
          {!training.modules?.some((item) => item.videoUrl) && (
            <Button
              className="mt-4"
              type="button"
              onClick={() => api.saveProgress(training.id, { position: 1, watched: 0, completed: true }).then(() => api.training(training.id)).then((fresh) => setTraining(fresh.training))}
            >
              Продолжи кон тестот
            </Button>
          )}
        </section>
      )}

      <section className="panel mt-5">
        <h2 className="section-heading">Тест</h2>
        {!quizOpen && !awaitingEval && (
          <p className="text-sm text-muted-foreground">
            {moduleNo === 2 && !passedModules.includes(1)
              ? "Модул 2 се отвора откако ќе го положите тестот на модул 1."
              : passedModules.includes(moduleNo)
                ? "Овој модул е положен."
                : mediaKind(active?.videoUrl) === "file"
                  ? "Тестот на овој модул се појавува откако видеото ќе биде изгледано до крај."
                  : active?.videoUrl
                    ? "Оваа снимка е надворешен линк. Тестот се отвора само ако видеото се пушта тука."
                    : "Тестот се појавува откако ќе го завршите модулот."}
          </p>
        )}
        {quizOpen && !awaitingEval && moduleQuestions.length === 0 && <p className="text-sm text-muted-foreground">Раководителот сè уште нема поставено тест за овој модул.</p>}
        {awaitingEval && (
          <form
            className="grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setQuizNote("");
              const questions = evalList(training);
              const answers = questions.map((question, index) => ({ prompt: question.prompt, kind: question.kind, options: question.options, value: String(evalAnswers[index] || "").trim() }));
              if (answers.some((item) => !item.value)) {
                setQuizNote("Одговорете на сите прашања за евалуација.");
                return;
              }
              try {
                await api.submitEvaluation(training.id, { answers });
                navigate(`/obuki/${training.id}/sertifikat`);
              } catch (reason) {
                setQuizNote(reason.message);
              }
            }}
          >
            <p className="text-sm font-bold text-brand-deep">Двата теста се положени. Пополнете ја евалуацијата за да се издаде сертификатот.</p>
            {evalList(training).map((question, index) => (
              <label key={`${question.prompt}-${index}`} className="grid gap-1 text-sm font-bold text-brand-deep">
                {question.kind === "rating" ? ratingPrompt(question.prompt) : question.prompt}
                {question.kind === "rating" && (
                  <select className="mt-1 h-11 w-full rounded-md border bg-card px-3 text-sm font-medium" value={evalAnswers[index] || "5"} onChange={(event) => setEvalAnswers((current) => {
                    const next = [...current];
                    next[index] = event.target.value;
                    return next;
                  })}>
                    <option value="5">5 - најмногу</option>
                    <option value="4">4</option>
                    <option value="3">3</option>
                    <option value="2">2</option>
                    <option value="1">1 - најмалку</option>
                  </select>
                )}
                {question.kind === "choice" && (
                  <select className="mt-1 h-11 w-full rounded-md border bg-card px-3 text-sm font-medium" value={evalAnswers[index] || ""} onChange={(event) => setEvalAnswers((current) => {
                    const next = [...current];
                    next[index] = event.target.value;
                    return next;
                  })}>
                    <option value="">Изберете</option>
                    {(question.options || []).map((option) => <option key={option}>{option}</option>)}
                  </select>
                )}
                {question.kind === "text" && (
                  <textarea required rows={4} className="rounded-md border bg-card px-3 py-2 text-sm font-medium" value={evalAnswers[index] || ""} onChange={(event) => setEvalAnswers((current) => {
                    const next = [...current];
                    next[index] = event.target.value;
                    return next;
                  })} />
                )}
              </label>
            ))}
            {quizNote && <p className="text-sm font-semibold text-brand-urgent">{quizNote}</p>}
            <Button type="submit">Испрати евалуација</Button>
          </form>
        )}
        {quizOpen && !awaitingEval && moduleQuestions.length > 0 && (
          <form
            className="quiz-lock grid gap-5"
            onCopy={(event) => event.preventDefault()}
            onCut={(event) => event.preventDefault()}
            onContextMenu={(event) => event.preventDefault()}
            onSubmit={async (event) => {
              event.preventDefault();
              setQuizNote("");
              try {
                const result = await api.submitQuiz(training.id, answers, moduleNo);
                if (!result.passed) {
                  setQuizNote(`Потребни се 80%. Овој обид е ${result.score || 0}%.`);
                  return;
                }
                if (result.nextModule) {
                  setQuizNote("Модул 1 е положен. Продолжете со модул 2.");
                  const fresh = await api.training(training.id);
                  setTraining(fresh.training);
                  const next = fresh.training.modules?.find((item) => item.position === 2);
                  if (next) setActiveId(next.id);
                  setAnswers([]);
                  return;
                }
                if (result.needsEvaluation) {
                  setEvalAnswers(evalList(training).map((question) => question.kind === "rating" ? "5" : ""));
                  setAwaitingEval(true);
                  return;
                }
                navigate(`/obuki/${training.id}/sertifikat`);
              } catch (reason) {
                setQuizNote(reason.message);
              }
            }}
          >
            {moduleQuestions.map((question, index) => (
              <fieldset key={question.id} className="grid gap-2">
                <legend className="font-bold text-brand-deep">{index + 1}. {question.prompt}</legend>
                {question.options.map((option, optionIndex) => (
                  <label key={option} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`q-${question.id}`}
                      checked={answers[index] === optionIndex}
                      onChange={() => setAnswers((current) => {
                        const next = current.length ? [...current] : moduleQuestions.map(() => -1);
                        next[index] = optionIndex;
                        return next;
                      })}
                      required
                    />
                    {option}
                  </label>
                ))}
              </fieldset>
            ))}
            {quizNote && <p className="text-sm font-semibold text-brand-urgent">{quizNote}</p>}
            <Button type="submit">Провери го тестот</Button>
          </form>
        )}
        {training.certified && (
          <Button asChild className="mt-4" variant="outline">
            <Link to={`/obuki/${training.id}/sertifikat`}>Отвори го сертификатот</Link>
          </Button>
        )}
      </section>
    </div>
  );
}
