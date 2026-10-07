import { Link } from "react-router-dom";
import { legalDocument, legalPaths } from "../legal";
import { legalUpdated } from "../site";
import { RichText } from "../components/RichText";

export default function LegalPage({ path }) {
  const document = legalDocument(path);
  if (!document) return null;
  const headings = document.blocks.filter((block) => block.type === "h2");

  return (
    <article className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="panel h-fit lg:sticky lg:top-24" aria-label="Содржина на документот">
        <p className="text-xs font-black uppercase text-primary">Правни документи</p>
        <ul className="mt-3 space-y-2 text-sm font-semibold">
          {legalPaths.map((item) => {
            const entry = legalDocument(item);
            return (
              <li key={item}>
                <Link to={item} className={item === path ? "text-primary" : "text-brand-deep hover:text-primary"}>
                  {entry.title}
                </Link>
              </li>
            );
          })}
        </ul>
        {headings.length > 0 && (
          <ol className="mt-5 space-y-2 border-t pt-4 text-xs font-semibold text-muted-foreground">
            {headings.map((heading) => (
              <li key={heading.text}>
                <a href={`#${slug(heading.text)}`} className="hover:text-primary">
                  {heading.text}
                </a>
              </li>
            ))}
          </ol>
        )}
      </nav>
      <div className="panel">
        <p className="text-xs font-black uppercase text-primary">Клуб на наставници</p>
        <h1 className="mt-2 text-3xl font-black text-brand-deep sm:text-4xl">{document.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ажурирано: {legalUpdated}</p>
        <div className="mt-6 space-y-4 text-sm leading-7 text-foreground sm:text-base">
          {document.blocks.map((block, index) => {
            if (block.type === "h2") {
              return (
                <h2 id={slug(block.text)} key={block.text} className="scroll-mt-24 pt-4 text-xl font-black text-brand-deep">
                  {block.text}
                </h2>
              );
            }
            if (block.type === "h3") {
              return (
                <h3 key={block.text} className="pt-2 text-lg font-extrabold text-brand-deep">
                  {block.text}
                </h3>
              );
            }
            if (block.type === "ul") {
              return (
                <ul key={index} className="list-disc space-y-2 pl-5">
                  {block.items.map((item) => (
                    <li key={item}>
                      <RichText text={item} />
                    </li>
                  ))}
                </ul>
              );
            }
            if (block.type === "table") {
              const [head, ...rows] = block.rows;
              return (
                <div key={index} className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr>
                        {head.map((cell) => (
                          <th key={cell} className="border-b px-3 py-2 font-extrabold text-brand-deep">
                            {cell}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.join("-")}>
                          {row.map((cell) => (
                            <td key={cell} className="border-b px-3 py-2 align-top">
                              <RichText text={cell} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
            return (
              <p key={index}>
                <RichText text={block.text} />
              </p>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function slug(value) {
  return value.toLocaleLowerCase("mk").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
}
