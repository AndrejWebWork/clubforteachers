import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, MessageCircle, Users } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../compositor/AppCompositor";
import { Avatar, Button, PageHeader, Signal } from "../components/ui";

const categories = ["Методика и пракса", "Идеи од училишта", "Прашања", "Добра практика", "Технологија", "Професионален развој"];

export function Forum() {
  const { topics, addTopic, forumCategory, setForumCategory, signedIn } = useApp();
  const navigate = useNavigate();
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ title: "", category: categories[0], body: "" });
  return (
    <>
      <PageHeader
        eyebrow="Професионална заедница"
        title="Даскалски форум"
        description="Прашај, сподели искуство и разговарај со колеги од цела земја."
      />
      {writing && (
        <form
          className="panel mb-5 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!draft.title.trim() || !draft.body.trim()) return;
            try {
              const id = await addTopic(draft);
              setWriting(false);
              setError("");
              setDraft({ title: "", category: categories[0], body: "" });
              navigate(`/forum/${id}`);
            } catch (reason) {
              setError(reason.message);
            }
          }}
        >
          <h2 className="section-heading">Нова тема</h2>
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            className="h-11 rounded-md border bg-card px-3 text-sm"
            placeholder="Наслов на темата"
            required
          />
          <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="h-11 rounded-md border bg-card px-3 text-sm">
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
          <textarea
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            rows={4}
            className="rounded-md border bg-card px-3 py-2 text-sm"
            placeholder="Што сакате да прашате или споделите?"
            required
          />
          {error && <p className="text-sm font-semibold text-brand-urgent">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit">Објави</Button>
            <Button type="button" variant="outline" onClick={() => setWriting(false)}>Откажи</Button>
          </div>
        </form>
      )}
      <section className="forum-start mb-5">
        <div className="min-w-0">
          <span className="eyebrow-light"><Users className="h-4 w-4" /> Заедница на наставници</span>
          <h2 className="mt-1 text-xl font-black sm:text-2xl">Имаш прашање или идеја?</h2>
          <p className="text-sm text-primary-foreground/80">Започни разговор — колегите обично одговараат во рок од еден час.</p>
        </div>
        {signedIn ? (
          <Button variant="yellow" onClick={() => setWriting((value) => !value)}>Започни тема</Button>
        ) : (
          <Button asChild variant="yellow"><Link to="/najava">Започни тема</Link></Button>
        )}
      </section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-black text-brand-deep">Моментално активни теми</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {["Сите", ...categories].map((item) => (
            <button key={item} type="button" className={`sort-chip ${forumCategory === item ? "active" : ""}`} onClick={() => setForumCategory(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="panel divide-y p-0">
        {topics.filter((item) => forumCategory === "Сите" || item.category === forumCategory).map((item) => (
          <Link key={item.id} to={`/forum/${item.id}`} className="topic-row group">
            <Avatar name={item.author} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="type-chip">{item.category}</span>
                {item.isNew && <Signal label="НОВО" />}
              </div>
              <h3 className="mt-1 truncate font-black text-brand-deep group-hover:text-primary">{item.title}</h3>
              <p className="text-xs text-muted-foreground">{item.author} · последна активност {item.time}</p>
            </div>
            <div className="hidden shrink-0 gap-5 text-sm font-bold text-brand-deep sm:flex">
              <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4 text-primary" />{item.replies}</span>
              <span className="flex items-center gap-1"><Eye className="h-4 w-4 text-primary" />{item.views}</span>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
          </Link>
        ))}
      </div>
    </>
  );
}

export function Topic() {
  const { topicId } = useParams();
  const { topics, addReply, deleteTopic, isAdmin, signedIn, authReady, markTopicView } = useApp();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!topicId || !authReady) return;
    markTopicView(topicId).catch(() => {});
  }, [topicId, authReady, signedIn, markTopicView]);
  const item = topics.find((topic) => topic.id === topicId);
  if (!item) return <div className="panel">Темата не е пронајдена.</div>;
  return (
    <div className="mx-auto max-w-4xl">
      <Button asChild variant="ghost" className="mb-4">
        <Link to="/forum"><ArrowLeft className="h-4 w-4" /> Назад кон Даскалски форум</Link>
      </Button>
      <article className="panel">
        <span className="tag">{item.category}</span>
        <h1 className="mt-4 text-2xl font-bold text-brand-deep">{item.title}</h1>
        <div className="mt-5 flex gap-3">
          <Avatar name={item.author} />
          <div>
            <b>{item.author}</b>
            <p className="text-xs text-muted-foreground">{item.time}</p>
          </div>
        </div>
        <p className="my-6 leading-7">{item.body}</p>
        {isAdmin && (
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await deleteTopic(item.id);
                navigate("/forum");
              } catch (reason) {
                setError(reason.message);
              }
            }}
          >
            Избриши тема
          </Button>
        )}
        <div className="border-t pt-5">
          <h2 className="font-bold text-brand-deep">Одговори од заедницата</h2>
          {item.messages.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Сè уште нема одговори. Бидете први.</p>}
          {item.messages.map((reply) => (
            <div key={`${reply.author}-${reply.text}`} className="mt-4 flex gap-3 rounded-md bg-muted p-4">
              <Avatar name={reply.author} size="sm" />
              <div>
                <b className="text-sm text-brand-deep">{reply.author}</b>
                <p className="text-sm leading-6">{reply.text}</p>
              </div>
            </div>
          ))}
        </div>
        <form
          className="mt-5 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!signedIn) {
              setError("Најавете се за да одговорите.");
              return;
            }
            if (!text.trim()) return;
            try {
              await addReply(item.id, text);
              setText("");
              setError("");
            } catch (reason) {
              setError(reason.message);
            }
          }}
        >
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            className="rounded-md border bg-card px-3 py-2 text-sm"
            placeholder="Напишете одговор"
          />
          {error && <p className="text-sm font-semibold text-brand-urgent">{error}</p>}
          <Button type="submit">Одговори на темата</Button>
        </form>
      </article>
    </div>
  );
}
