import privacy from "../PRIVACY.md?raw";
import terms from "../TERMS.md?raw";
import cookies from "../COOKIES.md?raw";

const sources = {
  "/privatnost": privacy,
  "/uslovi": terms,
  "/kolacinja": cookies,
};

function parseFrontMatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw.trim() };
  const meta = {};
  for (const line of match[1].split("\n")) {
    const index = line.indexOf(":");
    if (index > 0) meta[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return { meta, body: match[2].trim() };
}

function parseBlocks(body) {
  const lines = body.split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;
  let table = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "p", text: paragraph.join(" ") });
    paragraph = [];
  };

  const flushList = () => {
    list = null;
  };

  const flushTable = () => {
    table = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) {
      flushParagraph();
      flushList();
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
      if (!table) {
        table = { type: "table", rows: [] };
        blocks.push(table);
      }
      table.rows.push(cells);
      continue;
    }
    flushTable();
    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h3", text: trimmed.slice(4) });
    } else if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h2", text: trimmed.slice(3) });
    } else if (trimmed.startsWith("- ")) {
      flushParagraph();
      if (!list) {
        list = { type: "ul", items: [] };
        blocks.push(list);
      }
      list.items.push(trimmed.slice(2));
    } else if (!trimmed) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(trimmed);
    }
  }
  flushParagraph();
  return blocks;
}

export function legalDocument(path) {
  const raw = sources[path];
  if (!raw) return null;
  const { meta, body } = parseFrontMatter(raw);
  return { ...meta, blocks: parseBlocks(body) };
}

export const legalPaths = Object.keys(sources);
