# Lynkivo

Ein selbst-gehosteter URL Shortener mit Browser-UI und REST API — bereit für Docker mit Compose.

---

## Schnellstart mit Docker (empfohlen)

### 1. Repository klonen / Dateien bereitstellen

```bash
git clone https://github.com/CaptainN3ro/lynkivo.git
cd lynkivo
```

### 2. `.env` anlegen

```bash
cp .env.example .env
```

Dann `.env` bearbeiten:

```env
BASE_URL=https://lnk.example.com   # Deine öffentliche Domain — wird für alle Kurzlinks verwendet
MASTER_PASSWORD=sehrGeheimerWert
SESSION_SECRET=<zufälliger-langer-string>
PORT=3000
```

> **SESSION_SECRET** generieren:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### 3. Starten
Die package-lock.json ist notwendig, deshalb empfiehlt es sich das npm install auszuführen
```bash
npm install
docker compose up -d
```

Der Container ist unter **http://localhost:3000** (oder deiner `BASE_URL`) erreichbar.

### Weitere nützliche Befehle

```bash
docker compose logs -f          # Logs verfolgen
docker compose restart lynkivo  # Neustart
docker compose down             # Stoppen (Daten bleiben im Volume erhalten)
docker compose down -v          # Stoppen UND Volume löschen (Datenverlust!)
docker compose pull && docker compose up -d --build  # Update nach Code-Änderung
```

---

## Lokale Entwicklung (ohne Docker)

```bash
npm install
cp .env.example .env   # .env anpassen
npm run dev            # startet mit --watch (auto-reload)
```

---

## Datenstruktur

Alle persistenten Daten werden im Volume unter `/app/data` gespeichert:

```
/app/data/
├── db.json          # Links-Datenbank
├── settings.json    # UI-Einstellungen (Farbe, Sprache, Firma …)
└── uploads/         # Hochgeladene Logos & Favicons
```

Beim lokalen Betrieb liegt der `data/`-Ordner im Projektverzeichnis.

---

## Umgebungsvariablen

| Variable          | Pflicht | Standard   | Beschreibung |
|-------------------|---------|------------|--------------|
| `BASE_URL`        | ✅      | —          | Öffentliche URL ohne abschließenden Slash. Wird für alle generierten Kurzlinks verwendet. |
| `MASTER_PASSWORD` | ✅      | —          | Passwort für Login & API. |
| `SESSION_SECRET`  | ✅      | —          | Zufälliger String zum Signieren von Session-Cookies. |
| `PORT`            | —       | `3000`     | Port im Container. |
| `DATA_DIR`        | —       | `/app/data`| Pfad für persistente Daten (wird vom Dockerfile gesetzt). |

Sollte der Port ein anderer sein, muss dieser sowohl in der Dockerfile (Zeile 36), in der docker-compse im Bereich Ports, als auch in den Environmentvariablen geändert werden.
---

## Reverse Proxy (nginx)

Falls nginx Reverse Proxy verwendet wird, muss die öffentliche URL der aus der .env-Datei entsprechen.

---

## REST API

Alle Anfragen benötigen den Header:
```
Authorization: Bearer <MASTER_PASSWORD>
```

### Links auflisten
```
GET /api/links
```
```json
{
  "count": 1,
  "links": [
    {
      "slug": "gh",
      "target": "https://github.com",
      "hits": 42,
      "created": "2026-01-01T10:00:00.000Z",
      "shortUrl": "https://lnk.example.com/gh"
    }
  ]
}
```

### Link erstellen
```
POST /api/links
Content-Type: application/json

{ "target": "https://example.com", "slug": "ex" }
```
`slug` ist optional — wird automatisch generiert wenn weggelassen.

### Link aktualisieren
```
PUT /api/links/:slug
Content-Type: application/json

{ "target": "https://neue-url.de" }
```

### Link löschen
```
DELETE /api/links/:slug
```

### Einstellungen abrufen
```
GET /api/settings
```

---

## Beispiele (curl)

```bash
# Alle Links
curl -H "Authorization: Bearer meinPasswort" https://lnk.example.com/api/links

# Link erstellen
curl -X POST \
  -H "Authorization: Bearer meinPasswort" \
  -H "Content-Type: application/json" \
  -d '{"target":"https://github.com","slug":"gh"}' \
  https://lnk.example.com/api/links

# Link löschen
curl -X DELETE \
  -H "Authorization: Bearer meinPasswort" \
  https://lnk.example.com/api/links/gh
```

---

## Features

- 🔗 Kurzlinks mit eigenem Slug oder auto-generiert
- 📊 Hit-Zähler pro Link
- 🎨 Akzentfarbe frei wählbar — alle Farben werden automatisch abgeleitet
- 🌓 Dark / Light Mode
- 🌍 Mehrsprachig (Deutsch, English, Französisch)
- 🏢 Firmenname, Logo & Favicon hochladbar
- ⚖️ Datenschutz-, Impressum- und AGB-Links auf der Login-Seite
- 🔐 Master-Passwort für UI & API
- 🐳 Docker-ready mit Named Volume für persistente Daten