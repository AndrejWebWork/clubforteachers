import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../compositor/AppCompositor";
import { Avatar, Button, PageHeader } from "../components/ui";

function MemberCard({ member }) {
  return (
    <Link to={`/clenovi/${member.id}`} className="panel block transition hover:shadow-panel">
      <div className="flex items-center gap-3">
        <Avatar name={member.name} photo={member.photo} />
        <div className="min-w-0">
          <b className="block truncate text-brand-deep">{member.name}</b>
          <p className="truncate text-sm text-muted-foreground">{member.title || "Член"} · {member.school}</p>
        </div>
      </div>
    </Link>
  );
}

export default function Members() {
  const { memberId } = useParams();
  const { signedIn, authReady, isAdmin, profile } = useApp();
  const [members, setMembers] = useState([]);
  const [member, setMember] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!signedIn) return;
    setLoading(true);
    setError("");
    setMember(null);
    if (memberId) {
      api.directoryMember(memberId)
        .then((data) => setMember(data.member))
        .catch((reason) => setError(reason.message))
        .finally(() => setLoading(false));
      return;
    }
    api.directory()
      .then((data) => setMembers(data.members || []))
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [signedIn, memberId]);

  if (!authReady) return <section className="panel">Се проверува најавата...</section>;
  if (!signedIn) return <Navigate to="/najava" replace />;

  if (memberId) {
    if (error) return <p className="text-sm font-semibold text-brand-urgent">{error}</p>;
    if (loading || !member) return <section className="panel">Се вчитува профилот...</section>;
    return (
      <>
        <PageHeader
          eyebrow="Членови"
          title={member.name}
          description={[member.title, member.school, member.location].filter(Boolean).join(" · ")}
          action={<Button asChild variant="outline"><Link to="/clenovi">Назад кон членови</Link></Button>}
        />
        <article className="panel grid gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={member.name} photo={member.photo} />
            <div>
              <h2 className="text-xl font-black text-brand-deep">{member.name}</h2>
              <p className="text-sm text-muted-foreground">{member.title || "Член"}</p>
              {isAdmin && member.email && <p className="text-sm text-muted-foreground">{member.email}</p>}
            </div>
          </div>
          {member.bio && <p className="text-sm leading-6">{member.bio}</p>}
          {member.areas && <p className="text-sm"><b>Предмети:</b> {member.areas}</p>}
          {!!member.interests?.length && <p className="text-sm"><b>Интереси:</b> {member.interests.join(", ")}</p>}
          {!!member.skills?.length && <p className="text-sm"><b>Вештини:</b> {member.skills.join(", ")}</p>}
          {isAdmin && member.membership && (
            <p className="text-sm"><b>Членство:</b> {member.membership === "polno" ? "Мастер" : "Основно"}</p>
          )}
          <section>
            <h3 className="section-heading">Сертификати</h3>
            {!member.certificates?.length && <p className="text-sm text-muted-foreground">Сè уште нема генериран сертификат.</p>}
            <ul className="grid gap-2">
              {(member.certificates || []).map((item) => (
                <li key={item.id} className="text-sm">
                  <b className="text-brand-deep">{item.title}</b>
                  {item.issuedAt && <span className="text-muted-foreground"> · {new Date(item.issuedAt).toLocaleDateString("mk-MK")}</span>}
                </li>
              ))}
            </ul>
          </section>
          {profile.accountId === member.id && (
            <Button asChild variant="outline"><Link to="/profil">Уреди го својот профил</Link></Button>
          )}
        </article>
      </>
    );
  }

  const visible = members.filter((item) => {
    const hay = `${item.name} ${item.title} ${item.school}`.toLocaleLowerCase("mk");
    return !query || hay.includes(query.toLocaleLowerCase("mk"));
  });

  return (
    <>
      <PageHeader title="Членови" description="Профили на членовите на Клубот на наставници." />
      {error && <p className="mb-4 text-sm font-semibold text-brand-urgent">{error}</p>}
      {loading && <p className="mb-4 text-sm text-muted-foreground">Се вчитуваат членовите...</p>}
      <input
        className="mb-5 h-11 w-full max-w-md rounded-md border bg-card px-3 text-sm"
        placeholder="Пребарај по име, улога или училиште"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => <MemberCard key={item.id} member={item} />)}
      </div>
      {!visible.length && <p className="text-sm text-muted-foreground">Нема членови во овој избор.</p>}
    </>
  );
}
