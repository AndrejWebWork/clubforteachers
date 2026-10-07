import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Eye, FileText, FolderOpen, Link2, Megaphone, MessageCircle, Newspaper, Presentation, Wrench } from "lucide-react";
import { api } from "../api";
import { images } from "../data";
import { useApp } from "../compositor/AppCompositor";
import { Avatar, Button, SectionHead, Signal } from "../components/ui";

const juneDays = [26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 1, 2, 3, 4, 5, 6];
const tone = { Обуки: "training", Настани: "event", Работилници: "workshop", Рокови: "deadline", "Други активности": "other" };

const news = [
  { to: "/nastani", klass: "news-mini important", type: "Настан", signal: "ВАЖНО", title: "Вебинар: Нови методи во наставата", date: "12 Јуни", meta: "Онлајн", image: images.webinar },
  { to: "/resursi/aktivno-ucenje", klass: "news-mini", type: "Ресурс", signal: "НОВО", title: "Прирачник за активно учење", date: "10 Јуни", meta: "48 стр.", image: images.resource },
  { to: "/obuki/digitalni-alatki", klass: "news-mini deadline", type: "Обука", signal: "ОТВОРЕНА ПРИЈАВА", title: "Дигитални алатки за активна настава", date: "9 Јуни", meta: "Онлајн", image: images.project, deadline: "30 Јуни" },
  { to: "/oglasi", klass: "news-mini deadline urgent", type: "Оглас", signal: "ПОСЛЕДЕН ДЕН", title: "Летна школа за инклузивно образование", date: "8 Јуни", meta: "Повик", image: images.webinar, deadline: "15 Јуни" },
];

const kindFromType = { PDF: "Прирачник", PPTX: "Презентација", DOCX: "Документ", LINK: "Линк", VIDEO: "Видео", WEB: "Алатка" };

function resourceIcon(kind) {
  if (kind === "Видео") return Presentation;
  if (kind === "Линк") return Link2;
  if (kind === "Алатка") return Wrench;
  return FileText;
}

function resourceLabel(item) {
  return item.kind || kindFromType[item.type] || item.type || "Ресурс";
}

