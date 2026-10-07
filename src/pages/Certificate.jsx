import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../compositor/AppCompositor";
import { Button } from "../components/ui";

export default function Certificate() {
  const { trainingId } = useParams();
  const { signedIn, authReady } = useApp();
  const [certificate, setCertificate] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!signedIn) return;
    api.certificate(trainingId).then((data) => setCertificate(data.certificate)).catch((reason) => setError(reason.message));
  }, [signedIn, trainingId]);

  if (!authReady) return <section className="panel">Се вчитува...</section>;
  if (!signedIn) return <section className="panel">Најавете се за да го видите сертификатот.</section>;
  if (error) return <section className="panel">{error}</section>;
  if (!certificate) return <section className="panel">Се вчитува сертификатот...</section>;

  const issued = new Date(certificate.issuedAt).toLocaleDateString("mk-MK");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex gap-2">
        <Button asChild variant="outline"><Link to={`/obuki/${trainingId}`}>Назад кон обуката</Link></Button>
        <Button type="button" onClick={() => window.print()}>Печати сертификат</Button>
      </div>
      <article className="certificate">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Клуб на наставници</p>
        <h1 className="font-display mt-4 text-4xl text-brand-deep">Сертификат</h1>
        <p className="mt-6 text-sm text-muted-foreground">Се потврдува дека</p>
        <p className="mt-2 text-2xl font-black text-brand-deep">{certificate.name}</p>
        <p className="mt-4 text-sm leading-6">успешно ја заврши обуката и точно го одговори тестот</p>
        <p className="mt-3 text-xl font-bold text-brand-deep">{certificate.title}</p>
        <p className="mt-8 text-sm text-muted-foreground">Издаден на {issued} · {certificate.id}</p>
      </article>
    </div>
  );
}
