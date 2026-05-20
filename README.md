# Kanhans Family Meet 26

Static RSVP site with a **MongoDB** backend. The UI is plain HTML/CSS/JavaScript; data is stored via **Azure Functions** deployed with **Azure Static Web Apps** (no separate Function App required).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Azure Static Web Apps                                      │
│  ├── frontend/  static HTML, CSS, JS                        │
│  └── api/       Azure Functions → MongoDB                   │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │  MongoDB (Atlas)     │
                    └──────────────────────┘
```

Production calls same-origin `/api/users`. Locally, the UI uses `http://localhost:7071`.

## Prerequisites

- Node.js 18+
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) (`func`)
- MongoDB Atlas (or other MongoDB) connection string

## Local development

### API

```bash
cd api
cp local.settings.json.example local.settings.json
# Edit MONGODB_URI and CORS_ORIGINS (include http://localhost:8080)
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npx --yes serve -l 8080
```

Open [http://localhost:8080](http://localhost:8080).

## Environment variables (API)

Set in `api/local.settings.json` locally, and in **Static Web App → Configuration → Application settings** in Azure:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DATABASE` | Database name (default `usersapp`) |
| `MONGODB_COLLECTION` | Collection name (default `users`) |
| `CORS_ORIGINS` | Comma-separated origins for local dev |
| `NODE_ENV` | `production` in Azure |

## Deploy

1. Static Web App: **app location** `/frontend`, **api location** `/api`.
2. Add `MONGODB_URI` (and related settings) in Azure application settings.
3. Allow Azure outbound IPs in MongoDB Atlas **Network Access**.

Pushes to `main` run the Static Web Apps workflow.

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/users` | List RSVPs |
| `POST` | `/api/users` | Create RSVP |
| `PUT` | `/api/users/{id}` | Update RSVP |

## License

Private / unlicensed unless you add a license file.
