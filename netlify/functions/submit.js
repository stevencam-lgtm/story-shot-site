// netlify/functions/submit.js
//
// Verwerkt een inzending van het pitchformulier:
//  1. kent een oplopend dossiernummer toe (SS00001, SS00002, ...), opgeslagen
//     in Netlify Blobs zodat het nummer blijft doorlopen tussen inzendingen;
//  2. stuurt een interne meldingsmail naar Story & Shot, met het script/synopsis
//     als bijlage;
//  3. stuurt de automatische ontvangstmail naar de afzender, vanaf info@storyshot.be.
//
// Vereiste omgevingsvariabelen (in te stellen via Netlify: Site settings →
// Environment variables):
//   RESEND_API_KEY   verplicht — API-sleutel van je Resend-account
//   FROM_EMAIL       optioneel — standaard "Story & Shot <info@storyshot.be>"
//   NOTIFY_EMAIL     optioneel — inbox die interne meldingen ontvangt,
//                    standaard steven.cam@belgacom.net
//
// Zie README.md in dit projectmapje voor de volledige installatiestappen
// (Resend-account aanmaken, domein storyshot.be verifiëren, sleutel instellen).
 
import { getStore } from "@netlify/blobs";
 
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "Story & Shot <info@storyshot.be>";
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "steven.cam@belgacom.net";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
 
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
 
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
 
