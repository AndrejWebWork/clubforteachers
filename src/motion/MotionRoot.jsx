import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import gsap from "gsap";

const RISE = [
  ".brand-header",
  ".hero-compact",
  ".news-mini",
  ".pin-note",
  ".training-card",
  ".resource-card",
  ".featured-document",
  ".document-feature",
  ".topic-row",
  ".forum-start",
  "article.panel",
  ".calendar-shell",
  ".auth-card",
].join(",");

function reduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function MotionRoot() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (reduced()) return undefined;
    const ctx = gsap.context(() => {
      const nodes = gsap.utils.toArray(`main ${RISE.split(",").join(", main ")}`);
      if (nodes.length) {
        gsap.from(nodes, {
          y: 18,
          autoAlpha: 0,
          duration: 0.42,
          stagger: { each: 0.04, from: "start" },
          ease: "power2.out",
          clearProps: "transform,opacity,visibility",
          overwrite: "auto",
        });
      }
      if (document.querySelector(".notice-wall")) {
        gsap.from(".pin-note", {
          y: -28,
          rotation: -2,
          duration: 0.55,
          stagger: 0.06,
          ease: "back.out(1.6)",
          clearProps: "transform",
          overwrite: "auto",
        });
      }
      if (document.querySelector(".auth-arrows")) {
        gsap.to(".auth-arrows", { x: 14, duration: 1.7, yoyo: true, repeat: -1, ease: "sine.inOut" });
        gsap.from(".auth-dots i", { scale: 0, stagger: 0.06, duration: 0.35, ease: "back.out(2)", clearProps: "transform" });
      }
    }, document);
    return () => ctx.revert();
  }, [pathname]);

  useEffect(() => {
    if (reduced()) return undefined;
    const press = (event) => {
      const el = event.target.closest("button, .pill, .recommend-btn, .see-all, .cta-link, .auth-switch a, a[href='/najava']");
      if (!el || el.disabled || el.classList.contains("month-cell") || el.classList.contains("week-col") || el.classList.contains("pill") || el.classList.contains("sort-chip") || el.classList.contains("see-all") || el.classList.contains("cal-item") || el.classList.contains("profile-trigger") || el.classList.contains("bell-trigger") || el.classList.contains("lesson-btn") || el.classList.contains("file-pick-btn")) return;
      gsap.fromTo(el, { scale: 0.96 }, { scale: 1, duration: 0.32, ease: "back.out(2.2)", overwrite: "auto" });
    };
    document.addEventListener("pointerup", press);
    return () => document.removeEventListener("pointerup", press);
  }, []);

  return null;
}
