import { useEffect, useState } from "react";
import { FileSpreadsheet, FileText, ScrollText, Stamp } from "lucide-react";
import { api } from "../api";
import { useApp } from "../compositor/AppCompositor";
import { downloadText } from "../download";
import { placeFile } from "../media";
import { Button, FilePick, PageHeader, uploadFailed } from "../components/ui";

const folders = ["Водич за клубот", "Правила за користење", "Правилници"];

function FileIcon({ type }) {
  if (type === "XLSX") return <FileSpreadsheet />;
  if (type === "DOCX") return <ScrollText />;
  return <FileText />;
}

async function saveFile(item, onCount) {
  const result = await api.downloadDocument(item.id);
  onCount?.(item.id, result.downloads);
  if (item.fileUrl) {
    const link = document.createElement("a");
    link.href = item.fileUrl;
    link.download = "";
    link.click();
    return;
  }
  downloadText(`${item.title}.${item.type.toLowerCase()}.txt`, `${item.title}\n${item.folder}\n${item.type} · ${item.size}\n${item.date}\n\n${item.body || item.title}`);
}

export default function Documents({ embedded = false }) {
  const { isAdmin, catalog } = useApp();
  const [documents, setDocuments] = useState(catalog.documents);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ title: "", type: "PDF", folder: folders[0], body: "" });

  function load() {
    return api.documents().then((data) => setDocuments(data.documents));
  }

  useEffect(() => {
    load().catch((reason) => setError(reason.message));
  }, []);

  function noteDownload(id, downloads) {
    setDocuments((current) => current.map((item) => (item.id === id ? { ...item, downloads } : item)));
  }
  const retired = /шаблон|подготовка на час|годишна програма|формативно|евиденција|согласност|менторска|наставни материјали/i;
  const items = documents.filter((item) => !retired.test(`${item.title} ${item.folder}`));
  return (
    <>
      {!embedded && (
        <PageHeader
          title="Документи на клубот"
          description="Водич за клубот, правила за користење и правилници."
          action={isAdmin ? <Button onClick={() => setUploading((value) => !value)}>Прикачи ресурс</Button> : null}
        />
      )}
      {embedded && isAdmin && <div className="mb-4"><Button onClick={() => setUploading((value) => !value)}>Прикачи ресурс</Button></div>}
      {error && <p className="mb-4 text-sm font-semibold text-brand-urgent">{error}</p>}
      {uploading && (
        <form
          className="panel mb-5 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!draft.title.trim()) return;
            const file = event.currentTarget.elements.file.files?.[0];
            try {
              const payload = { ...draft };
              if (file) {
                const placed = await placeFile(file);
                payload.name = placed.name;
                if (placed.url) {
                  payload.url = placed.url;
                  payload.size = placed.size;
                } else payload.data = placed.data;
              }
              await api.addDocument(payload);
              setDraft({ title: "", type: "PDF", folder: "Други документи", body: "" });
              setUploading(false);
              await load();
            } catch (reason) {
              setError(reason.message);
              if (file) uploadFailed(reason.message);
            }
          }}
        >
          <h2 className="section-heading">Нов документ</h2>
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            className="h-11 rounded-md border bg-card px-3 text-sm"
            placeholder="Наслов"
            required
          />
          <div className="grid gap-3 min-[700px]:grid-cols-2">
            <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} className="h-11 rounded-md border bg-card px-3 text-sm">
              {["PDF", "DOCX", "XLSX"].map((type) => <option key={type}>{type}</option>)}
            </select>
            <select value={draft.folder} onChange={(event) => setDraft({ ...draft, folder: event.target.value })} className="h-11 rounded-md border bg-card px-3 text-sm">
              {folders.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <textarea
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            rows={3}
            className="rounded-md border bg-card px-3 py-2 text-sm"
            placeholder="Краток опис"
          />
          <FilePick name="file" />
          <div className="flex gap-2">
            <Button type="submit">Зачувај</Button>
            <Button type="button" variant="outline" onClick={() => setUploading(false)}>Откажи</Button>
          </div>
        </form>
      )}
      <section className="document-feature mb-7">
        <div>
          <span className="eyebrow-light"><Stamp className="h-4 w-4" /> ОФИЦИЈАЛНИ ДОКУМЕНТИ</span>
          <h2 className="mt-2 text-2xl font-black">Правила, водичи и членство</h2>
          <p className="mt-1 max-w-xl text-sm text-primary-foreground/75">
            Само официјални документи поврзани со функционирањето и членството во Клубот на наставници.
          </p>
        </div>
      </section>
      <section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={`${item.title}-${item.date}`} className="document-card group">
              <div className="flex items-start justify-between">
                <span className={`file-icon ${item.type.toLowerCase()}`}><FileIcon type={item.type} /></span>
                <span className="file-badge">{item.type}</span>
              </div>
              <p className="mt-5 text-xs font-black uppercase text-primary">{item.folder}</p>
              <h3 className="mt-1 text-lg font-black text-brand-deep">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.size} · {item.date} · {item.downloads || 0} симнувања</p>
              <div className="mt-5 border-t pt-4">
                <button type="button" className="pill" onClick={() => saveFile(item, noteDownload)}>
                  Преземи
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
