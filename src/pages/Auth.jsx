import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../compositor/AppCompositor";
import { Button } from "../components/ui";

function AuthShell({ mode, children }) {
  return (
    <section className="auth-screen">
      <div className="auth-marks" aria-hidden="true">
        <span className="auth-arrows">›››</span>
        <span className="auth-dots">
          {Array.from({ length: 9 }).map((_, index) => <i key={index} />)}
        </span>
      </div>
      <div className="auth-card">
        <Link to="/" className="auth-back">
          <ArrowLeft className="h-4 w-4" />
          Кон главната табла
        </Link>
        <div className="auth-brand">
          <span>КН</span>
          <b>Клуб на<br />наставници</b>
        </div>
        <div className="auth-switch" role="tablist" aria-label="Најава или одјава">
          <Link to="/najava" className={mode === "in" ? "active" : ""} role="tab" aria-selected={mode === "in"}>Најава</Link>
          <Link to="/odjava" className={mode === "out" ? "active" : ""} role="tab" aria-selected={mode === "out"}>Одјава</Link>
        </div>
        {children}
      </div>
    </section>
  );
}

export function SignIn() {
  const { signedIn, authReady, signIn } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (!authReady) return <section className="panel">Се проверува најавата...</section>;

  return (
    <AuthShell mode="in">
      <h1>Најава</h1>
      <p className="auth-lead">Влезете со е-поштата и лозинката што ви ги дал раководителот. Нова сметка не се отвора одовде.</p>
      {signedIn ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-brand-deep">Веќе сте најавени.</p>
          <Button asChild><Link to="/profil">Кон мојот профил</Link></Button>
        </div>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            const result = await signIn(email, password);
            setPending(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            navigate("/profil");
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand-deep">Е-пошта</span>
            <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-md border bg-card px-3 text-sm outline-none ring-ring focus:ring-2" required />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand-deep">Лозинка</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-md border bg-card px-3 text-sm outline-none ring-ring focus:ring-2" required />
          </label>
          {error && <p className="text-sm font-semibold text-brand-urgent">{error}</p>}
          <Button type="submit" className="cta-link" disabled={pending}>
            {pending ? "Се најавува..." : "Најави се"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function SignOut() {
  const { signedIn, authReady, signOut } = useApp();
  const [done, setDone] = useState(false);

  if (!authReady) return <section className="panel">Се проверува најавата...</section>;

  return (
    <AuthShell mode="out">
      <h1>Одјава</h1>
      {done || !signedIn ? (
        <>
          <p className="auth-lead">{done ? "Одјавени сте. Сесијата на овој уред е затворена." : "Нема активна најава на овој уред."}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="cta-link"><Link to="/najava">Кон најава <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild variant="outline"><Link to="/">Кон главната табла</Link></Button>
          </div>
        </>
      ) : (
        <>
          <p className="auth-lead">Ќе ја затворите сесијата на овој уред. Профилот и темите остануваат во клубот.</p>
          <Button
            onClick={async () => {
              await signOut();
              setDone(true);
            }}
          >
            Одјави се
          </Button>
        </>
      )}
    </AuthShell>
  );
}

