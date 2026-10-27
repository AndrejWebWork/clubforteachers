import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { MONTHS } from "../calendar";
import { useApp } from "../compositor/AppCompositor";
import { calendarCategories, noticeCategories } from "../data";
import { Button } from "./ui";

const inputClass = "h-11 w-full rounded-md border bg-card px-3 text-sm outline-none ring-ring focus:ring-2";
const emptyNotice = { title: "", category: "Повик", day: "", month: "", status: "НОВО", priority: false, text: "" };

export default function FeedAdmin({ kind }) {
  const notice = kind === "notice";
  const { replaceNotices } = useApp();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const formRef = useRef(null);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(notice
    ? emptyNotice
    : { title: "", category: "Настани", date: "", time: "", location: "", text: "" });

  function load() {
    const request = notice ? api.notices() : api.calendar();
    return request.then((data) => {
      const list = notice ? data.notices : data.items;
      setItems(list);
      if (notice) replaceNotices(list);
      return list;
    });
  }

  function resetNotice() {
    setEditingId("");
    setForm(emptyNotice);
  }

  useEffect(() => {
    load().catch((reason) => setError(reason.message));
  }, [kind]);

  return (
    <div className={`admin-split${notice ? "" : " form-wide"}`}>
      <form
        ref={formRef}
        className="panel grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          const entry = notice ? form : (() => {
            const [year, month, day] = String(form.date).split("-").map(Number);
            return { ...form, year, month, day };
          })();
          const request = notice
            ? (editingId ? api.updateNotice(editingId, form) : api.addNotice(form))
            : api.addCalendar(entry);
          request
            .then(() => {
              if (notice) resetNotice();
              else setForm({ title: "", category: "Настани", date: "", time: "", location: "", text: "" });
              return load();
            })
            .catch((reason) => setError(reason.message));
        }}
      >
        <h2 className="section-heading">{notice ? (editingId ? "Измени оглас" : "Нов оглас") : "Нов термин"}</h2>
        <p className="text-sm text-muted-foreground">
          {notice
            ? (editingId
              ? "Измената се зачувува на истиот оглас."
              : "Се појавува на огласната табла и стигнува како известување до сите.")
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
            <input className={inputClass} type="date" min="2026-01-01" max="2027-12-31" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
            <input className={inputClass} placeholder="Час" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} required />
          </div>
        )}
        {notice ? (
          <input className={inputClass} placeholder="Ознака, на пр. НОВО" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} />
        ) : (
          <input className={inputClass} placeholder="Место" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
        )}
        <textarea className="rounded-md border bg-card px-3 py-2 text-sm" rows={5} placeholder="Текст" value={form.text} onChange={(event) => setForm({ ...form, text: event.target.value })} required />
        {notice && <p className="text-sm text-muted-foreground">Залепен https линк во текстот се отвора кога наставникот го чита огласот.</p>}
        {notice && (
          <label className="flex items-center gap-2 text-sm font-bold text-brand-deep">
            <input type="checkbox" checked={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.checked })} />
            Итно
          </label>
        )}
        {error && <p className="text-sm font-semibold text-brand-urgent">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{notice ? (editingId ? "Зачувај измени" : "Објави оглас") : "Додај во календар"}</Button>
          {notice && editingId && <Button type="button" variant="outline" onClick={resetNotice}>Откажи</Button>}
        </div>
      </form>
      <section className="panel">
        <h2 className="section-heading">{notice ? "Објавени огласи" : "Термини"}</h2>
        <div className="added-list divide-y">
          {items.map((item) => (
            <div key={item.id} className="py-3">
              <b className="text-brand-deep">{item.title}</b>
              <p className="text-sm text-muted-foreground">{notice ? `${item.day} ${item.month} · ${item.category}` : `${item.day} ${MONTHS[(item.month || 1) - 1]} ${item.year || ""} · ${item.time} · ${item.category}`}</p>
              {notice && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.text}</p>}
              {notice && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(item.id);
                      setForm({
                        title: item.title,
                        category: item.category,
                        day: item.day,
                        month: item.month,
                        status: item.status,
                        priority: Boolean(item.priority),
                        text: item.text || "",
                      });
                      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Измени
                  </Button>
                  <button
                    type="button"
                    className="row-delete"
                    onClick={() => {
                      setError("");
                      api.deleteNotice(item.id)
                        .then(() => {
                          if (editingId === item.id) resetNotice();
                          return load();
                        })
                        .catch((reason) => setError(reason.message));
                    }}
                  >
                    Избриши
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
