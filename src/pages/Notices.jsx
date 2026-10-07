import { useEffect, useState } from "react";
import { api } from "../api";
import { noticeCategories } from "../data";
import { useApp } from "../compositor/AppCompositor";
import { PageHeader, Signal, useAction } from "../components/ui";

export default function Notices() {
  const { open } = useAction();
  const { seeFeed } = useApp();
  const [category, setCategory] = useState("Сите");
  const [notices, setNotices] = useState([]);
  useEffect(() => {
    api.notices().then((data) => setNotices(data.notices || [])).catch(() => setNotices([]));
    seeFeed("notice").catch(() => {});
  }, [seeFeed]);
  const items = notices.filter((item) => category === "Сите" || item.category === category);
  return (
    <>
      <PageHeader
        title="Огласна табла"
        description="Повици, обуки, конкурси, грантови и рокови — сè што бара ваша акција, на едно место."
      />
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
        {["Сите", ...noticeCategories].map((item) => (
          <button key={item} type="button" className={`sort-chip ${category === item ? "active" : ""}`} onClick={() => setCategory(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="notice-wall">
        {items.map((item) => (
          <article key={item.id || item.title} className={`pin-note ${item.priority ? "priority" : ""}`}>
            <span className="push-pin" aria-hidden="true" />
            <div className="flex items-center justify-between gap-2">
              <span className="type-chip">{item.category}</span>
              <span className="pin-date"><b>{item.day}</b> {item.month}</span>
            </div>
            <h3 className="mt-2 text-sm font-black leading-snug text-brand-deep">{item.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.text}</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Signal label={item.status} />
              <button
                type="button"
                className="pill"
                onClick={() => open({ title: item.title, description: `${item.text} Рок: ${item.day} ${item.month}.` })}
              >
                Детали
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
