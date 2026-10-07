import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Pause, Play, RotateCcw } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../compositor/AppCompositor";
import { Button, PageHeader } from "../components/ui";

function formatTime(value) {
  const total = Math.max(0, Math.floor(value || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function TrainingPlayer() {
  const { trainingId } = useParams();
  const navigate = useNavigate();
  const { signedIn, authReady } = useApp();
  const videoRef = useRef(null);
  const furthestRef = useRef(0);
  const pendingRef = useRef(0);
  const [training, setTraining] = useState(null);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [length, setLength] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [quizNote, setQuizNote] = useState("");

  useEffect(() => {
    if (!signedIn) return;
    api.training(trainingId)
      .then((data) => {
        setTraining(data.training);
        furthestRef.current = data.training.progress.furthest;
        setFurthest(data.training.progress.furthest);
        setTime(data.training.progress.position);
        setAnswers(data.training.questions.map(() => -1));
      })
      .catch((reason) => setError(reason.message));
  }, [signedIn, trainingId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !training?.videoUrl) return;
    const place = () => {
      if (Number.isFinite(video.duration)) setLength(video.duration);
      const start = Math.min(training.progress.position || 0, furthestRef.current);
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
      if (!video.paused && video.currentTime >= furthestRef.current - 1) {
        furthestRef.current = Math.max(furthestRef.current, video.currentTime);
        setFurthest(furthestRef.current);
      }
      if (!video.paused) pendingRef.current += 0.25;
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
  }, [training]);

  useEffect(() => {
    if (!training?.videoUrl) return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      const watched = pendingRef.current;
      pendingRef.current = 0;
      if (!video || watched <= 0) return;
      api.saveProgress(training.id, {
        position: video.currentTime,
        watched,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
      }).then((data) => {
        furthestRef.current = data.furthest;
        setFurthest(data.furthest);
        if (video.currentTime > data.furthest + 1.5) video.currentTime = data.furthest;
        const known = Number.isFinite(video.duration) ? video.duration : 0;
        if (known > 0 && data.furthest >= known - 3) {
          api.training(training.id).then((fresh) => {
            setTraining((current) => current ? { ...current, modulesReady: fresh.training.modulesReady } : current);
          }).catch(() => {});
        }
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [training]);

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

  const duration = length || training.durationSeconds || 0;
  const finished = training.videoUrl ? duration > 0 && furthest >= duration - 3 : furthest >= 1;
  const quizOpen = finished && training.modulesReady;

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
      <PageHeader eyebrow={`Модул ${training.module || 1} · ${training.category}`} title={training.title} description={training.description} />
      <p className="module-note">По завршување на вториот модул, кога ќе ги изгледате сите видеа, веднаш се појавува тест. Со точен тест добивате сертификат.</p>
      {training.videoUrl ? (
        <section className="lesson-player">
          <div className="lesson-stage">
            <video
              ref={videoRef}
              src={training.videoUrl}
              playsInline
              controls={false}
              onClick={toggle}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onContextMenu={(event) => event.preventDefault()}
            />
            {!playing && (
              <button type="button" className="lesson-btn lesson-play" onClick={toggle} aria-label="Пушти">
                <Play className="h-7 w-7" />
              </button>
            )}
            <div className="lesson-bar">
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
              <span className="lesson-time">{formatTime(time)} / {formatTime(duration)}</span>
            </div>
          </div>
          <p>Може да паузирате и да се вратите назад. Напред се оди само со гледање.</p>
        </section>
      ) : (
        <section className="panel">
          <p className="leading-7">{training.description}</p>
          <Button
            className="mt-4"
            type="button"
            onClick={() => api.saveProgress(training.id, { position: 1, watched: 0, completed: true }).then((data) => {
              furthestRef.current = data.furthest;
              setFurthest(data.furthest);
            })}
          >
            Продолжи кон тестот
          </Button>
        </section>
      )}

      <section className="panel mt-5">
        <h2 className="section-heading">Тест</h2>
        {!quizOpen && <p className="text-sm text-muted-foreground">Тестот се појавува откако ќе ги изгледате сите видеа од двата модула.</p>}
        {quizOpen && training.questions.length === 0 && <p className="text-sm text-muted-foreground">Раководителот сè уште нема поставено тест.</p>}
        {quizOpen && training.questions.length > 0 && (
          <form
            className="grid gap-5"
            onSubmit={async (event) => {
              event.preventDefault();
              setQuizNote("");
              try {
                const result = await api.submitQuiz(training.id, answers);
                if (!result.passed) {
                  setQuizNote("Има неточен одговор. Проверете ги прашањата и обидете се повторно.");
                  return;
                }
                navigate(`/obuki/${training.id}/sertifikat`);
              } catch (reason) {
                setQuizNote(reason.message);
              }
            }}
          >
            {training.questions.map((question, index) => (
              <fieldset key={question.id} className="grid gap-2">
                <legend className="font-bold text-brand-deep">{index + 1}. {question.prompt}</legend>
                {question.options.map((option, optionIndex) => (
                  <label key={option} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`q-${question.id}`}
                      checked={answers[index] === optionIndex}
                      onChange={() => setAnswers((current) => current.map((value, item) => (item === index ? optionIndex : value)))}
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
