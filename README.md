# ROC GMS V2

## Production notes

Production requires `PAYLOAD_SECRET` and `DATABASE_URL`; the application fails fast when either is
missing. The supplied Compose file is intentionally a local development stack (including exposed
Postgres, Redis, and Mailpit ports) and must not be deployed as-is. Documentation upload validation
enforces a size and type allowlist locally; deploy a malware-scanning storage pipeline for untrusted
production uploads.

ROC Game Management System V2 is a Next.js and Payload CMS foundation for running multi-sport
tournaments and games - office sports days, inter-school competitions, community/public games, and
similar events.

## Local Setup

1. Copy `.env.example` to `.env` and update `PAYLOAD_SECRET`.
2. Install dependencies:

```bash
npm install
```

3. Start the app and services with Docker Compose:

```bash
docker compose up --build
```

4. Open the app:

- Public foundation page: <http://localhost:3000>
- Payload Admin: <http://localhost:3000/admin>
- Health check: <http://localhost:3000/api/health>
- Mailpit: <http://localhost:8025>

## Seed Data

Run the seed after the app dependencies are installed and PostgreSQL is running:

```bash
npm run seed
```

If you are seeding from your host machine while using Docker Compose, keep `DATABASE_URL`
pointing at `localhost:15432` as shown in `.env.example`.

The Phase 0 seed creates a super admin user and default site config only. Tournament demo data starts in later phases.

Default local seed credentials:

- Email: `admin@roc-gms.local`
- Password: `ChangeMe123!`

## Useful Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run seed
npm run generate:types
docker compose down
docker compose down -v
```

Use `docker compose down -v` only when you want to remove local database and Redis volumes.