async function sendEmail(payload) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend gaf fout ${res.status}: ${text}`);
  }
  return res.json();
}
 
// Kent een oplopend dossiernummer toe met optimistic-concurrency (onlyIfMatch/
// onlyIfNew), zodat twee gelijktijdige inzendingen nooit hetzelfde nummer krijgen.
async function nextDossierNummer() {
  const store = getStore("counters");
  for (let attempt = 0; attempt < 6; attempt++) {
    // getWithMetadata geeft null terug als de teller nog nooit is aangemaakt
    // (bv. bij de allereerste inzending ooit) — dat mogen we niet destructureren.
    const entry = await store.getWithMetadata("dossier", { type: "json" });
 
    if (!entry) {
      const next = 1;
      const { modified } = await store.setJSON("dossier", { count: next }, { onlyIfNew: true });
      if (modified) {
        return "SS" + String(next).padStart(5, "0");
      }
      continue; // Iemand anders maakte de teller net aan — opnieuw proberen.
    }
 
    const current = entry.data && typeof entry.data.count === "number" ? entry.data.count : 0;
    const next = current + 1;
    const { modified } = await store.setJSON("dossier", { count: next }, { onlyIfMatch: entry.etag });
    if (modified) {
      return "SS" + String(next).padStart(5, "0");
    }
    // Een andere inzending won de race — even opnieuw proberen.
  }
  throw new Error("Kon geen dossiernummer toekennen na meerdere pogingen.");
}
 
export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }
  if (!RESEND_API_KEY) {
    return json(500, { error: "E-mailservice is niet geconfigureerd (RESEND_API_KEY ontbreekt)." });
  }
 
  let form;
  try {
    form = await req.formData();
  } catch {
    return json(400, { error: "Kon het formulier niet lezen." });
  }
 
  const get = (name) => (form.get(name) || "").toString().trim();
  const voornaam = get("voornaam");
  const achternaam = get("achternaam");
  const email = get("email");
  const telefoon = get("telefoon");
  const genre = get("genre");
  const logline = get("logline");
  const pitch = get("pitch");
  const haalbaarheid = get("haalbaarheid");
  const file = form.get("bestand");
 
  if (!voornaam || !achternaam || !email || !genre || !logline || !pitch || !haalbaarheid) {
    return json(400, { error: "Verplichte velden ontbreken." });
  }
 
  let attachments;
  if (file && typeof file.arrayBuffer === "function" && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      return json(400, { error: "Bestand is groter dan 10MB." });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    attachments = [{ filename: file.name || "script.pdf", content: buf.toString("base64") }];
  }
 
  let dossierNummer;
  try {
    dossierNummer = await nextDossierNummer();
  } catch (err) {
    console.error(err);
    return json(500, { error: "Kon geen dossiernummer toekennen. Probeer het opnieuw." });
  }
 
  try {
    // 1. Interne melding naar Story & Shot, met het script als bijlage.
    await sendEmail({
      from: FROM_EMAIL,
      to: [NOTIFY_EMAIL],
      reply_to: email,
      subject: `Nieuwe pitch — dossier ${dossierNummer}`,
      html: `
        <p><strong>Nieuw dossier: ${dossierNummer}</strong></p>
        <p>
          <strong>Naam:</strong> ${escapeHtml(voornaam)} ${escapeHtml(achternaam)}<br>
          <strong>E-mail:</strong> ${escapeHtml(email)}<br>
          <strong>Telefoon:</strong> ${escapeHtml(telefoon || "-")}<br>
          <strong>Genre:</strong> ${escapeHtml(genre)}
        </p>
        <p><strong>Logline:</strong><br>${escapeHtml(logline)}</p>
        <p><strong>Pitch:</strong><br>${escapeHtml(pitch).replace(/\n/g, "<br>")}</p>
        <p><strong>Haalbaarheid:</strong><br>${escapeHtml(haalbaarheid).replace(/\n/g, "<br>")}</p>
        <p><strong>Script/synopsis:</strong> ${
          file && file.name ? escapeHtml(file.name) + " (zie bijlage)" : "geen bestand meegestuurd"
        }</p>
      `,
      attachments,
    });
 
    // 2. Automatische ontvangstmail naar de afzender.
    await sendEmail({
      from: FROM_EMAIL,
      to: [email],
      subject: `We hebben je bericht goed ontvangen – dossier ${dossierNummer}`,
      text: [
        `Beste ${voornaam} ${achternaam},`,
        ``,
        `Bedankt voor je bericht aan Story & Shot.`,
        `We hebben je aanvraag goed ontvangen en behandelen deze zo snel mogelijk.`,
        ``,
        `Dossiernummer: ${dossierNummer}`,
        `Bewaar dit nummer gerust. Zo kunnen we je aanvraag snel terugvinden wanneer je hierover contact met ons opneemt.`,
        ``,
        `We kijken er alvast naar uit om samen jouw verhaal te vertellen.`,
        ``,
        `Met vriendelijke groet,`,
        `Story & Shot`,
        `Story. Shot. AI.`,
        ``,
        `E-mail: info@storyshot.be`,
        `Telefoon: +32 475 68 36 21`,
        `Moving Art Production BV`,
        `© 2026 Story & Shot`,
      ].join("\n"),
      html: `
        <p>Beste ${escapeHtml(voornaam)} ${escapeHtml(achternaam)},</p>
        <p>Bedankt voor je bericht aan Story &amp; Shot.</p>
        <p>We hebben je aanvraag goed ontvangen en behandelen deze zo snel mogelijk.</p>
        <p>
          <strong>Dossiernummer: ${dossierNummer}</strong><br>
          Bewaar dit nummer gerust. Zo kunnen we je aanvraag snel terugvinden wanneer je hierover contact met ons opneemt.
        </p>
        <p>We kijken er alvast naar uit om samen jouw verhaal te vertellen.</p>
        <p>
          Met vriendelijke groet,<br>
          Story &amp; Shot<br>
          <em>Story. Shot. AI.</em>
        </p>
        <p style="font-size:13px;color:#6E6759;">
          E-mail: <a href="mailto:info@storyshot.be">info@storyshot.be</a><br>
          Telefoon: +32 475 68 36 21<br>
          Moving Art Production BV<br>
          &copy; 2026 Story &amp; Shot
        </p>
      `,
    });
  } catch (err) {
    console.error(err);
    // Het dossiernummer is al toegekend; dat melden we toch, zodat er geen
    // dubbele inzending ontstaat als de bezoeker het opnieuw probeert.
    return json(502, {
      error: "Dossier aangemaakt, maar het versturen van de e-mail is mislukt.",
      dossierNummer,
    });
  }
 
  return json(200, { ok: true, dossierNummer });
};
 
export const config = {
  path: "/api/submit",
};

