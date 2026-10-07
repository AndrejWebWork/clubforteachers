import { Link } from "react-router-dom";

export function RichText({ text }) {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  const nodes = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1]) {
      const to = match[2];
      const safe = /^(https?:\/\/|mailto:)/i.test(to);
      nodes.push(
        to.startsWith("/") && !to.startsWith("//") ? (
          <Link key={match.index} to={to} className="font-bold text-primary underline-offset-2 hover:underline">
            {match[1]}
          </Link>
        ) : safe ? (
          <a key={match.index} href={to} className="font-bold text-primary underline-offset-2 hover:underline" rel="noreferrer">
            {match[1]}
          </a>
        ) : (
          match[1]
        ),
      );
    } else if (match[3]) {
      nodes.push(
        <strong key={match.index} className="font-extrabold text-brand-deep">
          {match[3]}
        </strong>,
      );
    } else {
      nodes.push(
        <code key={match.index} className="rounded bg-brand-pale px-1 py-0.5 text-[0.92em]">
          {match[4]}
        </code>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
