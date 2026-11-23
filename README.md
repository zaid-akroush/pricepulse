# PricePulse

An electronics price tracker. Search Google Shopping in your country, add products to a wishlist with a target price, and get an email and an in-app alert when a product reaches it.

Built as a BSc thesis project ("Tech Deal Tracker – A Full-Stack Price Monitoring Web Application", University of Debrecen, Faculty of Informatics). Live at https://pricepulse-cw6.pages.dev.

## Features

- Real-time product search powered by Google Shopping (SerpApi), in the country you choose (US, UK, Germany, Hungary, Jordan and more), priced in that country's currency
- User registration and login with JWT authentication
- Personal wishlist with target price or target drop percentage per product
- Adaptive price monitoring: each product is re-checked every 3 to 48 hours depending on how much its price moves and how many people track it, and products that share a search cost one provider request
- Email and in-app alerts when a product hits your target or drops
- Price history for every monitored product, with a buy-or-wait forecast, retailer comparison and your own alert history
- Public Trends page: biggest drops, all-time lows and most volatile products, built from the collected history
- Fully containerised with Docker

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, React Router v6 |
| Backend | Node.js 20, Express.js 4 |
| Database | PostgreSQL 16, Prisma ORM |
| Auth | JWT, bcryptjs |
| Price Data | SerpApi (Google Shopping) |
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
| `SERPAPI_KEY` | [serpapi.com](https://serpapi.com) — private API key. Free tier is 250 searches/month, renewed monthly. |
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

The tests need a PostgreSQL database (`DATABASE_URL` and `DIRECT_URL`). The suite has integration tests for the authentication, wishlist and product routes, an integration test of the price sweep against a stubbed search provider, and unit tests for the decision logic (price parsing, title matching, classification, instalment detection, scheduling, trends): 145 tests, 144 passing and 1 skipped (it needs a real network call).

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
- Fill in the secret values it asks for: `DATABASE_URL` and `DIRECT_URL` (from step 1), `JWT_SECRET` (any long random string), `SERPAPI_KEY`, `RESEND_API_KEY`, `CLIENT_URL` (your Cloudflare Pages URL, e.g. `https://pricepulse-cw6.pages.dev`), and `INTERNAL_PROXY_SECRET` (any long random string, matching the value set in step 3 on Cloudflare Pages).
- The service runs `prisma migrate deploy` on every start, so the database must be reachable or the deploy fails.
- Deploy. Copy the resulting `https://pricepulse-api.onrender.com`-style URL.

**3. Frontend (Cloudflare Pages)**

- In the Cloudflare dashboard: Workers & Pages -> Create -> Pages -> connect this repo on GitHub.
- Build command: `npm run build` (from `frontend/`). Output directory: `dist`.
- Under the project's Settings -> Environment variables, add a secret named `BACKEND_URL` set to the Render URL from step 2. A Cloudflare Pages Function (`frontend/functions/api/[[path]].js`) proxies every `/api/*` request on the live site to this URL, so the frontend never calls Render directly and `BACKEND_URL` only needs to be set this one time.
- Also add a secret named `INTERNAL_PROXY_SECRET` (any long random string, matching the value entered on Render in step 2). The Pages Function forwards it on every proxied request so the backend's rate limiter can tell a genuine Cloudflare-routed request from someone hitting the Render URL directly and spoofing the client-IP header.
- Every future `git push` to `main` now rebuilds and redeploys the frontend automatically.

**4. Keep the free database awake**

Supabase pauses a free project after about a week without database activity, which takes the API down (Render deploys then fail because the migration step cannot connect). The workflow in `.github/workflows/keep-awake.yml` loads real data through the live site every 3 days so the database stays active. It can also be run by hand from the repository's Actions tab. If the project does get paused, resume it in the Supabase dashboard and redeploy on Render.

Note on e-mail: the sender is Resend's shared test address (`onboarding@resend.dev`), which only delivers to the e-mail address of the Resend account owner. Sending to other users needs a verified domain in Resend.

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
│       ├── routes/        # auth, products, wishlist, notifications
│       ├── middleware/    # JWT verification
│       ├── services/      # search, matching, scheduling, trends, mailer
│       ├── jobs/          # priceCron
│       └── tests/         # Jest + Supertest
├── frontend/
│   └── src/
│       ├── pages/         # Home, Search, Product, Wishlist, Trends, auth pages
│       ├── components/    # Navbar, ProductCard, WishlistItem, PriceChart, ...
│       ├── context/       # AuthContext
│       └── api/           # Axios instance
├── .github/workflows/  # keep-awake job
├── docker-compose.yml
├── render.yaml
└── .env.example
```

## License

MIT
