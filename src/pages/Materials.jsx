import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api";
import { useApp } from "../compositor/AppCompositor";
import { Button, PageHeader } from "../components/ui";

function youtubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1).split("/")[0];
    if (parsed.hostname.endsWith("youtube.com")) return parsed.searchParams.get("v") || "";
  } catch {
    return "";
  }
  return "";
}

export default function Materials() {
  const { signedIn, authReady, isAdmin } = useApp();
  const [videos, setVideos] = useState([]);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!signedIn) return;
    Promise.all([api.videos(), api.attachments()])
      .then(([videoData, fileData]) => {
        setVideos(videoData.videos);
        setFiles(fileData.attachments);
      })
      .catch((reason) => setError(reason.message));
  }, [signedIn]);

  if (!authReady) return <section className="panel">Се вчитува...</section>;

  if (!signedIn) {
    return (
      <>
        <PageHeader eyebrow="За членови" title="Материјали" description="Видеата и прилозите ги поставува раководителот, а ги гледаат најавените наставници." />
        <section className="panel max-w-xl">
          <p className="text-sm text-muted-foreground">Најавете се за да ги отворите материјалите.</p>
          <Button asChild className="mt-4"><Link to="/najava">Најави се</Link></Button>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="За членови"
        title="Материјали"
        description="Видеа и прилози подготвени за наставниците. Поставувањето е само во админ панелот."
      />
      {error && <p className="mb-4 text-sm font-semibold text-brand-urgent">{error}</p>}
      <div className="grid gap-5 min-[1100px]:grid-cols-2">
        <section className="panel">
          <h2 className="section-heading">Видеа</h2>
          <div className="space-y-4">
            {videos.map((video) => {
              const clip = video.url ? youtubeId(video.url) : "";
              return (
                <article key={video.id}>
                  <b className="text-brand-deep">{video.title}</b>
                  <p className="mt-1 text-sm text-muted-foreground">{video.description}</p>
                  {clip && (
                    <iframe
                      className="mt-3 aspect-video w-full rounded-md"
                      src={`https://www.youtube.com/embed/${clip}`}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                  {video.url && !clip && (
                    <video className="mt-3 aspect-video w-full rounded-md" controls preload="metadata" src={video.url} />
                  )}
                </article>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <h2 className="section-heading">Прилози</h2>
          {files.length === 0 && <p className="text-sm text-muted-foreground">Сè уште нема прикачени датотеки.</p>}
          <div className="divide-y">
            {files.map((file) => (
              <a key={file.id} href={file.url} download className="block py-3 font-bold text-brand-deep">{file.name}</a>
            ))}
          </div>
          {isAdmin && (
            <Button asChild variant="outline" className="mt-4">
              <Link to="/admin">Уреди во админ панелот</Link>
            </Button>
          )}
        </section>
      </div>
    </>
  );
}
