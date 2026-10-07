import { cloneElement, createContext, isValidElement, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgePlus, CalendarClock, CircleCheck, DoorOpen, Flag, Hourglass, Search, Siren, Upload } from "lucide-react";

const ActionContext = createContext(null);

export function ActionProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  return (
    <ActionContext.Provider value={{ open: setDialog }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={() => setDialog(null)}>
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{dialog.title || "Успешно!"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {dialog.description || "Ова е демонстрациска акција во прототипот."}
            </p>
            <button
              className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              onClick={() => setDialog(null)}
            >
              Во ред
            </button>
          </div>
        </div>
      )}
    </ActionContext.Provider>
  );
}

export function useAction() {
  return useContext(ActionContext);
}

const variants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border border-input bg-card text-foreground hover:bg-accent",
  ghost: "bg-transparent text-foreground hover:bg-accent",
  yellow: "bg-brand-yellow text-brand-ink shadow-cta hover:bg-brand-yellow/90",
};
const sizes = {
  default: "h-9 px-4",
  sm: "h-8 px-3 text-xs",
  icon: "h-9 w-9",
};

export function SuccessPop({ title, text, onClose }) {
  useEffect(() => {
    if (!title) return undefined;
    const close = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [title, onClose]);
  if (!title) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="success-pop-title">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-panel" onClick={(event) => event.stopPropagation()}>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-yellow text-brand-ink">
          <CircleCheck className="h-6 w-6" />
        </span>
        <h2 id="success-pop-title" className="mt-3 text-lg font-black text-brand-deep">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
        <Button className="mt-4" onClick={onClose}>Во ред</Button>
      </div>
    </div>
  );
}

export function FilePick({ inputRef, onChange, ...props }) {
  const localRef = useRef(null);
  const [picked, setPicked] = useState("");

  function bind(node) {
    localRef.current = node;
    if (typeof inputRef === "function") inputRef(node);
    else if (inputRef) inputRef.current = node;
    if (!node || node.dataset.pickBound) return;
    node.dataset.pickBound = "1";
    const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    Object.defineProperty(node, "value", {
      configurable: true,
      get() { return desc.get.call(this); },
      set(next) {
        desc.set.call(this, next);
        if (!next) setPicked("");
      },
    });
  }

  useEffect(() => {
    const form = localRef.current?.form;
    if (!form) return undefined;
    const clear = () => setPicked("");
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);

  return (
    <div className="file-pick">
      <input
        {...props}
        ref={bind}
        type="file"
        onChange={(event) => {
          setPicked(event.target.files?.[0]?.name || "");
          onChange?.(event);
        }}
      />
      <button type="button" className="file-pick-btn" onClick={() => localRef.current?.click()}>
        <Upload className="h-4 w-4" />
        Одбери фајл
      </button>
      <span className={`file-pick-name${picked ? "" : " is-empty"}`}>{picked || "Нема избрана датотека"}</span>
    </div>
  );
}

export function Button({ variant = "default", size = "default", className = "", children, asChild = false, ...props }) {
  const classes = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors ${variants[variant]} ${sizes[size]} ${className}`;
  if (asChild && isValidElement(children)) {
    return cloneElement(children, { className: `${classes} ${children.props.className || ""}`, ...props });
  }
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

export function ActionButton({ label, title, description, icon, className = "", variant = "default" }) {
  const { open } = useAction();
  return (
    <Button variant={variant} className={className} onClick={() => open({ title, description })}>
      {icon}
      {label}
    </Button>
  );
}

export function PageHeader({ eyebrow = "Клуб на наставници", title, description, action }) {
  return (
    <header className="brand-header mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 overflow-hidden">
      <div className="relative z-10 min-w-0">
        <p className="mb-2 text-xs font-black uppercase text-primary">{eyebrow}</p>
        <h1 className="text-3xl font-black text-brand-deep sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium text-muted-foreground sm:text-base">{description}</p>
      </div>
      {action && (
        <div className="relative z-10">
          {typeof action === "string" ? <ActionButton label={action} /> : action}
        </div>
      )}
    </header>
  );
}

export function SectionHead({ icon, title, linkLabel, to }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5 text-brand-deep">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-soft text-primary">{icon}</span>
        <h2 className="min-w-0 text-lg font-black leading-tight">{title}</h2>
      </div>
      {to && (
        <Link to={to} className="see-all group shrink-0 whitespace-nowrap">
          {linkLabel || "Види ги сите"} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

const signalMap = {
  НОВО: { cls: "new", icon: BadgePlus },
  ВАЖНО: { cls: "important", icon: Flag },
  "ОТВОРЕНА ПРИЈАВА": { cls: "open", icon: DoorOpen },
  ОТВОРЕНО: { cls: "open", icon: DoorOpen },
  "РОКОТ ИСТЕКУВА": { cls: "urgent", icon: Hourglass },
  "ПОСЛЕДЕН ДЕН": { cls: "last", icon: Siren },
  НАСКОРО: { cls: "soon", icon: CalendarClock },
};

export function Signal({ label, className = "" }) {
  const item = signalMap[label] || { cls: "new", icon: null };
  const Icon = item.icon;
  return (
    <span className={`signal ${item.cls} ${className}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function Avatar({ name, size = "md" }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  const box = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-20 w-20 text-xl" : "h-10 w-10 text-sm";
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-primary ${box}`}>
      {initials}
    </span>
  );
}

export function FilterGrid({ items, render, placeholder = "Пребарај...", category: controlledCategory, onCategory }) {
  const [query, setQuery] = useState("");
  const [localCategory, setLocalCategory] = useState("Сите");
  const category = controlledCategory ?? localCategory;
  const setCategory = onCategory ?? setLocalCategory;
  const categories = ["Сите", ...new Set(items.map((item) => item.category))];
  const filtered = items.filter(
    (item) =>
      (category === "Сите" || item.category === category) &&
      item.title.toLocaleLowerCase("mk").includes(query.toLocaleLowerCase("mk")),
  );
  return (
    <>
      <div className="filter-bar mb-6">
        <label className="relative block min-w-0 flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-md border border-transparent bg-card pl-10 pr-3 text-sm outline-none ring-ring focus:ring-2"
            placeholder={placeholder}
          />
        </label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {categories.map((item) => (
            <button key={item} type="button" className={`sort-chip ${category === item ? "active" : ""}`} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="panel py-14 text-center text-muted-foreground">Нема резултати за избраните критериуми.</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map(render)}</div>
      )}
    </>
  );
}
