import { inflateRawSync } from "node:zlib";

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function nameFromEmail(email) {
  const local = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  if (!local) return "Наставник";
  return local.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("mk")).slice(0, 80);
}

function splitCsv(line, delimiter) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseMemberText(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
  const rows = lines.map((line) => splitCsv(line, delimiter));
  const header = rows[0].map((cell) => cell.toLocaleLowerCase("mk"));
  const emailIndex = header.findIndex((cell) => /e-?mail|е-пошта|епошта|mail/.test(cell));
  const nameIndex = header.findIndex((cell) => /^(име|name|наставник|име и презиме)$/.test(cell));
  const body = emailIndex >= 0 ? rows.slice(1) : rows;
  const seen = new Set();
  const members = [];
  for (const row of body) {
    const found = row.join(" ").match(emailPattern) || [];
    for (const item of found) {
      const email = item.toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);
      const named = nameIndex >= 0 ? row[nameIndex] : "";
      const name = named && !named.includes("@") ? named.slice(0, 80) : nameFromEmail(email);
      members.push({ name, email });
    }
  }
  return members.slice(0, 500);
}

function docxText(buffer) {
  let offset = 0;
  while (offset + 30 < buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extraLength;
    const data = buffer.subarray(start, start + compressedSize);
    if (name === "word/document.xml") {
      const xml = method === 8 ? inflateRawSync(data).toString("utf8") : data.toString("utf8");
      return xml
        .split(/<\/w:p>/)
        .map((paragraph) => paragraph.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n");
    }
    offset = start + compressedSize;
  }
  return "";
}

export function parseMemberFile({ name = "", text = "", data = "" }) {
  const lower = String(name).toLowerCase();
  if (lower.endsWith(".docx") || data) {
    const buffer = Buffer.from(String(data || ""), "base64");
    if (!buffer.length) return [];
    return parseMemberText(docxText(buffer));
  }
  return parseMemberText(text);
}
