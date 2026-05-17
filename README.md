# Users app

A small full-stack app to add and list users. The frontend is static HTML/CSS/JavaScript; the backend is a Node.js Express API backed by Azure SQL Database. Both are set up to deploy to Azure (Static Web Apps + App Service) via GitHub Actions.

## Architecture

```
┌─────────────────────┐     HTTPS      ┌──────────────────────┐
│  Azure Static       │  ───────────►  │  Azure App Service   │
│  Web Apps (frontend)│   /api/*       │  (Express API)       │
└─────────────────────┘                └──────────┬───────────┘
                                                  │
                                                  ▼
                                       ┌──────────────────────┐
                                       │  Azure SQL Database  │
                                       └──────────────────────┘
```

On first request, the API creates a `dbo.Users` table if it does not exist.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- An Azure SQL database (or compatible SQL Server) with a login that can create tables
- For deployment: Azure App Service, Azure Static Web Apps, and a GitHub repository

## Local development

### 1. Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your SQL connection details and CORS origins (include `http://localhost:8080` for the static frontend).

```bash
npm install
npm run dev
```

The API listens on port **3000** by default (`PORT` in `.env`).

### 2. Frontend

Serve the `frontend` folder on port **8080** so the app can reach the API (see `frontend/app.js` and `frontend/env-config.js`).

```bash
cd frontend
npx --yes serve -l 8080
```

Open [http://localhost:8080](http://localhost:8080). `env-config.js` sets `window.__API_BASE__` to `http://localhost:3000` for local use.

In development, the API allows any `localhost` / `127.0.0.1` origin when `NODE_ENV` is not `production`, even if it is not listed in `CORS_ORIGINS`.

## Environment variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default `3000`) |
| `NODE_ENV` | Set to `production` on App Service so CORS only allows `CORS_ORIGINS` |
| `AZURE_SQL_SERVER` | Server host, e.g. `your-server.database.windows.net` |
| `AZURE_SQL_DATABASE` | Database name |
| `AZURE_SQL_USER` | SQL login |
| `AZURE_SQL_PASSWORD` | SQL password |
| `AZURE_SQL_TRUST_SERVER_CERTIFICATE` | Optional; set to `true` only if needed for local/dev SQL |
| `CORS_ORIGINS` | Comma-separated allowed origins, e.g. `http://localhost:8080,https://your-app.azurestaticapps.net` |

Do not commit `.env`; it is listed in `.gitignore`.

### Frontend

| File | Purpose |
|------|---------|
| `frontend/env-config.js` | Sets `window.__API_BASE__` to the public API URL. CI overwrites this on deploy. |

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check `{ "ok": true }` |
| `GET` | `/api/users` | List RSVPs (newest first); each item: `fullName`, `isAttending`, attendee counts |
| `POST` | `/api/users` | Create RSVP; body: `{ "fullName", "isAttending", "attendeesAbove16", ... }` |

## Deploy to Azure

### App Service (backend)

1. Create a Linux App Service app (Node 18+).
2. In **Configuration → Application settings**, set the same variables as in `.env.example` (especially `AZURE_SQL_*`, `CORS_ORIGINS`, and `NODE_ENV=production`).
3. Add GitHub secrets for the backend workflow:
   - `AZURE_WEBAPP_NAME`
   - `AZURE_WEBAPP_PUBLISH_PROFILE`

Pushes to `main` run [`.github/workflows/main_kanhansbackend.yml`](.github/workflows/main_kanhansbackend.yml).

### Static Web Apps (frontend)

1. Create an Azure Static Web App linked to this repo; set **app location** to `/frontend`.
2. Optional GitHub secret `BACKEND_PUBLIC_URL` — public API URL with no trailing slash (the SWA workflow has a default if unset).
3. Ensure `CORS_ORIGINS` on the API includes your Static Web App URL.

Pushes to `main` run [`.github/workflows/azure-static-web-apps-black-sand-055b3d910.yml`](.github/workflows/azure-static-web-apps-black-sand-055b3d910.yml), which sets `env-config.js` before deploy.

## Project layout

```
├── backend/
│   ├── server.js          # Express app and routes
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── env-config.js      # API base URL (local + CI)
│   └── staticwebapp.config.json
└── .github/workflows/     # Azure deploy pipelines
```

## License

Private / unlicensed unless you add a license file.
