import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <header className="brand-header mx-auto max-w-3xl">
      <div className="relative z-10">
        <p className="mb-2 text-xs font-black uppercase text-primary">Клуб на наставници</p>
        <h1 className="text-3xl font-black text-brand-deep sm:text-4xl">Страницата не постои</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium text-muted-foreground sm:text-base">
          Адресата не води до дел од платформата. Вратете се на главната табла.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Главна табла
          </Link>
        </div>
      </div>
    </header>
  );
}
