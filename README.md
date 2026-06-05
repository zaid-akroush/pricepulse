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
| Deployment | Docker, Docker Compose, Render |

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
| `SERP_API_KEY` | [valueserp.com](https://www.valueserp.com) |
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

## Running Tests

```bash
cd backend
npm test
```

21 integration tests covering authentication, wishlist management, and product routes.

## Deployment

The project includes a `render.yaml` for one-click deployment on [Render](https://render.com):

1. Push the repository to GitHub
2. Connect the repo on [render.com](https://render.com)
3. Render reads `render.yaml` and provisions the backend, frontend, and PostgreSQL database automatically
4. Set `SERP_API_KEY` and `RESEND_API_KEY` in the Render dashboard

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
