import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, FileText, Link2, Presentation, Search, Wrench } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../compositor/AppCompositor";
import { downloadText, readDataUrl } from "../download";
import { Button, PageHeader } from "../components/ui";

const kinds = ["Сите", "Прирачник", "Презентација", "Работен лист", "Видео", "Линк", "Алатка", "Друго"];
const kindFromType = { PDF: "Прирачник", PPTX: "Презентација", DOCX: "Документ", LINK: "Линк", VIDEO: "Видео", WEB: "Алатка" };

function resourceKind(item) {
  return item.kind || kindFromType[item.type] || item.type;
}

function KindIcon({ kind }) {
  if (kind === "Видео") return <Presentation className="h-6 w-6" />;
  if (kind === "Линк") return <Link2 className="h-6 w-6" />;
  if (kind === "Алатка") return <Wrench className="h-6 w-6" />;
  return <FileText className="h-6 w-6" />;
}

export function Resources() {
  const { signedIn } = useApp();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("Сите");
  const [kind, setKind] = useState("Сите");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState({ title: "", category: "Материјали", type: "PDF", detail: "" });

  function load() {
    return api.resources().then((data) => setItems(data.resources));
  }

  useEffect(() => {
    load().catch((reason) => setError(reason.message));
  }, []);

  const visible = items.filter((item) => {
    const lead = item.source === "LEAD" || item.author === "LEAD тим";
    const sourceOk = source === "Сите" || (source === "Ресурси од LEAD" ? lead : !lead);
    const kindOk = kind === "Сите" || resourceKind(item) === kind || item.category === kind;
    return sourceOk && kindOk && item.title.toLocaleLowerCase("mk").includes(query.toLocaleLowerCase("mk"));
  });
  const count = (name) => items.filter((item) => {
    const lead = item.source === "LEAD" || item.author === "LEAD тим";
    if (name === "Сите") return true;
    return name === "Ресурси од LEAD" ? lead : !lead;
  }).length;

  return (
    <>
      <PageHeader
        eyebrow="Библиотека"
        title="Ресурси"
        description="Наставни материјали од LEAD и од колегите."
        action={signedIn ? <Button onClick={() => setOpen((value) => !value)}>Прикачи ресурс</Button> : null}
      />
      {error && <p className="mb-4 text-sm font-semibold text-brand-urgent">{error}</p>}
      {open && (
        <form
          className="panel mb-5 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const file = event.currentTarget.elements.file.files?.[0];
            try {
              const payload = { ...draft };
              if (file) {
                payload.data = await readDataUrl(file);
                payload.name = file.name;
              }
              await api.addResource(payload);
              setDraft({ title: "", category: "Материјали", type: "PDF", detail: "" });
              event.currentTarget.reset();
              setOpen(false);
              await load();
            } catch (reason) {
              setError(reason.message);
            }
          }}
        >
          <h2 className="section-heading">Нов ресурс</h2>
          <input className="h-11 rounded-md border bg-card px-3 text-sm" placeholder="Наслов" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="h-11 rounded-md border bg-card px-3 text-sm" placeholder="Категорија" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
            <select className="h-11 rounded-md border bg-card px-3 text-sm" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>
              {["PDF", "DOCX", "PPTX", "LINK"].map((type) => <option key={type}>{type}</option>)}
            </select>
          </div>
          <textarea className="rounded-md border bg-card px-3 py-2 text-sm" rows={3} placeholder="Опис" value={draft.detail} onChange={(event) => setDraft({ ...draft, detail: event.target.value })} />
          <input name="file" type="file" className="text-sm" />
          <div className="flex gap-2">
            <Button type="submit">Зачувај</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Откажи</Button>
          </div>
        </form>
      )}
      <div className="mb-4 grid gap-3 min-[700px]:grid-cols-3">
        {["Сите", "Ресурси од LEAD", "Ресурси од наставници"].map((item) => (
          <button key={item} type="button" onClick={() => setSource(item)} className={`source-card ${source === item ? "active" : ""}`}>
            <b>{item === "Сите" ? "Сите ресурси" : item}</b>
            <small>{count(item)} материјали</small>
          </button>
        ))}
      </div>
      <div className="filter-bar mb-5">
        <label className="resource-search">
          <Search className="h-4 w-4" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Пребарај ресурси..." />
        </label>
        <div className="kind-sort" role="group" aria-label="Вид на ресурс">
          {kinds.map((item) => (
            <button key={item} type="button" className={`sort-chip ${kind === item ? "active" : ""}`} onClick={() => setKind(item)}>{item}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 min-[700px]:grid-cols-2 min-[1200px]:grid-cols-3">
        {visible.map((item) => {
          const lead = item.source === "LEAD" || item.author === "LEAD тим";
          return (
            <Link key={item.id} to={`/resursi/${item.id}`} className="resource-card group">
              <span className={`resource-thumb ${lead ? "lead" : ""}`}><KindIcon kind={resourceKind(item)} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5">
                  <span className="file-badge">{resourceKind(item)}</span>
                  <span className={`type-chip ${lead ? "lead" : ""}`}>{lead ? "LEAD" : "Наставник"}</span>
                </div>
                <h3 className="mt-2 font-black leading-snug text-brand-deep group-hover:text-primary">{item.title}</h3>
                <p className="mt-1 text-xs font-black text-primary">{item.downloads || 0} симнувања</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.author} · {item.date}</p>
                <span className="see-all mt-2 text-sm">{item.type === "LINK" || item.type === "WEB" ? "Отвори" : "Погледни / преземи"} <ArrowRight className="h-4 w-4" /></span>
              </div>
            </Link>
          );
        })}
      </div>
      {!visible.length && <div className="panel py-10 text-center text-muted-foreground">Нема резултати.</div>}
    </>
  );
}

export function ResourceDetail() {
  const { resourceId } = useParams();
  const [item, setItem] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.resources().then((data) => {
      const found = data.resources.find((resource) => resource.id === resourceId);
      if (!found) setMissing(true);
      else setItem(found);
    }).catch(() => setMissing(true));
  }, [resourceId]);

  if (missing) return <div className="panel">Ресурсот не е пронајден.</div>;
  if (!item) return <div className="panel">Се вчитува...</div>;
  return (
    <div className="mx-auto max-w-4xl">
      <Button asChild variant="ghost" className="mb-4">
        <Link to="/resursi"><ArrowLeft className="h-4 w-4" /> Назад кон ресурси</Link>
      </Button>
      <article className="panel p-7 sm:p-10">
        <span className="tag">{item.type}</span>
        <p className="mt-5 text-sm font-bold text-primary">{item.category}</p>
        <h1 className="mt-2 text-3xl font-bold text-brand-deep">{item.title}</h1>
        <p className="mt-3 text-muted-foreground">Подготвил {item.author} · {item.date} · {item.downloads} симнувања</p>
        <div className="my-8 border-y py-8">
          <p className="leading-7">{item.detail}</p>
        </div>
        <Button
          onClick={async () => {
            const result = await api.downloadResource(item.id);
            setItem({ ...item, downloads: result.downloads });
            if (item.fileUrl) {
              const link = document.createElement("a");
              link.href = item.fileUrl;
              link.download = "";
              link.click();
              return;
            }
            downloadText(
              `${item.title}.${item.type === "LINK" ? "url" : item.type.toLowerCase()}.txt`,
              `${item.title}\n${item.author} · ${item.date}\n${item.category}\n\n${item.detail}`,
            );
          }}
        >
          {item.type === "LINK" ? "Преземи го линкот" : "Преземи ресурс"}
        </Button>
      </article>
    </div>
  );
}
