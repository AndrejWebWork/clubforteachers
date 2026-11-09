function givenNames(full) {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "", last: "", full: "" };
  return { first: parts[0], last: parts.slice(1).join(" "), full: parts.join(" ") };
}

function looksPdf(bytes) {
  return bytes.byteLength > 4 && String.fromCharCode(...new Uint8Array(bytes.slice(0, 4))) === "%PDF";
}

function looksPng(bytes) {
  const head = new Uint8Array(bytes.slice(0, 8));
  return head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
}

export async function fillCertificate(certificate) {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const fontkit = await import("@pdf-lib/fontkit");
  const [regularResponse, boldResponse] = await Promise.all([
    fetch("/fonts/Montserrat-Regular.ttf"),
    fetch("/fonts/Montserrat-SemiBold.ttf"),
  ]);
  if (!regularResponse.ok || !boldResponse.ok) throw new Error("Фонтот за PDF не е достапен.");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit.default || fontkit);
  const font = await pdf.embedFont(await regularResponse.arrayBuffer());
  const nameFont = await pdf.embedFont(await boldResponse.arrayBuffer());
  const issued = new Date(certificate.issuedAt).toLocaleDateString("mk-MK");
  const names = givenNames(certificate.name);
  const dateLine = `Издаден на ${issued}`;
  let page;

  if (certificate.template) {
    const template = await fetch(certificate.template);
    if (!template.ok) throw new Error("Шаблонот за сертификат не се вчита.");
    const bytes = await template.arrayBuffer();
    if (looksPdf(bytes)) {
      const source = await PDFDocument.load(bytes);
      const [copied] = await pdf.copyPages(source, [0]);
      page = pdf.addPage(copied);
    } else {
      const image = looksPng(bytes) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      page = pdf.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }
    const { width, height } = page.getSize();
    const nameSize = Math.min(36, width / 16);
    const dateSize = Math.min(16, width / 36);
    const nameWidth = nameFont.widthOfTextAtSize(names.full, nameSize);
    page.drawText(names.full, {
      x: Math.max(24, (width - nameWidth) / 2),
      y: height * 0.48 + nameSize * 0.55,
      size: nameSize,
      font: nameFont,
      color: rgb(0.07, 0.24, 0.28),
    });
    const dateWidth = font.widthOfTextAtSize(dateLine, dateSize);
    page.drawText(dateLine, {
      x: Math.max(24, (width - dateWidth) / 2),
      y: height * 0.28,
      size: dateSize,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
  } else {
    page = pdf.addPage([842, 595]);
    page.drawRectangle({ x: 28, y: 28, width: 786, height: 539, borderColor: rgb(0.11, 0.36, 0.4), borderWidth: 2 });
    page.drawText("Клуб на наставници", { x: 70, y: 470, size: 14, font, color: rgb(0.11, 0.36, 0.4) });
    page.drawText("Сертификат", { x: 70, y: 410, size: 42, font, color: rgb(0.07, 0.24, 0.28) });
    page.drawText("Се потврдува дека", { x: 70, y: 340, size: 14, font, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(names.full, { x: 70, y: 312, size: 26, font: nameFont, color: rgb(0.07, 0.24, 0.28) });
    page.drawText("успешно ја заврши обуката, тестот и евалуацијата", { x: 70, y: 250, size: 14, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(certificate.title || "", { x: 70, y: 210, size: 20, font, color: rgb(0.07, 0.24, 0.28) });
    if (certificate.line) page.drawText(certificate.line, { x: 70, y: 170, size: 14, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(`${dateLine}  ·  ${certificate.id}`, { x: 70, y: 120, size: 12, font, color: rgb(0.3, 0.3, 0.3) });
  }

  return pdf.save();
}

export async function downloadCertificate(certificate) {
  const bytes = await fillCertificate(certificate);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  link.download = `sertifikat-${certificate.id}.pdf`;
  link.click();
  URL.revokeObjectURL(link.href);
}
