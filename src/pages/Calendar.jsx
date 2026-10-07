import { useEffect, useState } from "react";
import { Clock3, MapPin } from "lucide-react";
import { api } from "../api";
import { calendarCategories } from "../data";
import { useApp } from "../compositor/AppCompositor";
import { PageHeader } from "../components/ui";

const WEEKDAYS = ["Пон", "Вто", "Сре", "Чет", "Пет", "Саб", "Нед"];
const cells = [26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 1, 2, 3, 4, 5, 6];
const tone = { Обуки: "training", Настани: "event", Работилници: "workshop", Рокови: "deadline", "Други активности": "other" };

export default function CalendarPage() {
  const { seeFeed } = useApp();
  const [items, setItems] = useState([]);
  const [day, setDay] = useState(18);
  const [view, setView] = useState("Месец");
  const [kind, setKind] = useState("Сите");
  const visible = items.filter((item) => kind === "Сите" || item.category === kind);
  useEffect(() => {
    api.calendar().then((data) => setItems(data.items || [])).catch(() => setItems([]));
    seeFeed("calendar").catch(() => {});
  }, [seeFeed]);
  const onDay = (value) => visible.filter((item) => item.day === value);
  const start = cells.indexOf(day, 6);
  const weekStart = Math.floor(start / 7) * 7;
  const week = cells.slice(weekStart, weekStart + 7).map((value, index) => ({
    day: value,
    inMonth: weekStart + index >= 6 && weekStart + index <= 35,
  }));

  return (
    <>
      <PageHeader title="Календар" description="Обуки, настани, работилници и рокови — обоени по категорија." />
      <div className="mb-5 flex flex-col gap-4">
        <div className="view-switch" role="group" aria-label="Преглед на календарот">
          {["Месец", "Недела"].map((item) => (
            <button key={item} type="button" className={`sort-chip ${view === item ? "active" : ""}`} onClick={() => setView(item)}>{item}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {["Сите", ...calendarCategories].map((item) => (
            <button key={item} type="button" className={`sort-chip ${kind === item ? "active" : ""}`} onClick={() => setKind(item)}>{item}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 min-[1200px]:grid-cols-[minmax(0,1fr)_300px]">
        <section className="calendar-shell">
          <div className="mb-4 text-center">
            <p className="text-xs font-black uppercase text-primary">{view === "Месец" ? "Месечен" : "Неделен"} преглед</p>
            <h2 className="text-xl font-black text-brand-deep">{view === "Месец" ? "Јуни 2025" : `${week[0]?.day} – ${week[6]?.day} Јуни 2025`}</h2>
          </div>
          {view === "Месец" ? (
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((item) => <b key={item} className="py-2 text-center text-xs uppercase text-muted-foreground">{item}</b>)}
              {cells.map((value, index) => {
                const inMonth = index >= 6 && index <= 35;
                const matches = inMonth ? onDay(value) : [];
                return (
                  <button
                    key={`${value}-${index}`}
                    type="button"
                    disabled={!inMonth}
                    onClick={() => setDay(value)}
                    className={`month-cell ${inMonth && day === value ? "selected" : ""} ${inMonth && value === 18 ? "today" : ""} ${inMonth ? "" : "outside"}`}
                  >
                    <span className="month-num">{value}</span>
                    <span className="hidden flex-col gap-0.5 sm:flex">
                      {matches.slice(0, 2).map((item) => <span key={item.id} className={`ev-chip ${tone[item.category]}`}>{item.time}</span>)}
                    </span>
                    <span className="flex gap-0.5 sm:hidden">
                      {matches.map((item) => <i key={item.id} className={`cal-dot static ${tone[item.category]}`} />)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-2 min-[520px]:grid-cols-2 min-[1100px]:grid-cols-7">
              {week.map((item, index) => (
                <button key={WEEKDAYS[index]} type="button" onClick={() => item.inMonth && setDay(item.day)} className={`week-col ${item.inMonth && day === item.day ? "selected" : ""} ${item.inMonth && item.day === 18 ? "today" : ""}`}>
                  <b className="text-xs uppercase text-muted-foreground">{WEEKDAYS[index]}</b>
                  <span className="text-lg font-black text-brand-deep">{item.day}</span>
                  {(item.inMonth ? onDay(item.day) : []).map((event) => (
                    <span key={event.id} className={`ev-chip block ${tone[event.category]}`}>{event.time} {event.title}</span>
                  ))}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-4 border-t pt-4 text-xs font-bold text-muted-foreground">
            {calendarCategories.map((item) => (
              <span key={item} className="flex items-center gap-1.5"><i className={`cal-dot static ${tone[item]}`} />{item}</span>
            ))}
            <span className="flex items-center gap-1.5"><i className="today-swatch" />Денес</span>
          </div>
        </section>
        <aside className="calendar-aside">
          <span className="type-chip">{day === 18 ? "ДЕНЕС" : "ИЗБРАН ДАТУМ"}</span>
          <h2 className="mt-2 text-2xl font-black text-brand-deep">{day} Јуни</h2>
          <div className="mt-4 space-y-3">
            {onDay(day).length ? onDay(day).map((item) => (
              <div key={item.id} className={`cal-item big ${tone[item.category]}`}>
                <span className="text-[11px] font-black uppercase">{item.category}</span>
                <h3 className="mt-1 font-black text-brand-deep">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                <p className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-brand-deep">
                  <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{item.time}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{item.location}</span>
                </p>
              </div>
            )) : <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">Нема активности за овој датум.</p>}
          </div>
          <h3 className="mt-6 border-t pt-4 text-sm font-black uppercase text-brand-deep">Претстојни активности</h3>
          <div className="mt-3 space-y-2">
            {visible.filter((item) => item.day > 18).slice(0, 5).map((item) => (
              <button key={item.id} type="button" onClick={() => setDay(item.day)} className={`cal-item w-full text-left ${tone[item.category]}`}>
                <b className="text-xs">{item.day} Јун · {item.time}</b>
                <p className="truncate text-sm font-bold text-brand-deep">{item.title}</p>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
