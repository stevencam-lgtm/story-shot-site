# Story & Shot — website + automatische ontvangstmail

Dit mapje bevat de volledige site, plus een kleine "backend" (een Netlify
function) die bij elke inzending:

1. een oplopend **dossiernummer** toekent (SS00001, SS00002, ...);
2. een **interne meldingsmail** stuurt naar jouw inbox, met het ingestuurde
   script als bijlage;
3. de **automatische ontvangstmail** stuurt naar de afzender, vanaf
   `info@storyshot.be`, met het dossiernummer en zijn/haar naam erin.

Bekijk je de site rechtstreeks in Claude (het artifact-voorbeeld), dan werkt
dit deel niet — daar valt het formulier automatisch terug op de
e-mail/kopieer-oplossing van hiervoor. Zodra de site hieronder gedeployed is
op Netlify, werkt de volledige automatische flow.

## Belangrijk: waarom niet gewoon slepen naar Netlify Drop

De vorige, eenvoudigere versie van de site kon je met slepen-en-loslaten op
[app.netlify.com/drop](https://app.netlify.com/drop) zetten. Nu de site een
functie gebruikt die een extra pakketje nodig heeft (`@netlify/blobs`), moet
Netlify die eerst installeren — dat kan Netlify Drop niet. Gebruik daarom de
**Git-methode** hieronder. Dat is ook meteen handiger voor later: telkens je
iets aanpast (tekst, foto's), hoef je niet opnieuw alles te uploaden.

## Stap 1 — Zet dit mapje op GitHub (geen commandoregel nodig)

1. Maak een gratis account op [github.com](https://github.com) als je er nog
   geen hebt.
2. Klik rechtsboven op **+** → **New repository**. Geef het een naam, bv.
   `story-shot-site`. Laat "Public" of "Private" staan zoals je wilt. Klik
   **Create repository**.
3. Klik op **uploading an existing file** (of **Add file → Upload files**).
4. Sleep **alle bestanden en mapjes uit dit pakket** naar dat venster
   (inclusief de map `netlify` en het bestand `netlify.toml`,
   `package.json`, `index.html` en de map `images`).
5. Klik onderaan **Commit changes**.

## Stap 2 — Koppel Netlify aan die GitHub-repository

1. Ga naar [app.netlify.com](https://app.netlify.com) en log in (of maak een
   gratis account).
2. Klik **Add new site → Import an existing project**.
3. Kies **GitHub** en selecteer de repository die je net maakte.
4. Bij de instellingen mag alles op de standaardwaarden blijven staan
   (build command leeg laten, publish directory `.`) — dat staat al correct
   in `netlify.toml`. Klik **Deploy**.
5. Na een minuutje krijg je een live link, iets als
   `story-shot-site.netlify.app`. Wil je je eigen domein (storyshot.be)?
   Ga dan naar **Domain settings → Add a domain** en volg de instructies.

Zonder de volgende stap werkt de site al perfect, alleen zonder automatische
e-mails (het formulier valt dan terug op de mail/kopieer-oplossing).

## Stap 3 — Automatische e-mails inschakelen via Resend

We gebruiken [Resend](https://resend.com) om e-mails te versturen vanaf
`info@storyshot.be`. Resend heeft een gratis laag die ruim voldoende is voor
een pitchformulier.

1. Maak een gratis account op [resend.com](https://resend.com).
2. Ga naar **Domains → Add Domain** en voer `storyshot.be` in.
3. Resend toont een paar DNS-records (meestal 2 à 3: een SPF/TXT-record en
   een of meer DKIM/CNAME-records). Voeg die toe bij je domeinregistrar
   (waar je storyshot.be beheert — vraag het gerust als je niet weet waar
   dat is, dat vind je meestal terug in de bevestigingsmail van je
   domeinaankoop).
4. Wacht tot Resend het domein als "Verified" toont (kan tot een paar uur
   duren, meestal veel sneller).
5. Ga naar **API Keys → Create API Key**. Kopieer de sleutel (begint met
   `re_...`) — je ziet hem maar één keer.
6. Ga terug naar je site op Netlify → **Site configuration → Environment
   variables → Add a variable**, en voeg toe:
   - `RESEND_API_KEY` = de sleutel die je net kopieerde
   - (optioneel) `NOTIFY_EMAIL` = het e-mailadres waarop jij de interne
     melding van elke inzending wilt ontvangen. Standaard staat dit op
     `steven.cam@belgacom.net` — verander dit zodra `info@storyshot.be`
     een echte, door jou gelezen inbox is.
7. Ga naar **Deploys** en klik **Trigger deploy → Deploy site**, zodat de
   nieuwe instellingen actief worden.

Test het formulier daarna één keer met je eigen gegevens: je zou meteen een
dossiernummer moeten zien op de pagina, en binnen enkele minuten twee
e-mails moeten binnenkrijgen (de interne melding, en de ontvangstmail op het
testadres dat je invulde).

## Seizoensfoto's toevoegen ("Actueel"-sectie)

Op de site staat een sectie "Actueel" met plaats voor drie foto's. Om er een
toe te voegen of te vervangen:

1. Noem je foto exact `actueel-1.jpg`, `actueel-2.jpg` of `actueel-3.jpg`.
2. Zet het bestand in de map `images/`.
3. Upload de gewijzigde/nieuwe foto naar je GitHub-repository (via
   **Add file → Upload files**, zelfde manier als in stap 1) — Netlify
   deployt dan automatisch de bijgewerkte site.

Een leeg vak (geen foto aanwezig) toont automatisch een neutrale
plaatshouder, dus je hoeft niet alle drie de plekken te vullen. Wil je ook
de titel/het bijschrift boven de foto's aanpassen (bv. "Op de set deze
kerst"), open dan `index.html`, zoek naar `id="actueel"` en pas de tekst
tussen de `<h2>` en `<div class="intro-text">` tags aan.

## Hoe het dossiernummer werkt

Het nummer wordt bijgehouden in Netlify Blobs, een klein opslagvakje dat bij
je site hoort — je hoeft daar niets voor in te stellen. Het loopt gewoon
door (SS00001, SS00002, ...) zolang de site op dit Netlify-project blijft
staan.

## Overzicht van de bestanden

```
index.html                     de volledige website
netlify.toml                   Netlify-configuratie
package.json                   vermeldt het @netlify/blobs pakketje
netlify/functions/submit.js    de functie die dossiernummers toekent en mailt
images/                        zet hier actueel-1.jpg / -2.jpg / -3.jpg in
```
