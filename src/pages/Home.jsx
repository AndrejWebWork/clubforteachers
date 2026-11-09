import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Eye, FileText, FolderOpen, Link2, MessageCircle, Newspaper, Presentation, Wrench } from "lucide-react";
import { MONTHS, calendarToday, entryStamp, monthGrid, noticeStamp } from "../calendar";
import { images } from "../data";
import { useApp } from "../compositor/AppCompositor";
import { Avatar, Button, SectionHead } from "../components/ui";

const tone = { Обуки: "training", Настани: "event", Работилници: "workshop", Рокови: "deadline", "Други активности": "other" };


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

function cardImage(url, fallback) {
  if (url && (String(url).startsWith("/") || String(url).startsWith("https://"))) return url;
  return fallback;
}

export default function Home() {
  const { topics, signedIn, profile, catalog } = useApp();
  const givenName = signedIn ? profile.name.trim().split(/\s+/)[0] : "";
  const library = catalog.resources;
  const notices = catalog.notices;
  const when = (value) => {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? time : 0;
  };
  const news = [
    ...notices.map((item) => {
      const stamp = noticeStamp(item.day, item.month);
      return { to: "/oglasi", title: item.title, date: `${stamp.day} ${stamp.month}`, meta: "Оглас", at: when(item.createdAt), image: cardImage(item.cover, images.notice) };
    }),
    ...(catalog.events || []).map((item) => ({ to: "/nastani", title: item.title, date: `${item.day} ${item.month}`, meta: item.kind || "Настан", at: when(item.createdAt) || Date.parse(item.date), image: cardImage(item.cover, images.webinar) })),
    ...library.map((item) => ({ to: `/resursi/${item.id}`, title: item.title, date: item.date, meta: "Ресурс", at: when(item.createdAt), image: cardImage(item.cover, images.resource) })),
    ...(catalog.trainings || []).map((item) => ({ to: `/obuki/${item.id}`, title: item.title, date: item.duration, meta: "Обука", at: when(item.createdAt), image: cardImage(item.image, images.project) })),
    ...topics.map((item) => ({ to: `/forum/${item.id}`, title: item.title, date: item.time, meta: "Форум", at: when(item.createdAt), image: cardImage(item.cover, images.forum) })),
  ].sort((left, right) => right.at - left.at).slice(0, 4);
  const calendarItems = catalog.calendar;
  const today = calendarToday();
  const homeMonth = monthGrid(today.getFullYear(), today.getMonth());
  const todayStamp = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const upcoming = calendarItems.filter((item) => entryStamp(item) >= todayStamp).sort((left, right) => entryStamp(left) - entryStamp(right)).slice(0, 3);
  return (
    <div className="space-y-5">
      <section className="hero-compact">
        <div className="relative z-10 min-w-0 max-w-3xl flex-1">
          <span className="text-[11px] font-black uppercase text-brand-yellow">Заедница за развој и вмрежување</span>
          <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
            {givenName ? `Добредојде ${givenName}` : "Добредојде"}
          </h1>
          <Button asChild variant="yellow" className="cta-link mt-4">
            <Link to="/oglasi">Погледни што е ново <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
        <img src={images.hero} alt="" width={1536} height={768} className="hero-compact-img" />
      </section>

      <section className="panel home-opportunities min-w-0">
          <SectionHead icon={<Newspaper className="h-5 w-5" />} title="Последни можности" to="/oglasi" />
          <div className="grid grid-cols-1 gap-3 min-[700px]:grid-cols-2 min-[1400px]:grid-cols-4">
            {!news.length && <p className="text-sm text-muted-foreground">Сè уште нема огласи.</p>}
            {news.map((item) => (
              <Link key={`${item.to}-${item.title}`} to={item.to} className="news-mini">
                <div className="relative h-44 overflow-hidden">
                  <img src={item.image} alt="" width={992} height={672} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <h3 className="line-clamp-2 text-sm font-black leading-snug text-brand-deep">{item.title}</h3>
                  <p className="mt-auto flex items-center gap-1 pt-2 text-xs font-semibold text-muted-foreground">
                    <Calendar className="h-3 w-3" />{item.date} · {item.meta}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

      <div className="grid gap-5 min-[1100px]:grid-cols-2">
        <section className="panel min-w-0">
          <SectionHead icon={<Calendar className="h-5 w-5" />} title={`Календар · ${MONTHS[today.getMonth()]} ${today.getFullYear()}`} linkLabel="Цел календар" to="/kalendar" />
          <div className="grid gap-5 min-[700px]:grid-cols-2">
            <div className="grid grid-cols-7 text-center text-xs">
              {["П", "В", "С", "Ч", "П", "С", "Н"].map((day, index) => <b key={`${day}-${index}`} className="text-muted-foreground">{day}</b>)}
              {homeMonth.map((cell, index) => {
                const marked = cell.inMonth && calendarItems.some((item) => Number(item.year) === today.getFullYear() && Number(item.month) === today.getMonth() + 1 && Number(item.day) === cell.day);
                const kind = marked ? calendarItems.find((item) => Number(item.year) === today.getFullYear() && Number(item.month) === today.getMonth() + 1 && Number(item.day) === cell.day)?.category : null;
                const isToday = cell.inMonth && cell.day === today.getDate();
                return (
                  <span key={`${cell.day}-${index}`} className={`relative mx-auto mt-1.5 grid h-7 w-7 place-items-center rounded-full ${isToday ? "bg-brand-deep font-black text-primary-foreground" : cell.inMonth ? "text-brand-deep" : "text-muted-foreground/40"}`}>
                    {cell.day}
                    {marked && <i className={`cal-dot ${tone[kind]}`} />}
                  </span>
                );
              })}
            </div>
            <div className="space-y-2">
              {upcoming.map((item) => (
                <div key={item.id} className={`cal-item ${tone[item.category]}`}>
                  <b className="text-xs text-brand-deep">{item.day} {MONTHS[item.month - 1]} {item.year} · {item.time}</b>
                  <p className="text-sm font-bold leading-5 text-brand-deep">{item.title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel home-resources min-w-0">
          <SectionHead icon={<FolderOpen className="h-5 w-5" />} title="Ресурси" to="/resursi" />
          <div className="divide-y">
            {!library.length && <p className="py-3 text-sm text-muted-foreground">Сè уште нема ресурси.</p>}
            {library.slice(0, 6).map((item) => {
              const label = resourceLabel(item);
              const Icon = resourceIcon(label);
              const lead = item.source === "LEAD" || item.author === "LEAD тим";
              return (
                <Link key={item.id} to={`/resursi/${item.id}`} className="group grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-soft text-primary"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <b className="block break-words text-sm leading-5 text-brand-deep group-hover:text-primary">{item.title}</b>
                    <small className="block break-words text-muted-foreground">{label} · {lead ? "LEAD" : item.author}</small>
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

      <section className="panel min-w-0">
          <SectionHead icon={<MessageCircle className="h-5 w-5" />} title="Даскалски форум" to="/forum" />
          <div className="divide-y">
            {!topics.length && <p className="py-3 text-sm text-muted-foreground">Сè уште нема теми.</p>}
            {topics.slice(0, 4).map((item) => (
              <Link key={item.id} to={`/forum/${item.id}`} className="flex items-center gap-3 py-2.5">
                <Avatar name={item.author} size="sm" />
                <span className="min-w-0 flex-1">
                  <b className="flex items-center gap-2 text-sm text-brand-deep">
                    <span className="line-clamp-2 sm:truncate">{item.title}</span>
                    {item.isNew && <i className="unread-dot" aria-label="Ново" />}
                  </b>
                  <small className="text-muted-foreground">{item.time}</small>
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
  );
}
