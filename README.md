# PricePulse

An intelligent electronics price tracking and alert system. Search for products across Google Shopping, add them to your wishlist with a target price, and receive an email notification the moment the price drops.

## Features

- Real-time product search powered by Google Shopping (ValueSerp API)
- User registration and login with JWT authentication
- Personal wishlist with target price per product
- Automated price monitoring every 6 hours via node-cron
- Email alerts via Resend when a product hits your target price
- Price history tracking for every monitored product
- Fully containerised with Docker

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, React Router v6 |
| Backend | Node.js 20, Express.js 4 |
| Database | PostgreSQL 16, Prisma ORM |
| Auth | JWT, bcryptjs |
| Price Data | ValueSerp (Google Shopping API) |
| Email | Resend |
| Scheduling | node-cron |
| Security | Helmet.js, express-rate-limit, express-validator |
| Testing | Jest, Supertest |
| Deployment | Render (backend), Cloudflare Pages (frontend), Supabase (database), Docker Compose (local dev) |

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop

### 1. Clone the repository

```bash
git clone https://github.com/zaid-akroush/pricepulse.git
cd pricepulse
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in the values in `.env`:

| Variable | Where to get it |
|----------|----------------|
| `SERPAPI_KEY` | [serpapi.com](https://serpapi.com) — private API key. Free tier is 250 searches/month, renewed monthly. This is the default provider. |
| `SEARCH_PROVIDER` | `serpapi` (default), `brightdata`, or `serper`. |
| `BRIGHTDATA_API_KEY` | [brightdata.com](https://brightdata.com) — account API token. The SERP API free tier is 5,000 requests/month, renewed monthly. |
| `BRIGHTDATA_SERP_ZONE` | The **name** of the SERP zone you create in the Bright Data control panel (not the token). |
| `SERP_API_KEY` | [serper.dev](https://serper.dev) — legacy provider, only used when `SEARCH_PROVIDER=serper`. Its free tier is a one-time 2,500 credits. |
| `RESEND_API_KEY` | [resend.com/api-keys](https://resend.com/api-keys) |
| `JWT_SECRET` | Any long random string |

### 3. Start with Docker Compose

```bash
docker-compose up --build
```

The app will be available at **http://localhost**.

### 4. Or run locally (without Docker)

Start the database:

```bash
docker run --name pricepulse-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=pricepulse -p 5432:5432 -d postgres:16-alpine
```

Start the backend:

```bash
cd backend
cp .env.example .env   # fill in your keys
npm install
npx prisma migrate dev
npm run dev
```

Start the frontend (new terminal):

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**.

### 5. Or run both together with one command

From the project root (one-time setup, then anytime after):

```bash
npm install
npm run dev
```

This starts the backend and frontend concurrently in one terminal (requires the database already running and both `.env` files filled in as above).

## Running Tests

```bash
cd backend
npm test
```

21 integration tests covering authentication, wishlist management, and product routes.

## Hosting

The live site deploys itself. Once the one-time setup below is done, every
`git push` to `main` automatically rebuilds and redeploys both the frontend
and the backend, nothing needs to be started or run on a local machine.

**Architecture:**

| Piece | Host | Free tier | Auto-deploys on push? |
|-------|------|-----------|------------------------|
| Frontend | Cloudflare Pages | Yes, no expiry | Yes (GitHub integration) |
| Backend API | Render | Yes, 750 hrs/month | Yes (`render.yaml` blueprint) |
| Database | Supabase Postgres | Yes, no time-based expiry | N/A (database, not code) |

### One-time setup

**1. Database (Supabase)**

- Create a free project at [supabase.com](https://supabase.com).
- Go to Settings -> Database and copy the "Direct connection" connection string.
- Save it somewhere; it becomes `DATABASE_URL` in step 2.

**2. Backend (Render)**

- Push this repository to GitHub.
- In the [Render dashboard](https://dashboard.render.com): New -> Blueprint, and connect this repo.
- Render finds `render.yaml` at the repo root and creates a `pricepulse-api` web service on the free plan.
- Fill in the secret values it asks for: `DATABASE_URL` (from step 1), `JWT_SECRET` (any long random string), `ADMIN_EMAILS`, `SERP_API_KEY`, `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CLIENT_URL` (your Cloudflare Pages URL, e.g. `https://pricepulse-cw6.pages.dev`), and `INTERNAL_PROXY_SECRET` (any long random string — must match the same value set in step 3 on Cloudflare Pages).
- Deploy. Copy the resulting `https://pricepulse-api.onrender.com`-style URL.

**3. Frontend (Cloudflare Pages)**

- In the Cloudflare dashboard: Workers & Pages -> Create -> Pages -> connect this repo on GitHub.
- Build command: `npm run build` (from `frontend/`). Output directory: `dist`.
- Under the project's Settings -> Environment variables, add a secret named `BACKEND_URL` set to the Render URL from step 2. A Cloudflare Pages Function (`frontend/functions/api/[[path]].js`) proxies every `/api/*` request on the live site to this URL, so the frontend never calls Render directly and `BACKEND_URL` only needs to be set this one time.
- Also add a secret named `INTERNAL_PROXY_SECRET` (any long random string, matching the value entered on Render in step 2). The Pages Function forwards it on every proxied request so the backend's rate limiter can tell a genuine Cloudflare-routed request from someone hitting the Render URL directly and spoofing the client-IP header.
- Every future `git push` to `main` now rebuilds and redeploys the frontend automatically.

**4. Keep the free backend warm (optional but recommended)**

Render's free web service spins down after about 15 minutes of no traffic,
which adds a ~1 minute delay to the next request and can cause the 6-hourly
price-check cron to be skipped while asleep. To avoid this, add a free
monitor at [cron-job.org](https://cron-job.org) that pings
`https://pricepulse-api.onrender.com/api/health` every 10 minutes. This
keeps the service (and the database connection) warm at no cost.

### Local development

Local development still uses Docker Compose and is unaffected by any of the above:

```bash
docker-compose up --build
```

The app will be available at **http://localhost**.

## Project Structure

```
pricepulse/
├── backend/
│   ├── prisma/schema.prisma
│   └── src/
│       ├── routes/        # auth, products, wishlist
│       ├── middleware/    # JWT verification
│       ├── services/      # serpApi, mailer
│       ├── jobs/          # priceCron
│       └── tests/         # Jest + Supertest
├── frontend/
│   └── src/
│       ├── pages/         # Home, Search, Wishlist, Login, Register
│       ├── components/    # Navbar, ProductCard, WishlistItem
│       ├── context/       # AuthContext
│       └── api/           # Axios instance
├── docker-compose.yml
├── render.yaml
└── .env.example
```

## License

MIT
