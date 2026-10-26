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
        <a href="#za-klubot" className="flex items-center gap-3">
          <img src="/apple-touch-icon.png" alt="" className="h-12 w-12 rounded-md" />
          <span className="text-sm font-black uppercase leading-tight text-brand-deep">
            Клуб на
            <br />
            наставници
          </span>
        </a>
        <Button asChild>
          <Link to="/najava">Најави се</Link>
        </Button>
      </header>

      <main className="landing-main">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Само за членови</p>
        <h1 className="mt-3 max-w-xl text-4xl font-black leading-tight text-brand-deep sm:text-5xl">Клуб на наставници</h1>
        <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
          Платформа за членовите на Клубот. Најави се за да пристапиш до обуките, огласите, ресурсите и форумот.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/najava">Најави се</Link>
          </Button>
          <Button variant="outline" onClick={() => document.getElementById("za-klubot")?.scrollIntoView({ behavior: "smooth" })}>
            Повеќе информации
          </Button>
        </div>
      </main>

      <section id="za-klubot" className="landing-panel">
        <h2 className="text-2xl font-black text-brand-deep">Сè уште не си член на Клубот?</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          Клубот е заедница за идеи, ресурси, обуки и професионална поддршка. Членството го отвора раководителот. Тука можеш да прочиташ за што служи платформата и да не контактираш.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a className="footer-link" href="https://lead.org.mk/" target="_blank" rel="noreferrer">Веб-страница на платформата</a>
          <a className="footer-link" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`} target="_blank" rel="noreferrer">Facebook</a>
          <a className="footer-link" href={`viber://forward?text=${encodeURIComponent(`Клуб на наставници ${shareLink}`)}`}>Viber</a>
          <button type="button" className="footer-link" onClick={() => setContactOpen(true)}>
            <Mail className="mr-1 inline h-4 w-4" /> Контакт
          </button>
        </div>
      </section>

      <footer className="landing-foot">
        <span>© 2026 Клуб на наставници</span>
        <button type="button" onClick={() => setContactOpen(true)}>Контактирај нè</button>
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
