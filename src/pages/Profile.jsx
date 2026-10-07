import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api";
import { defaultProfile, useApp } from "../compositor/AppCompositor";
import { Avatar, Button, PageHeader } from "../components/ui";

const activity = [
  "Сподели ресурс „Методи за инклузивна настава“",
  "Одговори на тема „Како да го мотивираме ученикот?“",
  "Се пријави на работилницата за ИКТ",
];

function TagEditor({ label, items, onChange }) {
  const [draft, setDraft] = useState("");
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-brand-deep">{label}</span>
      <div className="mb-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <button key={item} type="button" className="tag" onClick={() => onChange(items.filter((entry) => entry !== item))}>
            {item} ×
          </button>
        ))}
      </div>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const next = draft.trim();
          if (!next || items.includes(next)) return;
          onChange([...items, next]);
          setDraft("");
        }}
        className="h-11 w-full rounded-md border bg-card px-3 text-sm outline-none ring-ring focus:ring-2"
        placeholder="Додај и притисни Enter"
      />
    </label>
  );
}

export default function Profile() {
  const { profile, signedIn, isAdmin, authReady, editing, startEdit, cancelEdit, saveProfile } = useApp();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [form, setForm] = useState(profile);
  const [error, setError] = useState("");
  const wasEditing = useRef(false);

  useEffect(() => {
    if (editing && !wasEditing.current) {
      setForm(profile);
      setError("");
    }
    wasEditing.current = editing;
  }, [editing, profile]);

  function openEditor() {
    setForm(profile);
    setError("");
    startEdit();
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.role.trim()) {
      setError("Името и позицијата се задолжителни.");
      return;
    }
    try {
      await saveProfile({ ...form, name: form.name.trim(), role: form.role.trim() });
    } catch (reason) {
      setError(reason.message);
    }
  }

  if (!authReady) return <section className="panel">Се проверува најавата...</section>;
  if (!signedIn) return <Navigate to="/najava" replace />;

  return (
    <>
      <PageHeader
        eyebrow="Мој профил"
        title={profile.name}
        description="Вашиот професионален профил и активност во заедницата."
        action={<Button onClick={openEditor}>Уреди профил</Button>}
      />
      {editing && (
        <form className="panel mb-5 grid gap-4" onSubmit={submit}>
          <h2 className="section-heading">Уредување на профил</h2>
          {[
            ["name", "Име и презиме"],
            ["role", "Позиција"],
            ["school", "Училиште"],
            ["location", "Локација"],
            ["areas", "Области"],
          ].map(([field, label]) => (
            <label key={field} className="block">
              <span className="mb-1 block text-sm font-bold text-brand-deep">{label}</span>
              <input
                value={form[field]}
                onChange={(event) => update(field, event.target.value)}
                className="h-11 w-full rounded-md border bg-card px-3 text-sm outline-none ring-ring focus:ring-2"
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand-deep">За мене</span>
            <textarea
              value={form.bio}
              onChange={(event) => update("bio", event.target.value)}
              rows={4}
              className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
          </label>
          <TagEditor label="Професионални интереси" items={form.interests} onChange={(interests) => update("interests", interests)} />
          <TagEditor label="Вештини" items={form.skills} onChange={(skills) => update("skills", skills)} />
          {error && <p className="text-sm font-semibold text-brand-urgent">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Зачувај</Button>
            <Button type="button" variant="outline" onClick={cancelEdit}>Откажи</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setForm(defaultProfile);
                setError("");
              }}
            >
              Врати ги почетните податоци
            </Button>
          </div>
        </form>
      )}
      <div className="grid gap-5 min-[1100px]:grid-cols-[280px_minmax(0,1fr)]">
        <section className="panel text-center">
          <div className="flex justify-center"><Avatar name={profile.name} size="lg" /></div>
          <h2 className="mt-4 text-xl font-bold text-brand-deep">{profile.name}</h2>
          <p className="text-sm text-muted-foreground">{profile.role}</p>
          <p className="mt-2 text-xs font-bold uppercase text-primary">{isAdmin ? "Пристап: раководител" : "Пристап: наставник"}</p>
          {isAdmin && <Button asChild className="mt-4"><Link to="/admin">Отвори админ панел</Link></Button>}
          <div className="mt-5 space-y-2 border-t pt-5 text-left text-sm">
            <p><b>Училиште:</b> {profile.school}</p>
            <p><b>Локација:</b> {profile.location}</p>
            <p><b>Области:</b> {profile.areas}</p>
          </div>
        </section>
        <div className="space-y-5">
          <section className="panel">
            <h2 className="section-heading">За мене</h2>
            <p className="text-sm leading-6 text-muted-foreground">{profile.bio}</p>
          </section>
          <section className="grid gap-5 md:grid-cols-2">
            <div className="panel">
              <h2 className="section-heading">Професионални интереси</h2>
              <div className="flex flex-wrap gap-2">{profile.interests.map((item) => <span key={item} className="tag">{item}</span>)}</div>
            </div>
            <div className="panel">
              <h2 className="section-heading">Вештини</h2>
              <div className="flex flex-wrap gap-2">{profile.skills.map((item) => <span key={item} className="tag">{item}</span>)}</div>
            </div>
          </section>
          <section className="panel">
            <h2 className="section-heading">Препорачај го клубот</h2>
            <p className="mb-3 text-sm text-muted-foreground">На внесената е-пошта се испраќа иста покана за секој наставник.</p>
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={async (event) => {
                event.preventDefault();
                setInviteNote("");
                try {
                  const result = await api.invite(inviteEmail);
                  const mail = result.invitation;
                  window.location.href = `mailto:${mail.to}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`;
                  setInviteEmail("");
                  setInviteNote("Поканата е подготвена и се отвора во вашата е-пошта.");
                } catch (reason) {
                  setInviteNote(reason.message);
                }
              }}
            >
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="е-пошта на колегата"
                className="h-11 flex-1 rounded-md border bg-card px-3 text-sm outline-none ring-ring focus:ring-2"
              />
              <Button type="submit">Испрати покана</Button>
            </form>
            {inviteNote && <p className="mt-3 text-sm font-semibold text-brand-deep">{inviteNote}</p>}
          </section>
          <section className="panel">
            <h2 className="section-heading">Последна активност</h2>
            {activity.map((item, index) => (
              <div key={item} className="flex gap-3 border-b py-3 last:border-0">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <div>
                  <b className="text-sm text-brand-deep">{item}</b>
                  <p className="text-xs text-muted-foreground">пред {index + 1} ден</p>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
