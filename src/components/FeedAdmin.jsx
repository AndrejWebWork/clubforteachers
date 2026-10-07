import { useEffect, useState } from "react";
import { api } from "../api";
import { calendarCategories, noticeCategories } from "../data";
import { Button } from "./ui";

const inputClass = "h-11 w-full rounded-md border bg-card px-3 text-sm outline-none ring-ring focus:ring-2";

export default function FeedAdmin({ kind }) {
  const notice = kind === "notice";
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(notice
    ? { title: "", category: "Повик", day: "", month: "", status: "НОВО", priority: false, text: "" }
    : { title: "", category: "Настани", day: "", time: "", location: "", text: "" });

  function load() {
    const request = notice ? api.notices() : api.calendar();
    return request.then((data) => setItems(notice ? data.notices : data.items));
  }

  useEffect(() => {
    load().catch((reason) => setError(reason.message));
  }, [kind]);

  return (
    <div className="grid gap-5 min-[1100px]:grid-cols-[300px_minmax(0,1fr)]">
      <form
        className="panel grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          const request = notice ? api.addNotice(form) : api.addCalendar(form);
          request
            .then(() => {
              setForm(notice
                ? { title: "", category: "Повик", day: "", month: "", status: "НОВО", priority: false, text: "" }
                : { title: "", category: "Настани", day: "", time: "", location: "", text: "" });
              return load();
            })
            .catch((reason) => setError(reason.message));
        }}
      >
        <h2 className="section-heading">{notice ? "Нов оглас" : "Нов термин"}</h2>
        <p className="text-sm text-muted-foreground">
          {notice
            ? "Се појавува на огласната табла и стигнува како известување до сите."
            : "Се појавува во календарот и стигнува како известување до сите."}
        </p>
        <input className={inputClass} placeholder="Наслов" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        <select className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
          {(notice ? noticeCategories : calendarCategories).map((item) => <option key={item}>{item}</option>)}
        </select>
        {notice ? (
          <div className="grid grid-cols-2 gap-3">
            <input className={inputClass} placeholder="Ден" value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value })} required />
            <input className={inputClass} placeholder="Месец" value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })} required />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <input className={inputClass} type="number" min="1" max="31" placeholder="Ден" value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value })} required />
            <input className={inputClass} placeholder="Час" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} required />
          </div>
        )}
        {notice ? (
          <input className={inputClass} placeholder="Ознака, на пр. НОВО" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} />
        ) : (
          <input className={inputClass} placeholder="Место" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
        )}
        <textarea className="rounded-md border bg-card px-3 py-2 text-sm" rows={3} placeholder="Текст" value={form.text} onChange={(event) => setForm({ ...form, text: event.target.value })} required />
        {notice && (
          <label className="flex items-center gap-2 text-sm font-bold text-brand-deep">
            <input type="checkbox" checked={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.checked })} />
            Итно
          </label>
        )}
        {error && <p className="text-sm font-semibold text-brand-urgent">{error}</p>}
        <Button type="submit">{notice ? "Објави оглас" : "Додај во календар"}</Button>
      </form>
      <section className="panel">
        <h2 className="section-heading">{notice ? "Објавени огласи" : "Термини"}</h2>
        <div className="divide-y">
          {items.map((item) => (
            <div key={item.id} className="py-3">
              <b className="text-brand-deep">{item.title}</b>
              <p className="text-sm text-muted-foreground">{notice ? `${item.day} ${item.month} · ${item.category}` : `${item.day} Јун · ${item.time} · ${item.category}`}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
