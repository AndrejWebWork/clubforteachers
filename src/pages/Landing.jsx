import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Button } from "../components/ui";

const shareLink = "https://clubforteachers.vercel.app";

export default function Landing() {
  const [contactOpen, setContactOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  function sendContact(event) {
    event.preventDefault();
    const body = `Име: ${form.name}\nЕ-пошта: ${form.email}\n\n${form.message}`;
    window.location.href = `mailto:klub@klub.mk?subject=${encodeURIComponent("Контакт од почетната страница")}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <div className="landing">
      <header className="landing-bar">
        <a href="#za-klubot" className="club-mark landing-club-mark" aria-label="Клуб на наставници">
          <img src="/club-logo.png" alt="Клуб на наставници" />
        </a>
        <Button asChild>
          <Link to="/najava">Најави се</Link>
        </Button>
      </header>

      <section className="landing-stage">
        <div className="landing-stage-copy">
          <p className="landing-kicker">Само за членови</p>
          <h1>Клуб на наставници</h1>
          <p>Платформа за членовите на Клубот. Најави се за да пристапиш до обуките, огласите, ресурсите и форумот.</p>
          <div className="landing-actions">
            <Button asChild variant="yellow">
              <Link to="/najava">Најави се</Link>
            </Button>
            <Button variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10" onClick={() => document.getElementById("za-klubot")?.scrollIntoView({ behavior: "smooth" })}>
              Повеќе информации
            </Button>
          </div>
        </div>
      </section>

      <section id="za-klubot" className="landing-lower">
        <div className="landing-card">
          <h2>Сè уште не си член на Клубот?</h2>
          <p>
            Клубот е заедница за идеи, ресурси, обуки и професионална поддршка. Членството го дава организацијата. Тука можеш да прочиташ за што служи платформата и да не контактираш.
          </p>
          <div className="landing-links">
            <a href="https://lead.org.mk/" target="_blank" rel="noreferrer">Веб-страница на платформата</a>
            <a href="https://www.facebook.com/lead.mkd/" target="_blank" rel="noreferrer">Facebook</a>
            <a href={`viber://forward?text=${encodeURIComponent(`Клуб на наставници ${shareLink}`)}`}>Viber</a>
            <button type="button" onClick={() => setContactOpen(true)}>
              <Mail className="mr-1 inline h-4 w-4" /> Контакт
            </button>
          </div>
        </div>
        <aside className="landing-aside">
          <div>
            <span>Членство</span>
            <strong>Влезот е со сметка што ја дава организацијата.</strong>
          </div>
          <Button asChild variant="yellow" className="w-fit">
            <Link to="/najava">Најави се</Link>
          </Button>
        </aside>
      </section>

      <footer className="landing-foot">
        <span>© {new Date().getFullYear()} Клуб на наставници</span>
        <button type="button" className="landing-contact" onClick={() => setContactOpen(true)}>Контактирај нè</button>
      </footer>

      {contactOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={() => setContactOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-panel" onClick={(event) => event.stopPropagation()}>
            {sent ? (
              <>
                <h2 className="text-lg font-black text-brand-deep">Пораката е подготвена</h2>
                <p className="mt-2 text-sm text-muted-foreground">Се отвора во вашата е-пошта. Испратете ја оттаму до klub@klub.mk.</p>
                <Button className="mt-4" onClick={() => setContactOpen(false)}>Во ред</Button>
              </>
            ) : (
              <form className="space-y-3" onSubmit={sendContact}>
                <h2 className="text-lg font-black text-brand-deep">Контакт</h2>
                <input required className="h-11 w-full rounded-md border bg-card px-3 text-sm" placeholder="Име" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                <input required type="email" className="h-11 w-full rounded-md border bg-card px-3 text-sm" placeholder="Е-пошта" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                <textarea required rows={4} className="w-full rounded-md border bg-card px-3 py-2 text-sm" placeholder="Порака" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
                <Button type="submit" className="w-full">Испрати</Button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
