# Portfolio

- `frontend/` — Vite + React site, deployed to GitHub Pages.
- `backend/` — FastAPI (Python) API used by the site.

## API

| Endpoint | What it does |
| --- | --- |
| `POST /api/contact` | Validates the contact form and emails it to you through [Resend](https://resend.com). Rate limited to 5 per IP per hour, with a honeypot field for bots. |
| `GET /api/github/activity` | Returns a year of daily commit counts plus recent pushes for the commit heatmap. Cached for 10 minutes. |
| `GET /api/health` | Liveness check. |

Interactive docs are served at `/docs` while the backend is running.

## Local development

Needs [uv](https://docs.astral.sh/uv/) and [bun](https://bun.sh).

```bash
cd backend && cp .env.example .env && uv run uvicorn app.main:app --reload --port 8787
cd frontend && bun install && bun run dev
```

The site runs at http://localhost:5173 and Vite proxies `/api` to the backend,
so no frontend config is needed locally. With no `RESEND_API_KEY`, contact
messages are printed to the backend console instead of emailed. The heatmap
matches your GitHub profile calendar: it uses the GraphQL API when a
`GITHUB_TOKEN` is set, otherwise it reads the public profile page, and only if
both fail does it fall back to recent public push events (about 90 days).

## Deployment

GitHub Pages only serves static files, so the backend has to be hosted elsewhere
(Render, Railway, Fly.io, and similar all work).

1. Deploy `backend/` (Python 3.11+). Install with `uv sync --no-dev` (or
   `pip install .`) and start with:

   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'
   ```

   `--proxy-headers` makes the rate limiter see the visitor's IP instead of the
   host's proxy. Set the variables from `backend/.env.example` (`ENVIRONMENT=production`,
   `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `FRONTEND_ORIGIN`, and optionally
   `GITHUB_TOKEN`).
2. In the GitHub repo, go to Settings → Secrets and variables → Actions →
   Variables and add `VITE_API_URL` with the backend's origin (no trailing
   slash). Re-run the deploy workflow.

Until `VITE_API_URL` is set, the live site shows a fallback message in place of
the form and the heatmap.
