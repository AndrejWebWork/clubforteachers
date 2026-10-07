import { useEffect, useState } from "react";
import { Award, Clock3, MonitorPlay } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { images } from "../data";
import { useApp } from "../compositor/AppCompositor";
import { Button, FilterGrid, PageHeader } from "../components/ui";

export default function Trainings() {
  const { signedIn } = useApp();
  const [trainings, setTrainings] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.trainings().then((data) => setTrainings(data.trainings)).catch((reason) => setError(reason.message));
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Професионален развој"
        title="Обуки"
        description="Сите обуки од програмата Клуб на наставници — со снимки, прашалници и сертификат по успешно завршување."
      />
      {error && <p className="mb-4 text-sm font-semibold text-brand-urgent">{error}</p>}
      <FilterGrid
        items={trainings}
        placeholder="Пребарај обука..."
        render={(item) => (
          <article key={item.id} className="training-card group">
            <div className="relative h-44 overflow-hidden">
              <img src={images[item.image] || images.webinar} alt="" className="h-full w-full object-cover" />
              <span className={`status-badge ${item.status === "Отворена" ? "open" : item.status === "Наскоро" ? "soon" : "closed"}`}>
                {item.status}
              </span>
              <span className="absolute bottom-3 left-3 rounded-md bg-brand-deep px-2.5 py-1 text-xs font-black text-primary-foreground">
                {item.category}
              </span>
            </div>
            <div className="p-5">
              <h2 className="text-xl font-black leading-snug text-brand-deep">{item.title}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{item.description}</p>
              <div className="my-4 grid grid-cols-2 gap-2 border-y py-3 text-xs font-bold text-brand-deep">
                <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-primary" />{item.duration}</span>
                <span className="flex items-center gap-1.5"><MonitorPlay className="h-4 w-4 text-primary" />{item.format}</span>
                <span className="col-span-2 flex items-center gap-1.5"><Award className="h-4 w-4 text-primary" />{item.level}</span>
              </div>
              {item.status === "Отворена" ? (
                <Button asChild>
                  <Link to={signedIn ? `/obuki/${item.id}` : "/najava"}>{signedIn ? "Отвори обука" : "Пријави се на обуката"}</Link>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">{item.status === "Наскоро" ? "Оваа обука сè уште не е отворена." : "Оваа обука е затворена."}</p>
              )}
            </div>
          </article>
        )}
      />
    </>
  );
}
