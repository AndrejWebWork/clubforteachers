import { useEffect, useState } from "react";
import { Lock, MonitorPlay } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { images } from "../data";
import { useApp } from "../compositor/AppCompositor";
import { Button, PageHeader } from "../components/ui";

const emptyText = "Нема резултати за избраните критериуми.";

function openStatus(status) {
  return status === "Отворена" ? "Отворена" : "Затворена";
}

function minutesLabel(duration) {
  const text = String(duration || "").trim();
  const hours = Number(text.match(/(\d+)\s*час/)?.[1] || 0);
  const mins = Number(text.match(/(\d+)\s*мин/)?.[1] || 0);
  const total = hours * 60 + mins;
  return total ? `${total} минути` : text || "180 минути";
}

function factLine(item) {
  const count = item.moduleCount || 2;
  const format = String(item.format || "онлајн").toLocaleLowerCase("mk");
  return `${count} ${count === 1 ? "модул" : "модула"}, ${format}, ${minutesLabel(item.duration)}`;
}

export default function Trainings() {
  const { signedIn, isAdmin, profile } = useApp();
  const [trainings, setTrainings] = useState([]);
  const [masterclasses, setMasterclasses] = useState([]);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("Сите");
  const [query, setQuery] = useState("");
  const [master, setMaster] = useState(null);
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [savedEval, setSavedEval] = useState("");
  const [draft, setDraft] = useState({ title: "", description: "", startsAt: "", minutes: "90", joinInfo: "" });

  function loadMasters() {
    return api.masterclasses().then((data) => {
      setMasterclasses(data.masterclasses || []);
      setUnlocked(Boolean(data.unlocked));
    });
  }

  useEffect(() => {
    api.trainings().then((data) => setTrainings(data.trainings)).catch((reason) => setError(reason.message));
    if (signedIn) loadMasters().catch((reason) => setError(reason.message));
  }, [signedIn]);

  const themes = ["Сите", ...new Set(trainings.map((item) => item.category).filter(Boolean))];
  const visible = trainings.filter((item) => {
    const inTheme = category === "Сите" || item.category === category;
    const inQuery = item.title.toLocaleLowerCase("mk").includes(query.toLocaleLowerCase("mk"));
    return inTheme && inQuery;
  });

  function openMaster(item) {
    if (!unlocked || item.locked) return;
    setMaster(item);
    setSavedEval(item.evaluated ? "Евалуацијата е зачувана." : "");
    setComment("");
    setRating("5");
  }

  return (
    <>
      <PageHeader
        eyebrow="Професионален развој"
        title="Обуки"
        description="Обуките се отворени или затворени. Во секоја има два модула, па тест, евалуација и сертификат."
      />
      {error && <p className="mb-4 text-sm font-semibold text-brand-urgent">{error}</p>}
      <div className="filter-bar mb-5">
        <label className="relative block min-w-0 flex-1 sm:max-w-md">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 w-full rounded-md border border-transparent bg-card px-3 text-sm outline-none ring-ring focus:ring-2"
            placeholder="Пребарај обука..."
          />
        </label>
        <div className="theme-sort" role="group" aria-label="Тема">
          {themes.map((item) => (
            <button key={item} type="button" className={`sort-chip ${category === item ? "active" : ""}`} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="panel py-14 text-center text-muted-foreground">{emptyText}</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => {
            const status = openStatus(item.status);
            return (
              <article key={item.id} className="training-card group">
                <div className="relative h-44 overflow-hidden">
                  <img src={images[item.image] || images.webinar} alt="" className="h-full w-full object-cover" />
                  <span className={`status-badge ${status === "Отворена" ? "open" : "closed"}`}>{status}</span>
                </div>
                <div className="p-5">
                  <h2 className="text-xl font-black leading-snug text-brand-deep">{item.title}</h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  <p className="my-4 flex items-center gap-1.5 border-y py-3 text-xs font-bold text-brand-deep">
                    <MonitorPlay className="h-4 w-4 text-primary" />
                    {factLine(item)}
                  </p>
                  {status === "Отворена" ? (
                    <Button asChild>
                      <Link to={signedIn ? `/obuki/${item.id}` : "/najava"}>Започни обука</Link>
                    </Button>
                  ) : (
                    <p className="text-sm font-bold text-muted-foreground">Затворена</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-black text-brand-deep">Мастеркласови</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {unlocked || isAdmin || profile.membership === "polno" ? "Полното членство ги отвора мастеркласовите." : "Со основно членство мастеркласовите се заклучени. Раководителот го менува членството."}
        </p>
        {isAdmin && (
          <form
            className="panel mt-4 grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await api.addMasterclass({ ...draft, minutes: Number(draft.minutes), startsAt: new Date(draft.startsAt).toISOString() });
                setDraft({ title: "", description: "", startsAt: "", minutes: "90", joinInfo: "" });
                await loadMasters();
              } catch (reason) {
                setError(reason.message);
              }
            }}
          >
            <h3 className="font-black text-brand-deep">Нов мастерклас</h3>
            <input required className="h-11 rounded-md border bg-card px-3 text-sm" placeholder="Наслов" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            <textarea required rows={3} className="rounded-md border bg-card px-3 py-2 text-sm" placeholder="Опис" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input required type="datetime-local" className="h-11 rounded-md border bg-card px-3 text-sm" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} />
              <input required type="number" min="1" className="h-11 rounded-md border bg-card px-3 text-sm" value={draft.minutes} onChange={(event) => setDraft({ ...draft, minutes: event.target.value })} />
            </div>
            <textarea required rows={2} className="rounded-md border bg-card px-3 py-2 text-sm" placeholder="Информации за вклучување" value={draft.joinInfo} onChange={(event) => setDraft({ ...draft, joinInfo: event.target.value })} />
            <Button type="submit">Зачувај мастерклас</Button>
          </form>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {masterclasses.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`master-card ${unlocked ? "" : "is-locked"}`}
              onClick={() => openMaster(item)}
              disabled={!unlocked}
            >
              {!unlocked && <span className="master-lock"><Lock className="h-4 w-4" /> Заклучено</span>}
              <b>{item.title}</b>
              <small>{new Date(item.startsAt).toLocaleString("mk-MK")} · {item.minutes} минути</small>
            </button>
          ))}
        </div>
        {!masterclasses.length && <p className="mt-4 text-sm text-muted-foreground">Сè уште нема закажан мастерклас.</p>}
        {master && (
          <article className="panel mt-4">
            <h3 className="text-xl font-black text-brand-deep">{master.title}</h3>
            <p className="mt-2 text-sm font-bold text-primary">{new Date(master.startsAt).toLocaleString("mk-MK")} · {master.minutes} минути</p>
            <p className="mt-3 text-sm leading-6">{master.description}</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{master.joinInfo}</p>
            {isAdmin && <Button type="button" variant="outline" className="mt-3" onClick={async () => { await api.deleteMasterclass(master.id); setMaster(null); await loadMasters(); }}>Отстрани мастерклас</Button>}
            <form
              className="mt-5 grid gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                try {
                  await api.submitMasterclassEvaluation(master.id, { rating: Number(rating), comment });
                  setSavedEval("Евалуацијата е зачувана.");
                  setComment("");
                  await loadMasters();
                } catch (reason) {
                  setSavedEval(reason.message);
                }
              }}
            >
              <h4 className="font-black text-brand-deep">Евалуација</h4>
              <label className="text-sm font-bold text-brand-deep">
                Оценка од 1 до 5
                <select className="mt-1 h-11 w-full rounded-md border bg-card px-3 text-sm" value={rating} onChange={(event) => setRating(event.target.value)}>
                  {["5", "4", "3", "2", "1"].map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <textarea required rows={3} className="rounded-md border bg-card px-3 py-2 text-sm" placeholder="Што беше корисно?" value={comment} onChange={(event) => setComment(event.target.value)} />
              <Button type="submit">Испрати евалуација</Button>
              {savedEval && <p className="text-sm font-semibold text-brand-deep">{savedEval}</p>}
            </form>
          </article>
        )}
      </section>
    </>
  );
}
