import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../compositor/AppCompositor";
import { api } from "../api";
import { placeFile, uploadVideoFile } from "../media";
import TrainingAdmin from "../components/TrainingAdmin";
import FeedAdmin from "../components/FeedAdmin";
import EventAdmin from "../components/EventAdmin";
import { Button, FilePick, PageHeader, SuccessPop, uploadFailed } from "../components/ui";

const tabs = [
  ["accounts", "Сметки"],
  ["videos", "Видеа"],
  ["files", "Прилози"],
  ["mail", "Пошта"],
  ["trainings", "Обуки"],
  ["notices", "Огласи"],
  ["calendar", "Календар"],
  ["events", "Настани"],
];

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-brand-deep">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "h-11 w-full rounded-md border bg-card px-3 text-sm outline-none ring-ring focus:ring-2";

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadLogins(rows) {
  const csv = ["\uFEFFе-пошта,име,лозинка", ...rows.map((row) => [row.email, row.name, row.password].map(csvCell).join(","))].join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = "clenovi-lozinki.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function Admin() {
  const { signedIn, isAdmin, authReady } = useApp();
  const [tab, setTab] = useState("accounts");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [videos, setVideos] = useState([]);
  const [files, setFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [accountForm, setAccountForm] = useState({ name: "", email: "", password: "", role: "teacher", school: "", title: "" });
  const [videoForm, setVideoForm] = useState({ title: "", description: "", url: "" });
  const [imported, setImported] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [storageMode, setStorageMode] = useState("local");
  const videoFile = useRef(null);
  const memberFile = useRef(null);
  const [mailForm, setMailForm] = useState({ subject: "", message: "", allTeachers: true, recipientIds: [], attachmentIds: [] });

  async function load() {
    const [accountData, videoData, fileData, mailData] = await Promise.all([
      api.accounts(),
      api.videos(),
      api.attachments(),
      api.mail(),
    ]);
    setAccounts(accountData.accounts);
    setVideos(videoData.videos);
    setFiles(fileData.attachments);
    setMessages(mailData.messages);
    const storage = await api.mediaStorage().catch(() => ({ mode: "local" }));
    setStorageMode(storage.mode || "local");
  }

  useEffect(() => {
    if (!isAdmin) return;
    load().catch((reason) => setError(reason.message));
  }, [isAdmin]);

  async function run(action, upload = false) {
    setError("");
    setNotice("");
    try {
      await action();
      await load();
    } catch (reason) {
      setUploadProgress(0);
      setError(reason.message);
      if (upload) uploadFailed(reason.message);
    }
  }

  if (!authReady) return <section className="panel">Се проверува најавата...</section>;

  if (!signedIn || !isAdmin) {
    return (
      <>
        <PageHeader eyebrow="Само за раководител" title="Админ панел" description="Сметки, материјали и пошта не се достапни за наставнички сметки." />
        <section className="panel max-w-xl">
          <p className="text-sm leading-6 text-muted-foreground">
            {signedIn
              ? "Најавени сте како наставник. Можете да објавувате на форумот и да ги гледате материјалите, без алатките на раководителот."
              : "Најавете се со сметката на раководителот за да го отворите панелот."}
          </p>
          {!signedIn && (
            <Button asChild className="mt-4">
              <Link to="/najava">Најави се</Link>
            </Button>
          )}
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Раководител"
        title="Админ панел"
        description="Отворање сметки, видеоматеријали, прилози и пораки до наставниците. Наставниците го немаат овој дел."
      />
      <div className="mb-5 flex flex-wrap gap-x-4 gap-y-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`sort-chip ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <p className="mb-4 text-sm font-semibold text-brand-urgent">{error}</p>}
      {notice && <p className="mb-4 text-sm font-semibold text-brand-deep">{notice}</p>}
      <SuccessPop title={done?.title} text={done?.text} onClose={() => setDone(null)} />

      {tab === "trainings" && <TrainingAdmin />}
      {tab === "notices" && <FeedAdmin kind="notice" />}
      {tab === "calendar" && <FeedAdmin kind="calendar" />}
      {tab === "events" && <EventAdmin />}

      {tab === "accounts" && (
        <div className="grid gap-5 min-[1100px]:grid-cols-[300px_minmax(0,1fr)]">
          <form
            className="panel grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                await api.createAccount(accountForm);
                setAccountForm({ name: "", email: "", password: "", role: "teacher", school: "", title: "" });
                setNotice("Сметката е отворена.");
              });
            }}
          >
            <h2 className="section-heading">Нова сметка</h2>
            <Field label="Име и презиме">
              <input className={inputClass} value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} required />
            </Field>
            <Field label="Е-пошта">
              <input type="email" className={inputClass} value={accountForm.email} onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })} required />
            </Field>
            <Field label="Привремена лозинка">
              <input type="text" className={inputClass} value={accountForm.password} onChange={(event) => setAccountForm({ ...accountForm, password: event.target.value })} minLength={8} required />
            </Field>
            <Field label="Училиште">
              <input className={inputClass} value={accountForm.school} onChange={(event) => setAccountForm({ ...accountForm, school: event.target.value })} />
            </Field>
            <Field label="Позиција">
              <input className={inputClass} value={accountForm.title} onChange={(event) => setAccountForm({ ...accountForm, title: event.target.value })} placeholder="Наставник по ..." />
            </Field>
            <Field label="Улога">
              <select className={inputClass} value={accountForm.role} onChange={(event) => setAccountForm({ ...accountForm, role: event.target.value })}>
                <option value="teacher">Наставник</option>
                <option value="admin">Раководител</option>
              </select>
            </Field>
            <Button type="submit">Отвори сметка</Button>
          </form>
          <section className="panel">
            <h2 className="section-heading">Внес од датотека</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              CSV или Word со е-пошти. Клубот отвора наставнички сметки, смислува лозинка за секоја и ја дава само во овој список и во CSV-от.
            </p>
            <form
              className="mb-4 flex flex-wrap items-center gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const file = memberFile.current?.files?.[0];
                if (!file) return;
                run(async () => {
                  const data = await api.importAccounts(file);
                  setImported(data.created);
                  memberFile.current.value = "";
                  const missed = data.skipped.length ? ` Прескокнати: ${data.skipped.length}.` : "";
                  setNotice(`Отворени се ${data.created.length} сметки.${missed}`);
                }, true);
              }}
            >
              <FilePick inputRef={memberFile} accept=".csv,.txt,.docx,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
              <Button type="submit">Внеси и направи лозинки</Button>
              {imported.length > 0 && (
                <Button type="button" variant="outline" onClick={() => downloadLogins(imported)}>Преземи CSV</Button>
              )}
            </form>
            {imported.length > 0 && (
              <div className="mb-5 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-brand-deep">
                      <th className="py-2 pr-3">Е-пошта</th>
                      <th className="py-2 pr-3">Име</th>
                      <th className="py-2">Лозинка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imported.map((row) => (
                      <tr key={row.email} className="border-t">
                        <td className="py-2 pr-3">{row.email}</td>
                        <td className="py-2 pr-3">{row.name}</td>
                        <td className="py-2 font-bold">{row.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h2 className="section-heading">Членови</h2>
            <div className="divide-y">
              {accounts.map((account) => (
                <div key={account.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
                  <div>
                    <b className="text-brand-deep">{account.name}</b>
                    <p className="text-sm text-muted-foreground">{account.email} · {account.school}</p>
                  </div>
                  <select
                    className={inputClass}
                    value={account.role}
                    onChange={(event) => run(() => api.setRole(account.id, event.target.value))}
                  >
                    <option value="teacher">Наставник</option>
                    <option value="admin">Раководител</option>
                  </select>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "videos" && (
        <div className="grid gap-5 min-[1100px]:grid-cols-[300px_minmax(0,1fr)]">
          <form
            className="panel grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const file = videoFile.current?.files?.[0];
              const title = videoForm.title.trim();
              run(async () => {
                setUploadProgress(0);
                const url = file ? await uploadVideoFile(file, setUploadProgress) : videoForm.url.trim();
                await api.addVideo({ ...videoForm, url });
                setVideoForm({ title: "", description: "", url: "" });
                if (videoFile.current) videoFile.current.value = "";
                setUploadProgress(0);
                setDone({
                  title: "Видеото е прикачено",
                  text: `„${title}“ е успешно додадено. Наставниците го гледаат во Материјали.`,
                });
              }, Boolean(file));
            }}
          >
            <h2 className="section-heading">Ново видео</h2>
            <p className="text-sm text-muted-foreground">
              {storageMode === "remote"
                ? "Снимката оди на надворешниот склад. Видео над 800 MB се качува на делови. Во базата останува само врската."
                : "Снимката се стеснува до 1080p и не влегува во базата. Зачуваниот фајл е помал. Складот е приватен склад на Filebase. Наставникот го гледа видеото преку страницата, со кратка врска."}
            </p>
            <Field label="Наслов">
              <input className={inputClass} value={videoForm.title} onChange={(event) => setVideoForm({ ...videoForm, title: event.target.value })} required />
            </Field>
            <Field label="Опис">
              <textarea className="w-full rounded-md border bg-card px-3 py-2 text-sm" rows={4} value={videoForm.description} onChange={(event) => setVideoForm({ ...videoForm, description: event.target.value })} />
            </Field>
            <Field label="Видеодатотека">
              <FilePick inputRef={videoFile} accept="video/mp4,video/webm,video/quicktime" />
            </Field>
            <Field label="Или готов https линк">
              <input className={inputClass} value={videoForm.url} onChange={(event) => setVideoForm({ ...videoForm, url: event.target.value })} placeholder="https://..." />
            </Field>
            {uploadProgress > 0 && <p className="text-sm font-bold text-brand-deep">{uploadProgress < 100 ? `Се качува… ${uploadProgress}%` : "Се зачувува…"}</p>}
            <Button type="submit">Додај видео</Button>
          </form>
          <section className="panel divide-y">
            {videos.map((video) => (
              <div key={video.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <b className="text-brand-deep">{video.title}</b>
                  <button type="button" className="text-xs font-bold text-muted-foreground" onClick={() => run(() => api.deleteVideo(video.id))}>Избриши</button>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{video.description}</p>
                {video.url && <p className="mt-1 text-sm font-bold text-primary">Снимката е поставена</p>}
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === "files" && (
        <div className="grid gap-5 min-[1100px]:grid-cols-[300px_minmax(0,1fr)]">
          <form
            className="panel grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const file = event.currentTarget.elements.file.files?.[0];
              if (!file) return;
              if (file.size > 4 * 1024 * 1024) {
                setError("Прилогот мора да биде до 4 MB.");
                uploadFailed("Прилогот мора да биде до 4 MB.");
                return;
              }
              const form = event.currentTarget;
              run(async () => {
                const placed = await placeFile(file);
                await api.addAttachment({
                  name: file.name,
                  mime: file.type,
                  ...(placed.url ? { url: placed.url, size: placed.size } : { data: placed.data }),
                });
                form.reset();
                setNotice("Прилогот е прикачен.");
              }, true);
            }}
          >
            <h2 className="section-heading">Прикачи датотека</h2>
            <FilePick name="file" required />
            <Button type="submit">Прикачи</Button>
          </form>
          <section className="panel divide-y">
            {files.length === 0 && <p className="text-sm text-muted-foreground">Сè уште нема прилози.</p>}
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-3 py-3">
                <a className="font-bold text-brand-deep" href={file.url} download>{file.name}</a>
                <button type="button" className="text-xs font-bold text-muted-foreground" onClick={() => run(() => api.deleteAttachment(file.id))}>Избриши</button>
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === "mail" && (
        <div className="grid gap-5 min-[1100px]:grid-cols-2">
          <form
            className="panel grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                const sent = await api.sendMail(mailForm);
                const to = sent.message.to.map((item) => item.email).join(",");
                window.location.href = `mailto:${to}?subject=${encodeURIComponent(sent.message.subject)}&body=${encodeURIComponent(sent.message.message)}`;
                setMailForm({ subject: "", message: "", allTeachers: true, recipientIds: [], attachmentIds: [] });
                setNotice("Пораката е запишана и се отвора во вашата е-пошта.");
              });
            }}
          >
            <h2 className="section-heading">Порака до наставници</h2>
            <label className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
              <input type="checkbox" checked={mailForm.allTeachers} onChange={(event) => setMailForm({ ...mailForm, allTeachers: event.target.checked })} />
              Сите наставници
            </label>
            {!mailForm.allTeachers && (
              <div className="grid gap-1">
                {accounts.filter((account) => account.role === "teacher").map((account) => (
                  <label key={account.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={mailForm.recipientIds.includes(account.id)}
                      onChange={(event) => {
                        const recipientIds = event.target.checked
                          ? [...mailForm.recipientIds, account.id]
                          : mailForm.recipientIds.filter((item) => item !== account.id);
                        setMailForm({ ...mailForm, recipientIds });
                      }}
                    />
                    {account.name}
                  </label>
                ))}
              </div>
            )}
            <Field label="Наслов">
              <input className={inputClass} value={mailForm.subject} onChange={(event) => setMailForm({ ...mailForm, subject: event.target.value })} required />
            </Field>
            <Field label="Порака">
              <textarea className="w-full rounded-md border bg-card px-3 py-2 text-sm" rows={5} value={mailForm.message} onChange={(event) => setMailForm({ ...mailForm, message: event.target.value })} required />
            </Field>
            {files.length > 0 && (
              <div>
                <span className="mb-1 block text-sm font-bold text-brand-deep">Прилози во записот</span>
                {files.map((file) => (
                  <label key={file.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={mailForm.attachmentIds.includes(file.id)}
                      onChange={(event) => {
                        const attachmentIds = event.target.checked
                          ? [...mailForm.attachmentIds, file.id]
                          : mailForm.attachmentIds.filter((item) => item !== file.id);
                        setMailForm({ ...mailForm, attachmentIds });
                      }}
                    />
                    {file.name}
                  </label>
                ))}
              </div>
            )}
            <Button type="submit">Испрати по е-пошта</Button>
          </form>
          <section className="panel">
            <h2 className="section-heading">Испратени</h2>
            {messages.length === 0 && <p className="text-sm text-muted-foreground">Сè уште нема испратени пораки.</p>}
            <div className="divide-y">
              {messages.map((item) => (
                <article key={item.id} className="py-3">
                  <b className="text-brand-deep">{item.subject}</b>
                  <p className="text-sm text-muted-foreground">{item.to.map((person) => person.email).join(", ")}</p>
                  <p className="mt-1 text-sm">{item.message}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
