import { Link } from "react-router-dom";
import { useApp } from "../compositor/AppCompositor";

export default function CookieConsent() {
  const { consent, cookiesOpen, setCookiesOpen, saveConsent } = useApp();
  const visible = consent === null || cookiesOpen;
  if (!visible) return null;

  return (
    <div className="fixed bottom-0 right-0 z-50 w-full p-3 md:left-[252px] md:w-auto">
      <section className="panel mx-auto max-w-3xl" aria-labelledby="cookie-title">
        <h2 id="cookie-title" className="text-lg font-black text-brand-deep">
          Колачиња
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Потребните записи ја паметат најавата и вашиот избор на овој уред. Отворање тема и симнување се бројат еднаш по човек, на самата страница.
        </p>
        <p className="mt-2 text-sm">
          <Link to="/kolacinja" className="font-bold text-primary hover:underline" onClick={() => setCookiesOpen(false)}>
            Политика за колачиња
          </Link>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="inline-flex h-9 items-center rounded-md bg-brand-yellow px-4 text-sm font-bold text-brand-ink shadow-cta"
            onClick={() => saveConsent(false)}
          >
            Само потребните
          </button>
          <button
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            onClick={() => saveConsent(true)}
          >
            Прифати ги сите
          </button>
          {consent !== null && (
            <button className="inline-flex h-9 items-center rounded-md border bg-card px-4 text-sm font-medium" onClick={() => setCookiesOpen(false)}>
              Затвори
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
