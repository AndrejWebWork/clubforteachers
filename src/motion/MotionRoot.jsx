import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import gsap from "gsap";

gsap.config({ nullTargetWarn: false });

function reduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function MotionRoot() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (reduced()) return undefined;
    const ctx = gsap.context(() => {
      const arrows = document.querySelector(".auth-arrows");
      const dots = gsap.utils.toArray(".auth-dots i");
      if (arrows) gsap.to(arrows, { x: 14, duration: 1.7, yoyo: true, repeat: -1, ease: "sine.inOut" });
      if (dots.length) gsap.from(dots, { scale: 0, stagger: 0.06, duration: 0.35, ease: "back.out(2)", clearProps: "transform" });
    }, document);

    let attempts = 0;
    let timer = 0;
    const animatePins = () => {
      const pins = gsap.utils.toArray(".notice-wall .pin-note");
      if (pins.length) {
        ctx.add(() => {
          gsap.from(pins, {
            y: -28,
            rotation: -2,
            duration: 0.55,
            stagger: 0.06,
            ease: "back.out(1.6)",
            clearProps: "transform",
            overwrite: "auto",
          });
        });
        return;
      }
      if (document.querySelector(".notice-wall") && attempts < 8) {
        attempts += 1;
        timer = window.setTimeout(animatePins, 200);
      }
    };
    animatePins();

    return () => {
      window.clearTimeout(timer);
      ctx.revert();
    };
  }, [pathname]);

  useEffect(() => {
    if (reduced()) return undefined;
    const press = (event) => {
      const el = event.target.closest("button, .pill, .recommend-btn, .see-all, .cta-link, .auth-switch a, a[href='/najava']");
      if (!el || el.disabled || el.classList.contains("month-cell") || el.classList.contains("week-col") || el.classList.contains("pill") || el.classList.contains("sort-chip") || el.classList.contains("see-all") || el.classList.contains("cal-item") || el.classList.contains("profile-trigger") || el.classList.contains("bell-trigger") || el.classList.contains("lesson-btn") || el.classList.contains("file-pick-btn") || el.classList.contains("toast-close") || el.classList.contains("row-delete") || el.classList.contains("footer-link") || el.classList.contains("folder-3d")) return;
      gsap.fromTo(el, { scale: 0.96 }, { scale: 1, duration: 0.32, ease: "back.out(2.2)", overwrite: "auto" });
    };
    document.addEventListener("pointerup", press);
    return () => document.removeEventListener("pointerup", press);
  }, []);

  return null;
}
