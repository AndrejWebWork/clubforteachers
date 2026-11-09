import { useEffect, useState } from "react";
import { api } from "../api";
import { Button, EuroDate, SuccessPop } from "./ui";

const inputClass = "h-11 w-full rounded-md border bg-card px-3 text-sm outline-none ring-ring focus:ring-2";
const kinds = ["Вебинар", "Работилница", "Обука", "Средба"];
const empty = { title: "", kind: "Вебинар", date: "", time: "10:00", location: "", status: "Претстои", detail: "" };

export default function EventAdmin() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(empty);
  const [done, setDone] = useState(null);
  const [signups, setSignups] = useState([]);

  function load() {
    return Promise.all([api.events(), api.eventSignups()]).then(([data, people]) => {
      setItems(data.events);
      setSignups(people.signups || []);
    });
  }

  useEffect(() => {
    load().catch((reason) => setError(reason.message));
  }, []);

  return (
    <div className="admin-split">
      <SuccessPop title={done?.title} text={done?.text} onClose={() => setDone(null)} />
      <form
        className="panel grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          const title = form.title.trim();
          api.addEvent(form)
            .then(() => {
              setForm(empty);
              setDone({
                title: "Настанот е додаден",
                text: `„${title}“ е на Настани и на календарот.`,
              });
              return load();
            })
            .catch((reason) => setError(reason.message));
        }}
      >
        <h2 className="section-heading">Нов настан</h2>
        <p className="text-sm text-muted-foreground">Се појавува на Настани и на календарот. Пријавените се гледаат под настанот.</p>
        <input className={inputClass} placeholder="Наслов" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        <select className={inputClass} value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
          {kinds.map((item) => <option key={item}>{item}</option>)}
        </select>
        <EuroDate required value={form.date} onChange={(date) => setForm({ ...form, date })} />
        <input className={inputClass} type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} required />
        <input className={inputClass} placeholder="Место" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} required />
        <select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          <option>Претстои</option>
          <option>Завршен</option>
        </select>
        <textarea className="rounded-md border bg-card px-3 py-2 text-sm" rows={4} placeholder="Опис" value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} required />
        {error && <p className="text-sm font-semibold text-brand-urgent">{error}</p>}
        <Button type="submit">Додај настан</Button>
      </form>
      <section className="panel">
        <h2 className="section-heading">Настани</h2>
        <div className="added-list divide-y">
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <b className="text-brand-deep">{item.title}</b>
                <p className="text-sm text-muted-foreground">{item.day} {item.month} · {item.time} · {item.kind} · {item.status}</p>
                <p className="text-sm text-brand-deep">{signups.filter((person) => person.eventId === item.id).map((person) => person.name).join(", ") || "Нема пријавени."}</p>
              </div>
              <button type="button" className="text-xs font-bold text-muted-foreground" onClick={() => api.deleteEvent(item.id).then(load).catch((reason) => setError(reason.message))}>Избриши</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
