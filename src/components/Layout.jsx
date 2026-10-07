import { useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ScrollText,
  FolderOpen,
  Heart,
  Home,
  Mail,
  Megaphone,
  Menu,
  MessageCircle,
  Presentation,
  Search,
  Shield,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { enablePush } from "../push";
import { nav, notices, resources, trainings, events } from "../data";
import { pages } from "../site";
import { useApp } from "../compositor/AppCompositor";
import CookieConsent from "./CookieConsent";
import { api } from "../api";
import { Button, UploadToast } from "./ui";
import MotionRoot from "../motion/MotionRoot";

const icons = {
  "/": Home,
  "/profil": UserRound,
  "/obuki": Presentation,
  "/resursi": FolderOpen,
  "/nastani": CalendarRange,
  "/forum": MessageCircle,
  "/oglasi": Megaphone,
  "/kalendar": CalendarDays,
  "/materijali": Video,
  "/admin": Shield,
};

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { profile, signedIn, isAdmin, menuOpen, setMenuOpen, startEdit, unreadCount, documents, topics, setCookiesOpen, consent } = useApp();
  const [open, setOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invited, setInvited] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const initials = profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2);
  const [query, setQuery] = useState("");
  const [pushState, setPushState] = useState(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));
  const navigate = useNavigate();

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("mk");
    if (q.length < 2) return [];
    const hits = [
      ...resources.map((item) => ({ title: item.title, to: `/resursi/${item.id}`, kind: "Ресурс" })),
      ...trainings.map((item) => ({ title: item.title, to: "/obuki", kind: "Обука" })),
      ...topics.map((item) => ({ title: item.title, to: `/forum/${item.id}`, kind: "Тема" })),
      ...events.map((item) => ({ title: item.title, to: "/nastani", kind: "Настан" })),
      ...documents.map((item) => ({ title: item.title, to: "/dokumenti", kind: "Документ" })),
      ...notices.map((item) => ({ title: item.title, to: "/oglasi", kind: "Оглас" })),
      ...pages.filter((item) => item.path !== "/").map((item) => ({ title: item.title, to: item.path, kind: "Страница" })),
    ];
    return hits.filter((item) => item.title.toLocaleLowerCase("mk").includes(q)).slice(0, 6);
  }, [query, topics, documents]);

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[252px_minmax(0,1fr)]">
      <MotionRoot />
      <a href="#sodrzina" className="skip-link">
        Прескокни до содржината
      </a>
      {open && (
        <button className="fixed inset-0 z-30 bg-foreground/30 md:hidden" aria-label="Затвори мени" onClick={() => setOpen(false)} />
      )}
      <aside
        className={`sidebar-pattern fixed inset-y-0 left-0 z-40 flex w-[min(252px,88vw)] flex-col overflow-hidden bg-sidebar px-4 py-6 text-sidebar-foreground transition-transform md:sticky md:top-0 md:h-screen md:w-[252px] ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between px-2">
          <Link to="/" className="flex items-center gap-3 text-sidebar-primary-foreground" aria-label="Клуб на наставници">
            <div className="brand-logo grid h-12 w-12 shrink-0 place-items-center text-xl font-black">КН</div>
            <div className="leading-tight">
              <div className="text-[10px] font-black uppercase">Клуб на</div>
              <div className="text-sm font-black uppercase">наставници</div>
            </div>
          </Link>
          <Button variant="ghost" size="icon" className="text-sidebar-primary-foreground md:hidden" onClick={() => setOpen(false)}>
            <X />
            <span className="sr-only">Затвори</span>
          </Button>
        </div>
        <nav className="relative z-10 mt-8 min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto">
          {[...nav, ...(signedIn ? [{ label: "Материјали", to: "/materijali" }] : []), ...(isAdmin ? [{ label: "Админ", to: "/admin" }] : [])].map((item) => {
            const Icon = icons[item.to];
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setOpen(false)}
                className={`group flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-bold transition-all ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-nav"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
                {active && <span className="ml-auto h-2 w-2 rotate-45 bg-brand-yellow" />}
              </NavLink>
            );
          })}
        </nav>
        <div className="relative z-10 mt-auto space-y-2 px-1">
          <NavLink
            to="/dokumenti"
            onClick={() => setOpen(false)}
            className={`group flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-bold transition-all ${
              pathname.startsWith("/dokumenti")
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-nav"
                : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <ScrollText className="h-5 w-5 shrink-0" />
            <span>Документи на клубот</span>
            {pathname.startsWith("/dokumenti") && <span className="ml-auto h-2 w-2 rotate-45 bg-brand-yellow" />}
          </NavLink>
          <button type="button" className="recommend-btn" onClick={() => setInviteOpen(true)}>
            <Heart className="h-4 w-4" />
            Препорачај го Клубот
          </button>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-bold text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => setContactOpen(true)}
          >
            <Mail className="h-5 w-5 shrink-0" />
            Контактирај нè
          </button>
          <div className="flex items-end gap-3 px-2 pt-2 text-sidebar-primary-foreground/70" aria-hidden="true">
            <span className="text-4xl font-black text-sidebar-primary">››</span>
            <span className="mb-2 grid grid-cols-3 gap-1.5">
              {Array.from({ length: 9 }).map((_, index) => (
                <i key={index} className="h-1.5 w-1.5 rounded-full bg-brand-yellow" />
              ))}
            </span>
          </div>
        </div>
      </aside>
      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-background/95 px-4 py-3 backdrop-blur sm:h-[72px] sm:flex-nowrap sm:px-6 sm:py-0">
          <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={() => setOpen(true)}>
            <Menu />
            <span className="sr-only">Отвори мени</span>
          </Button>
          <div className="order-3 min-w-0 basis-full sm:order-none sm:flex sm:min-w-0 sm:flex-1 sm:basis-auto sm:justify-center">
          <label className="relative block w-full max-w-xl">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) {
                  navigate(results[0].to);
                  setQuery("");
                }
              }}
              className="h-11 w-full rounded-full border border-transparent bg-card pl-11 pr-4 text-sm shadow-sm outline-none ring-ring focus:ring-2"
              placeholder="Пребарај ресурси, обуки, теми..."
            />
            {results.length > 0 && (
              <div className="absolute left-0 right-0 top-13 z-30 overflow-hidden rounded-lg border bg-card shadow-panel">
                {results.map((item) => (
                  <Link
                    key={item.title}
                    to={item.to}
                    onClick={() => setQuery("")}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted"
                  >
                    <span className="font-semibold text-brand-deep">{item.title}</span>
                    <span className="tag">{item.kind}</span>
                  </Link>
                ))}
              </div>
            )}
          </label>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
            <Link to="/oglasi" className="bell-trigger" aria-label="Огласна табла">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-yellow text-[10px] font-bold text-brand-ink">
                  {unreadCount}
                </span>
              )}
            </Link>
            <div className="relative">
              {signedIn ? (
              <button
                className="profile-trigger"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-sm font-bold text-primary">
                  {initials}
                </span>
                <span className="hidden max-w-40 truncate lg:inline">
                  {profile.name}
                  {isAdmin && <small className="ml-2 rounded bg-brand-pale px-1.5 py-0.5 text-[10px] font-black uppercase text-brand-deep">Раководител</small>}
                </span>
                <ChevronDown className={`h-4 w-4 ${menuOpen ? "rotate-180" : ""}`} />
              </button>
              ) : (
                <Link to="/najava" className="cta-link inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground">
                  Најави се
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              {signedIn && menuOpen && (
                <div className="profile-menu" role="menu">
                  <p>{profile.name}</p>
                  <Link to="/profil" onClick={() => setMenuOpen(false)}>Мој профил</Link>
                  {isAdmin && <Link to="/admin" onClick={() => setMenuOpen(false)}>Админ панел</Link>}
                  <Link to="/profil" onClick={() => startEdit()}>Уреди профил</Link>
                  <Link to="/odjava" onClick={() => setMenuOpen(false)}>Одјава</Link>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="sodrzina" className="mx-auto w-full max-w-[1500px] flex-1 p-4 sm:p-6 lg:p-8">
          {consent && pushState === "default" && (
            <div className="push-banner">
              <p>Известувањата за огласната табла, календарот и форумот се вклучени. Дозволи ги во прелистувачот за да стигнуваат и кога страницата е затворена.</p>
              <button
                type="button"
                onClick={() => {
                  enablePush().then((state) => setPushState(state === "granted" ? "granted" : Notification.permission)).catch(() => {});
                }}
              >
                Дозволи известувања
              </button>
            </div>
          )}
          {children}
        </main>
        <footer className="border-t px-4 py-6 sm:px-6 lg:px-8">
          <nav className="mx-auto flex max-w-[1500px] flex-wrap gap-x-4 gap-y-2 text-sm font-semibold" aria-label="Политики">
            <Link to="/privatnost" className="text-brand-deep hover:text-primary">Приватност</Link>
            <Link to="/uslovi" className="text-brand-deep hover:text-primary">Услови</Link>
            <Link to="/kolacinja" className="text-brand-deep hover:text-primary">Колачиња</Link>
            <button type="button" className="footer-link" onClick={() => setCookiesOpen(true)}>
              Поставки за колачиња
            </button>
          </nav>
          <p className="mx-auto mt-3 max-w-[1500px] text-xs text-muted-foreground">
            © {new Date().getFullYear()} Клуб на наставници. Темите, сметките и записите на раководителот се чуваат во базата на клубот.
          </p>
        </footer>
        <CookieConsent />
      </div>
      {inviteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={() => { setInviteOpen(false); setInvited(""); }}>
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-panel" onClick={(event) => event.stopPropagation()}>
            {invited ? (
              <>
                <h2 className="text-lg font-black text-brand-deep">Поканата е испратена!</h2>
                <p className="mt-2 text-sm text-muted-foreground">Поканата за {invited} е подготвена и се отвора во вашата е-пошта. Испратете ја оттаму. Ви благодариме што го споделувате Клубот.</p>
                <Button className="mt-4" onClick={() => { setInviteOpen(false); setInvited(""); }}>Во ред</Button>
              </>
            ) : (
              <form
                className="space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  try {
                    const data = await api.invite(inviteEmail);
                    const mail = data.invitation;
                    if (mail) window.location.href = `mailto:${mail.to}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`;
                  } catch {
                    /* поканата останува видлива и кога праќањето не е достапно */
                  }
                  setInvited(inviteEmail);
                  setInviteEmail("");
                }}
              >
                <h2 className="flex items-center gap-2 text-lg font-black text-brand-deep"><Heart className="h-5 w-5 text-primary" /> Препорачај го Клубот</h2>
                <p className="text-sm text-muted-foreground">Познаваш наставник/наставничка на кој/која би му/ѝ бил корисен Клубот?</p>
                <label className="block text-sm font-bold text-brand-deep">
                  Email адреса
                  <input required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="kolega@uciliste.mk" className="mt-1.5 h-11 w-full rounded-md border bg-card px-3 text-sm font-medium" />
                </label>
                <Button type="submit" className="w-full">Испрати покана</Button>
              </form>
            )}
          </div>
        </div>
      )}
      {contactOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={() => { setContactOpen(false); setContactSent(false); }}>
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-panel" onClick={(event) => event.stopPropagation()}>
            {contactSent ? (
              <>
                <h2 className="text-lg font-black text-brand-deep">Пораката е испратена</h2>
                <p className="mt-2 text-sm text-muted-foreground">Тимот на Клубот / LEAD ќе ви одговори наскоро.</p>
                <Button className="mt-4" onClick={() => { setContactOpen(false); setContactSent(false); }}>Во ред</Button>
              </>
            ) : (
              <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); setContactSent(true); }}>
                <h2 className="flex items-center gap-2 text-lg font-black text-brand-deep"><Mail className="h-5 w-5 text-primary" /> Контактирај нè</h2>
                <p className="text-sm text-muted-foreground">Прашање, предлог или потребна помош? Пишете му на тимот на Клубот на наставници / LEAD.</p>
                <label className="block text-sm font-bold text-brand-deep">
                  Име и презиме
                  <input required defaultValue={signedIn ? profile.name : ""} className="mt-1.5 h-11 w-full rounded-md border bg-card px-3 text-sm font-medium" />
                </label>
                <label className="block text-sm font-bold text-brand-deep">
                  Email
                  <input required type="email" placeholder="ime@uciliste.mk" className="mt-1.5 h-11 w-full rounded-md border bg-card px-3 text-sm font-medium" />
                </label>
                <label className="block text-sm font-bold text-brand-deep">
                  Порака
                  <textarea required rows={4} className="mt-1.5 w-full rounded-md border bg-card px-3 py-2 text-sm font-medium" />
                </label>
                <Button type="submit" className="w-full">Испрати</Button>
              </form>
            )}
          </div>
        </div>
      )}
      <UploadToast />
    </div>
  );
}
