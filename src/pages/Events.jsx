import { useEffect, useState } from "react";
import { Calendar, MapPin } from "lucide-react";
import { api } from "../api";
import { useApp } from "../compositor/AppCompositor";
import { Button, PageHeader } from "../components/ui";

export default function Events() {
  const { joinedEvents, toggleEvent } = useApp();
  const [events, setEvents] = useState([]);
  const [kind, setKind] = useState("Сите");
  const [openPast, setOpenPast] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.events().then((data) => setEvents(data.events)).catch((reason) => setError(reason.message));
  }, []);

  const visible = events.filter((item) => kind === "Сите" || item.kind === kind);
  const upcoming = visible.filter((item) => item.status === "Претстои").sort((a, b) => a.date.localeCompare(b.date));
  const past = visible.filter((item) => item.status === "Завршен").sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <PageHeader title="Настани" description="Обуки, вебинари и средби за професионален развој." />
      {error && <p className="mb-4 text-sm font-semibold text-brand-urgent">{error}</p>}
      <div className="mb-5 flex flex-wrap gap-x-4 gap-y-2">
        {["Сите", "Вебинар", "Работилница", "Обука", "Средба"].map((item) => (
          <button key={item} type="button" className={`sort-chip ${kind === item ? "active" : ""}`} onClick={() => setKind(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="grid gap-4 min-[1100px]:grid-cols-2 min-[1400px]:grid-cols-3">
        {!upcoming.length && <p className="text-sm text-muted-foreground">Нема претстојни настани во овој избор.</p>}
        {upcoming.map((item) => (
          <article key={item.id} className="panel">
            <div className="flex gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-md bg-brand-soft text-center font-bold text-brand-deep">
                {item.day}
                <span className="text-xs">{item.month}</span>
              </div>
              <div className="min-w-0">
                <span className="tag">{item.kind}</span>
                <h2 className="mt-2 font-bold leading-snug text-brand-deep">{item.title}</h2>
              </div>
            </div>
            <div className="my-5 space-y-2 text-sm text-muted-foreground">
              <p className="flex gap-2"><MapPin className="h-4 w-4" />{item.location}</p>
              <p className="flex gap-2"><Calendar className="h-4 w-4" />{item.day} {item.month}, {item.time}</p>
            </div>
            <Button variant={joinedEvents.includes(item.id) ? "outline" : "default"} onClick={() => toggleEvent(item.id)}>
              {joinedEvents.includes(item.id) ? "Откажи пријава" : "Пријави се"}
            </Button>
          </article>
        ))}
      </div>
      <h2 className="mb-3 mt-8 text-xl font-bold text-brand-deep">Минати настани</h2>
      <div className="space-y-3">
        {past.map((item) => (
          <div key={item.id} className="panel">
            <div className="flex items-center gap-4">
              <Calendar className="text-muted-foreground" />
              <div>
                <b>{item.title}</b>
                <p className="text-sm text-muted-foreground">{item.day} {item.month} · {item.location}</p>
              </div>
              <Button variant="outline" className="ml-auto" onClick={() => setOpenPast(openPast === item.id ? null : item.id)}>
                {openPast === item.id ? "Сокриј" : "Погледни"}
              </Button>
            </div>
            {openPast === item.id && <p className="mt-4 border-t pt-4 text-sm leading-6 text-muted-foreground">{item.detail}</p>}
          </div>
        ))}
      </div>
    </>
  );
}
