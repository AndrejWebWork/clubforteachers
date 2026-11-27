import { useEffect, useState } from "react";

import { api } from "../api";
import { MONTHS, noticeStamp } from "../calendar";

function isoStamp(iso) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1] || ""}`;
}
import { useApp } from "../compositor/AppCompositor";
import { RichText } from "../components/RichText";
import { PageHeader, Signal, useAction } from "../components/ui";

export default function Notices() {
  const { open } = useAction();
  const { seeFeed, catalog } = useApp();
  const [notices, setNotices] = useState(catalog.notices);
  useEffect(() => {
    api.notices().then((data) => setNotices(data.notices || [])).catch(() => setNotices([]));
    seeFeed("notice").catch(() => {});
  }, [seeFeed]);
  return (
    <>
      <PageHeader
        title="Огласна табла"
        description="Повици, обуки, конкурси, грантови и рокови — сè што бара ваша акција, на едно место."
      />
      <div className="notice-wall">
        {notices.map((item) => {
          const stamp = noticeStamp(item.day, item.month);
          return (
          <article key={item.id || item.title} className={`pin-note ${item.priority ? "priority" : ""}`}>
            <span className="push-pin" aria-hidden="true" />
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="pin-date"><small>Рок за пријава</small><b>{stamp.day} <span>{stamp.month}</span></b></span>
              {item.eventDate && (
                <span className="pin-date"><small>Настан</small><b>{isoStamp(item.eventDate)}{item.eventTime ? ` · ${item.eventTime}` : ""}</b></span>
              )}
            </div>
            {item.cover && <img src={item.cover} alt="" className="mt-2 h-28 w-full rounded-md object-cover" />}
            <h3 className="mt-2 text-sm font-black leading-snug text-brand-deep">{item.title}</h3>
            <p className="mt-1 line-clamp-3 break-words text-xs text-muted-foreground"><RichText text={item.text} /></p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Signal label={item.status} />
              <button
                type="button"
                className="pill"
                onClick={() => open({
                  title: item.title,
                  description: `${item.text}\n\n${item.eventDate ? `Настан: ${isoStamp(item.eventDate)}${item.eventTime ? `, ${item.eventTime}` : ""}.\n` : ""}Рок за пријава: ${stamp.day} ${stamp.month}.`,
                })}
              >
                Детали
              </button>
            </div>
          </article>
          );
        })}
      </div>
    </>
  );
}