export default function Home() {
  const { topics, signedIn, profile } = useApp();
  const givenName = signedIn ? profile.name.trim().split(/\s+/)[0] : "";
  const [library, setLibrary] = useState([]);
  const [notices, setNotices] = useState([]);
  const [calendarItems, setCalendarItems] = useState([]);
  useEffect(() => {
    api.resources().then((data) => setLibrary(data.resources || [])).catch(() => setLibrary([]));
    api.notices().then((data) => setNotices(data.notices || [])).catch(() => setNotices([]));
    api.calendar().then((data) => setCalendarItems(data.items || [])).catch(() => setCalendarItems([]));
  }, []);
  const deadlines = notices.filter((item) => item.priority).length;
  const upcoming = calendarItems.filter((item) => item.day >= 18).slice(0, 3);
  return (
    <div className="space-y-5">
      <section className="hero-compact">
        <div className="relative z-10 min-w-0 max-w-3xl flex-1">
          <span className="text-[11px] font-black uppercase text-brand-yellow">Заедница за развој и вмрежување</span>
          <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
            {givenName ? `Добредојде ${givenName}, во Клубот на наставници!` : "Добредојде во Клубот на наставници!"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/80">
            Твојата заедница за идеи, ресурси, поддршка и професионален развој. Имаш <b className="text-brand-yellow">{deadlines} огласи со рок</b> што бараат внимание.
          </p>
          <Button asChild variant="yellow" className="cta-link mt-4">
            <Link to="/oglasi">Погледни што е ново <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        <img src={images.hero} alt="" width={1536} height={768} className="hero-compact-img" />
      </section>

      <section className="panel min-w-0">
          <SectionHead icon={<Newspaper className="h-5 w-5" />} title="Последни можности" to="/obuki" />
          <div className="grid grid-cols-1 gap-3 min-[700px]:grid-cols-2 min-[1400px]:grid-cols-4">
            {news.map((item) => (
              <Link key={item.title} to={item.to} className={item.klass}>
                <div className="relative h-24 overflow-hidden">
                  <img src={item.image} alt="" width={992} height={672} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <Signal label={item.signal} className="absolute left-2 top-2" />
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <span className="text-[11px] font-black uppercase text-primary">{item.type}</span>
                  <h3 className="mt-1 line-clamp-2 text-sm font-black leading-snug text-brand-deep">{item.title}</h3>
                  <p className="mt-auto flex items-center gap-1 pt-2 text-xs font-semibold text-muted-foreground">
                    <Calendar className="h-3 w-3" />{item.date} · {item.meta}
                  </p>
                  {item.deadline && <p className="news-deadline">РОК: {item.deadline}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>

      <div className="grid gap-5 min-[1100px]:grid-cols-2">
        <section className="panel min-w-0">
          <SectionHead icon={<Megaphone className="h-5 w-5" />} title="Огласна табла" to="/oglasi" />
          <div className="space-y-2">
            {notices.slice(0, 5).map((item) => (
              <Link key={item.title} to="/oglasi" className={`board-row group ${item.priority ? "priority" : ""}`}>
                <span className="board-date"><b>{item.day}</b><small>{item.month}</small></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="type-chip">{item.category}</span>
                    <Signal label={item.status} />
                  </span>
                  <b className="mt-1 block text-sm leading-5 text-brand-deep">{item.title}</b>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </section>

        <section className="panel min-w-0">
          <SectionHead icon={<FolderOpen className="h-5 w-5" />} title="Ресурси" to="/resursi" />
          <div className="divide-y">
            {library.slice(0, 6).map((item) => {
              const label = resourceLabel(item);
              const Icon = resourceIcon(label);
              const lead = item.source === "LEAD" || item.author === "LEAD тим";
              return (
                <Link key={item.id} to={`/resursi/${item.id}`} className="group grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-soft text-primary"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <b className="block text-sm leading-5 text-brand-deep group-hover:text-primary">{item.title}</b>
                    <small className="text-muted-foreground">{label} · {lead ? "LEAD" : item.author}</small>
                  </span>
                  <span className="shrink-0 text-right text-xs font-black leading-4 text-primary">
                    {item.downloads || 0}
                    <small className="block font-bold text-muted-foreground">симнувања</small>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-5 min-[1100px]:grid-cols-2">
        <section className="panel min-w-0">
          <SectionHead icon={<Calendar className="h-5 w-5" />} title="Календар · Јуни 2025" linkLabel="Цел календар" to="/kalendar" />
          <div className="grid gap-5 min-[700px]:grid-cols-2">
            <div className="grid grid-cols-7 text-center text-xs">
              {["П", "В", "С", "Ч", "П", "С", "Н"].map((day, index) => <b key={`${day}-${index}`} className="text-muted-foreground">{day}</b>)}
              {juneDays.map((day, index) => {
                const inMonth = index >= 6 && index <= 35;
                const marked = inMonth && calendarItems.some((item) => item.day === day);
                const kind = inMonth ? calendarItems.find((item) => item.day === day)?.category : null;
                return (
                  <span key={`${day}-${index}`} className={`relative mx-auto mt-1.5 grid h-7 w-7 place-items-center rounded-full ${inMonth && day === 18 ? "bg-brand-deep font-black text-primary-foreground" : inMonth ? "text-brand-deep" : "text-muted-foreground/40"}`}>
                    {day}
                    {marked && <i className={`cal-dot ${tone[kind]}`} />}
                  </span>
                );
              })}
            </div>
            <div className="space-y-2">
              {upcoming.map((item) => (
                <div key={item.id} className={`cal-item ${tone[item.category]}`}>
                  <b className="text-xs text-brand-deep">{item.day} Јун · {item.time}</b>
                  <p className="text-sm font-bold leading-5 text-brand-deep">{item.title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel min-w-0">
          <SectionHead icon={<MessageCircle className="h-5 w-5" />} title="Даскалски форум" to="/forum" />
          <div className="divide-y">
            {topics.slice(0, 4).map((item) => (
              <Link key={item.id} to={`/forum/${item.id}`} className="flex items-center gap-3 py-2.5">
                <Avatar name={item.author} size="sm" />
                <span className="min-w-0 flex-1">
                  <b className="flex items-center gap-2 text-sm text-brand-deep">
                    <span className="truncate">{item.title}</span>
                    {item.isNew && <i className="unread-dot" aria-label="Ново" />}
                  </b>
                  <small className="text-muted-foreground">{item.category} · {item.time}</small>
                </span>
                <span className="flex shrink-0 items-center gap-3 text-xs font-bold text-primary">
                  <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{item.replies}</span>
                  <span className="hidden items-center gap-1 sm:flex"><Eye className="h-3.5 w-3.5" />{item.views}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
