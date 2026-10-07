import { useEffect, useState } from "react";
import { Award, Clock3, FolderOpen, MonitorPlay } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { images } from "../data";
import { useApp } from "../compositor/AppCompositor";
import { Button, PageHeader } from "../components/ui";

const emptyText = "Нема резултати за избраните критериуми.";
const moduleNote = "По завршување на вториот модул, кога ќе ги изгледате сите видеа, веднаш се појавува тест. Со точен тест добивате сертификат.";

export default function Trainings() {
  const { signedIn } = useApp();
  const [trainings, setTrainings] = useState([]);
  const [error, setError] = useState("");
  const [folder, setFolder] = useState(0);
  const [category, setCategory] = useState("Сите");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.trainings().then((data) => setTrainings(data.trainings)).catch((reason) => setError(reason.message));
  }, []);

  const themes = ["Сите", ...new Set(trainings.map((item) => item.category).filter(Boolean))];
  const visible = trainings.filter((item) => {
    const inFolder = folder === 0 || item.module === folder;
    const inTheme = category === "Сите" || item.category === category;
    const inQuery = item.title.toLocaleLowerCase("mk").includes(query.toLocaleLowerCase("mk"));
    return inFolder && inTheme && inQuery;
  });

  return (
    <>
      <PageHeader
        eyebrow="Професионален развој"
        title="Обуки"
        description="Обуките се поделени во два модула. По изгледаните видеа следува тест и сертификат."
      />
      {error && <p className="mb-4 text-sm font-semibold text-brand-urgent">{error}</p>}
      <div className="module-folders" role="group" aria-label="Модули">
        {[1, 2].map((item) => (
          <button
            key={item}
            type="button"
            className={`sort-chip ${folder === item ? "active" : ""}`}
            onClick={() => {
              setFolder(item);
              setCategory("Сите");
              setQuery("");
            }}
          >
            <FolderOpen className="mx-auto mb-1 h-5 w-5" />
            Модул {item}
          </button>
        ))}
      </div>

      {folder > 0 && (
        <section className="mt-5">
          <p className="module-note">{moduleNote}</p>
          <div className="filter-bar mb-5">
            <label className="relative block min-w-0 flex-1 sm:max-w-md">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 w-full rounded-md border border-transparent bg-card px-3 text-sm outline-none ring-ring focus:ring-2"
                placeholder="Пребарај обука..."
              />
            </label>
            <div className="theme-sort" role="group" aria-label="Тема">
              {themes.map((item) => (
                <button key={item} type="button" className={`sort-chip ${category === item ? "active" : ""}`} onClick={() => setCategory(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="module-results">
            {visible.length === 0 ? (
              <div className="panel py-14 text-center text-muted-foreground">{emptyText}</div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {visible.map((item) => (
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
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
