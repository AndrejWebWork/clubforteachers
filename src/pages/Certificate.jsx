import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../compositor/AppCompositor";
import { Button } from "../components/ui";

async function downloadCertificate(certificate) {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const fontkit = await import("@pdf-lib/fontkit");
  const response = await fetch("/fonts/NotoSans-Regular.ttf");
  if (!response.ok) throw new Error("Фонтот за PDF не е достапен.");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit.default || fontkit);
  const font = await pdf.embedFont(await response.arrayBuffer());
  const page = pdf.addPage([842, 595]);
  const issued = new Date(certificate.issuedAt).toLocaleDateString("mk-MK");
  page.drawRectangle({ x: 28, y: 28, width: 786, height: 539, borderColor: rgb(0.11, 0.36, 0.4), borderWidth: 2 });
  page.drawText("Клуб на наставници", { x: 70, y: 470, size: 14, font, color: rgb(0.11, 0.36, 0.4) });
  page.drawText("Сертификат", { x: 70, y: 410, size: 42, font, color: rgb(0.07, 0.24, 0.28) });
  page.drawText("Се потврдува дека", { x: 70, y: 340, size: 14, font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(certificate.name, { x: 70, y: 300, size: 26, font, color: rgb(0.07, 0.24, 0.28) });
  page.drawText("успешно ја заврши обуката, тестот и евалуацијата", { x: 70, y: 250, size: 14, font, color: rgb(0.15, 0.15, 0.15) });
  page.drawText(certificate.title, { x: 70, y: 210, size: 20, font, color: rgb(0.07, 0.24, 0.28) });
  page.drawText(`Издаден на ${issued}  ·  ${certificate.id}`, { x: 70, y: 120, size: 12, font, color: rgb(0.3, 0.3, 0.3) });
  const bytes = await pdf.save();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  link.download = `sertifikat-${certificate.id}.pdf`;
  link.click();
  URL.revokeObjectURL(link.href);
}

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
        <Button type="button" onClick={() => downloadCertificate(certificate).catch((reason) => setError(reason.message || "PDF-от не се создаде."))}>Симни PDF</Button>
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
