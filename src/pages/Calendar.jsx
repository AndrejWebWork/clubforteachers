import { useEffect, useState } from "react";
import { Clock3, MapPin } from "lucide-react";
import { api } from "../api";
import { CAL_END, CAL_START, MONTHS, calendarToday, clampCalendar, entryOn, entryStamp, monthGrid, weekOf } from "../calendar";
import { calendarCategories } from "../data";
import { useApp } from "../compositor/AppCompositor";
import { PageHeader } from "../components/ui";

const WEEKDAYS = ["Пон", "Вто", "Сре", "Чет", "Пет", "Саб", "Нед"];
const tone = { Обуки: "training", Настани: "event", Работилници: "workshop", Рокови: "deadline", "Други активности": "other" };

function sameDate(left, right) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

export default function CalendarPage() {
  const { seeFeed } = useApp();
  const today = calendarToday();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(today);
  const [view, setView] = useState("Месец");
  const [kind, setKind] = useState("Сите");
  useEffect(() => {
    api.calendar().then((data) => setItems(data.items || [])).catch(() => setItems([]));
    seeFeed("calendar").catch(() => {});
  }, [seeFeed]);

  const visible = items.filter((item) => kind === "Сите" || item.category === kind);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = monthGrid(year, month);
  const week = weekOf(cursor);
  const atStart = year === CAL_START && month === 0 && (view === "Месец" || sameDate(cursor, new Date(CAL_START, 0, 1)));
  const atEnd = year === CAL_END && month === 11 && (view === "Месец" || sameDate(cursor, new Date(CAL_END, 11, 31)));
  const onDate = (date) => visible.filter((item) => entryOn(item, date));
  const upcoming = visible
    .filter((item) => entryStamp(item) >= year * 10000 + (month + 1) * 100 + cursor.getDate())
    .sort((left, right) => entryStamp(left) - entryStamp(right) || String(left.time).localeCompare(String(right.time)))
    .slice(0, 5);
  const weekLabel = week[0].getMonth() === week[6].getMonth()
    ? `${week[0].getDate()} – ${week[6].getDate()} ${MONTHS[week[0].getMonth()]} ${week[0].getFullYear()}`
    : `${week[0].getDate()} ${MONTHS[week[0].getMonth()]} – ${week[6].getDate()} ${MONTHS[week[6].getMonth()]} ${week[6].getFullYear()}`;

  function move(direction) {
    const next = new Date(cursor);
    if (view === "Недела") next.setDate(cursor.getDate() + direction * 7);
    else next.setMonth(cursor.getMonth() + direction, 1);
    setCursor(clampCalendar(next));
  }

  function pickYear(nextYear) {
    const day = Math.min(cursor.getDate(), new Date(nextYear, month + 1, 0).getDate());
    setCursor(new Date(nextYear, month, day));
  }

  return (
    <>
      <PageHeader title="Календар" description="Обуки, настани, работилници и рокови за 2026 и 2027." />
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
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-center">
            <button type="button" className="sort-chip" disabled={atStart} onClick={() => move(-1)} aria-label="Претходен период">‹</button>
            <div>
              <p className="text-xs font-black uppercase text-primary">{view === "Месец" ? "Месечен" : "Неделен"} преглед</p>
              <h2 className="text-xl font-black text-brand-deep">{view === "Месец" ? `${MONTHS[month]} ${year}` : weekLabel}</h2>
            </div>
            <button type="button" className="sort-chip" disabled={atEnd} onClick={() => move(1)} aria-label="Следен период">›</button>
            <div className="flex gap-2" role="group" aria-label="Година">
              {[CAL_START, CAL_END].map((item) => (
                <button key={item} type="button" className={`sort-chip ${year === item ? "active" : ""}`} onClick={() => pickYear(item)}>{item}</button>
              ))}
            </div>
          </div>
          {view === "Месец" ? (
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((item) => <b key={item} className="py-2 text-center text-xs uppercase text-muted-foreground">{item}</b>)}
              {cells.map((value, index) => {
                const shown = value.inMonth ? new Date(year, month, value.day) : null;
                const matches = shown ? onDate(shown) : [];
                return (
                  <button
                    key={`${value.day}-${index}`}
                    type="button"
                    disabled={!value.inMonth}
                    onClick={() => shown && setCursor(shown)}
                    className={`month-cell ${shown && sameDate(cursor, shown) ? "selected" : ""} ${shown && sameDate(today, shown) ? "today" : ""} ${value.inMonth ? "" : "outside"}`}
                  >
                    <span className="month-num">{value.day}</span>
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
              {week.map((date, index) => {
                const inRange = date.getFullYear() === CAL_START || date.getFullYear() === CAL_END;
                return (
                  <button key={date.toISOString()} type="button" disabled={!inRange} onClick={() => inRange && setCursor(new Date(date))} className={`week-col ${sameDate(cursor, date) ? "selected" : ""} ${sameDate(today, date) ? "today" : ""}`}>
                    <b className="text-xs uppercase text-muted-foreground">{WEEKDAYS[index]}</b>
                    <span className="text-lg font-black text-brand-deep">{date.getDate()}</span>
                    {onDate(date).map((event) => (
                      <span key={event.id} className={`ev-chip block ${tone[event.category]}`}>{event.time} {event.title}</span>
                    ))}
                  </button>
                );
              })}
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
          <span className="type-chip">{sameDate(cursor, today) ? "ДЕНЕС" : "ИЗБРАН ДАТУМ"}</span>
          <h2 className="mt-2 text-2xl font-black text-brand-deep">{cursor.getDate()} {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</h2>
          <div className="mt-4 space-y-3">
            {onDate(cursor).length ? onDate(cursor).map((item) => (
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
            {upcoming.length ? upcoming.map((item) => (
              <button key={item.id} type="button" onClick={() => setCursor(new Date(item.year, item.month - 1, item.day))} className={`cal-item w-full text-left ${tone[item.category]}`}>
                <b className="text-xs">{item.day} {MONTHS[item.month - 1]} {item.year} · {item.time}</b>
                <p className="truncate text-sm font-bold text-brand-deep">{item.title}</p>
              </button>
            )) : <p className="text-sm text-muted-foreground">Нема претстојни активности во овој избор.</p>}
          </div>
        </aside>
      </div>
    </>
  );
}
