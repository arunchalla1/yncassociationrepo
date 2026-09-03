// Best-effort, client-side reading of an uploaded receipt (image via OCR, PDF via its text layer).
// No server or API key involved — everything runs in the admin's own browser, loading the
// OCR/PDF libraries from a CDN only when a file is actually picked. Accuracy varies a lot with
// photo quality and receipt layout, so this is always a *starting point* for the admin to verify,
// never something that saves itself.

let _tesseractLoading = null;
let _pdfjsLoading = null;

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") { resolve(); return; }
      existing.addEventListener("load", resolve);
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.dataset.src = src;
    s.onload = () => { s.dataset.loaded = "1"; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function ensureTesseract() {
  if (window.Tesseract) return;
  if (!_tesseractLoading) _tesseractLoading = _loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js");
  await _tesseractLoading;
}

async function ensurePdfJs() {
  if (window.pdfjsLib) return;
  if (!_pdfjsLoading) {
    _pdfjsLoading = _loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js").then(() => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    });
  }
  await _pdfjsLoading;
}

// Returns the raw extracted text (best-effort). Throws if the file type isn't supported or a
// library fails to load — callers should catch and fall back to "attach only, fill manually".
async function extractTextFromFile(file, onProgress) {
  if (file.type.startsWith("image/")) {
    await ensureTesseract();
    const { data } = await window.Tesseract.recognize(file, "eng", {
      logger: (m) => {
        if (onProgress && m.status === "recognizing text" && typeof m.progress === "number") {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });
    return data.text || "";
  }
  if (file.type === "application/pdf") {
    await ensurePdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const pageCount = Math.min(pdf.numPages, 5); // cap — receipts/bills are rarely longer than this
    let text = "";
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(" ") + "\n";
      if (onProgress) onProgress(Math.round((i / pageCount) * 100));
    }
    return text.trim();
  }
  throw new Error("Unsupported file type for auto-read — only images and PDFs are supported.");
}

// Heuristic amount guess: prefers a number next to "Total"/"Amount Paid"/etc, falls back to the
// largest ₹/Rs-prefixed number, then the largest bare number in the text. Always just a guess.
function guessAmountFromText(text) {
  if (!text) return null;
  const lines = text.split(/\n/);
  const keyworded = [];
  const prefixed = [];
  const amountRe = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi;

  lines.forEach((line) => {
    const isTotalLine = /total|grand total|amount paid|net amount|balance due|paid/i.test(line);
    let m;
    amountRe.lastIndex = 0;
    while ((m = amountRe.exec(line))) {
      const val = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(val)) {
        prefixed.push(val);
        if (isTotalLine) keyworded.push(val);
      }
    }
  });

  if (keyworded.length) return Math.max(...keyworded);
  if (prefixed.length) return Math.max(...prefixed);

  const bare = [];
  const bareNumRe = /\b\d{2,}(?:,\d{2,3})*(?:\.\d{1,2})?\b/g;
  let m;
  while ((m = bareNumRe.exec(text))) {
    const val = parseFloat(m[0].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) bare.push(val);
  }
  return bare.length ? Math.max(...bare) : null;
}

// Heuristic date guess: dd/mm/yyyy, dd-mm-yyyy, "3 Sep 2026", or "Sep 3, 2026". Returns yyyy-mm-dd.
function guessDateFromText(text) {
  if (!text) return null;
  const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  let m = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    const day = Number(d), month = Number(mo), year = Number(y);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
  if (m) {
    const mon = months[m[2].slice(0, 3).toLowerCase()];
    if (mon) return `${m[3]}-${String(mon).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
  }

  m = text.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (m) {
    const mon = months[m[1].slice(0, 3).toLowerCase()];
    if (mon) return `${m[3]}-${String(mon).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
  }

  return null;
}
