import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { downloadCertificate, fillCertificate } from "../certificatePdf";
import { useApp } from "../compositor/AppCompositor";
import { Button } from "../components/ui";

export default function Certificate() {
  const { trainingId } = useParams();
  const { signedIn, authReady } = useApp();
  const [certificate, setCertificate] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!signedIn) return;
    api.certificate(trainingId).then((data) => setCertificate(data.certificate)).catch((reason) => setError(reason.message));
  }, [signedIn, trainingId]);

  useEffect(() => {
    if (!certificate) return;
    let href = "";
    fillCertificate(certificate)
      .then((bytes) => {
        href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        setPreview(href);
      })
      .catch((reason) => setError(reason.message || "Сертификатот не се создаде."));
    return () => {
      if (href) URL.revokeObjectURL(href);
    };
  }, [certificate]);

  if (!authReady) return <section className="panel">Се вчитува...</section>;
  if (!signedIn) return <section className="panel">Најавете се за да го видите сертификатот.</section>;
  if (error) return <section className="panel">{error}</section>;
  if (!certificate) return <section className="panel">Се вчитува сертификатот...</section>;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex gap-2">
        <Button asChild variant="outline"><Link to={`/obuki/${trainingId}`}>Назад кон обуката</Link></Button>
        <Button type="button" onClick={() => downloadCertificate(certificate).catch((reason) => setError(reason.message || "PDF-от не се создаде."))}>Симни PDF</Button>
      </div>
      {preview ? (
        <iframe src={preview} className="certificate-preview" title="Сертификат" />
      ) : (
        <section className="panel">Се подготвува сертификатот...</section>
      )}
    </div>
  );
}
