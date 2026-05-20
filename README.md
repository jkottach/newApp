# Users app

A small full-stack app to add and list users. The frontend is static HTML/CSS/JavaScript; the API is **Azure Functions** (Node.js) backed by **MongoDB**. Both deploy together via **Azure Static Web Apps** and GitHub Actions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Azure Static Web Apps                                      │
│  ├── static frontend (HTML/CSS/JS)                        │
│  └── /api/*  →  Azure Functions (Node.js)                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  MongoDB             │
                    │  (Atlas or self-host)│
                    └──────────────────────┘
```

Documents are stored in the `users` collection (configurable). Each document has `fullName`, `isAttending`, attendee counts, and `createdAt`.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer (LTS recommended; Azure Functions may warn on very new versions)
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4 (`func`)
- A MongoDB database ([MongoDB Atlas](https://www.mongodb.com/cloud/atlas) free tier works)
- For deployment: Azure Static Web Apps linked to this repo

## Local development

### 1. API (Azure Functions)

```bash
cd api
cp local.settings.json.example local.settings.json
```

Edit `local.settings.json` → `Values`:

- `MONGODB_URI` — connection string from Atlas (**Database → Connect → Drivers**)
- `MONGODB_DATABASE` — database name (default `usersapp`)
- `MONGODB_COLLECTION` — collection name (default `users`)
- `CORS_ORIGINS` — include `http://localhost:8080` for the static frontend

In Atlas, allow your IP under **Network Access** (or `0.0.0.0/0` for quick local testing).

```bash
npm install
npm run dev
```

Functions listen on **http://localhost:7071** (`/api/health`, `/api/users`).

### 2. Frontend

Serve the `frontend` folder on port **8080**:

```bash
cd frontend
npx --yes serve -l 8080
```

Open [http://localhost:8080](http://localhost:8080). `env-config.js` points at `http://localhost:7071`.

**Optional:** run frontend and API together with the Static Web Apps CLI:

```bash
npx --yes @azure/static-web-apps-cli start ./frontend --api-location ./api --port 8080
```

Then set `window.__API_BASE__ = ''` in `env-config.js` so requests use the same origin.

In development, the API allows any `localhost` / `127.0.0.1` origin when `NODE_ENV` is not `production`, even if it is not listed in `CORS_ORIGINS`.

## Environment variables

### API (`api/local.settings.json` → `Values`)

| Variable | Description |
|----------|-------------|
| `FUNCTIONS_WORKER_RUNTIME` | Must be `node` |
| `AzureWebJobsStorage` | Leave empty for local dev; set in Azure for production |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DATABASE` | Database name (default `usersapp`) |
| `MONGODB_COLLECTION` | Collection name (default `users`) |
| `CORS_ORIGINS` | Comma-separated allowed origins (for local dev with separate ports) |
| `NODE_ENV` | Set to `production` in Azure so CORS only uses `CORS_ORIGINS` |

Do not commit `local.settings.json`; it is listed in `.gitignore`.

### Frontend

| File | Purpose |
|------|---------|
| `frontend/env-config.js` | `window.__API_BASE__` — empty in production (same-origin `/api`), `http://localhost:7071` locally |

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check `{ "ok": true }` |
| `GET` | `/api/users` | List RSVPs (newest first) |
| `POST` | `/api/users` | Create RSVP; JSON body with `fullName`, `isAttending`, attendee counts |

## Deploy to Azure

### Static Web Apps (frontend + API)

1. Create an Azure Static Web App linked to this repo.
2. Set **app location** to `/frontend` and **api location** to `/api`.
3. In the Static Web App → **Configuration → Application settings**, add:
   - `MONGODB_URI`, `MONGODB_DATABASE`, `MONGODB_COLLECTION`
   - Optional `CORS_ORIGINS`, `NODE_ENV=production`
4. In MongoDB Atlas → **Network Access**, allow Azure (or use `0.0.0.0/0` if acceptable for your use case).

Pushes to `main` run [`.github/workflows/azure-static-web-apps-black-sand-055b3d910.yml`](.github/workflows/azure-static-web-apps-black-sand-055b3d910.yml). Production uses same-origin `/api`.

## Project layout

```
├── api/
│   ├── host.json
│   ├── package.json
│   ├── local.settings.json.example
│   └── src/
│       ├── index.js
│       ├── functions/     # HTTP triggers (health, users)
│       └── shared/        # MongoDB, CORS, validation
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── env-config.js
│   └── staticwebapp.config.json
└── .github/workflows/     # Azure deploy pipeline
```

## License

Private / unlicensed unless you add a license file.
