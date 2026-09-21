// netlify/functions/image-settings.js
//
// Beheert de positie/zoom-instellingen van de foto's in de "Actueel"-sectie.
//  - GET  : geeft de huidige instellingen terug (publiek, geen wachtwoord nodig —
//           anders zou de site zelf de foto's niet correct kunnen tonen).
//  - POST : slaat nieuwe instellingen op, enkel geldig met het juiste wachtwoord.
//
// Vereiste omgevingsvariabele (in te stellen via Netlify: Site settings →
// Environment variables):
//   ADMIN_PASSWORD   verplicht om via beheer.html te kunnen opslaan.

import { getStore } from "@netlify/blobs";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PHOTO_KEYS = ["hero", "actueel-1", "actueel-2", "actueel-3"];

const DEFAULT_SETTINGS = {
  hero: { x: 50, y: 50, zoom: 100 },
  "actueel-1": { x: 50, y: 50, zoom: 100 },
  "actueel-2": { x: 50, y: 50, zoom: 100 },
  "actueel-3": { x: 50, y: 50, zoom: 100 },
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clampNumber(val, min, max, fallback) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export default async (req) => {
  const store = getStore("settings");

  if (req.method === "GET") {
    const entry = await store.get("image-positions", { type: "json" });
    return json(200, { ...DEFAULT_SETTINGS, ...(entry || {}) });
  }

  if (req.method === "POST") {
    if (!ADMIN_PASSWORD) {
      return json(500, { error: "Beheerwachtwoord is niet ingesteld (ADMIN_PASSWORD ontbreekt in Netlify)." });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Ongeldige aanvraag." });
    }

    if (body.password !== ADMIN_PASSWORD) {
      return json(401, { error: "Verkeerd wachtwoord." });
    }

    const settings = body.settings && typeof body.settings === "object" ? body.settings : {};
    const clean = {};
    for (const key of PHOTO_KEYS) {
      const s = settings[key] || {};
      clean[key] = {
        x: clampNumber(s.x, 0, 100, 50),
        y: clampNumber(s.y, 0, 100, 50),
        zoom: clampNumber(s.zoom, 100, 300, 100),
      };
    }

    await store.setJSON("image-positions", clean);
    return json(200, { ok: true, settings: clean });
  }

  return json(405, { error: "Method not allowed" });
};

export const config = {
  path: "/api/image-settings",
};
