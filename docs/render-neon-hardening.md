# Render + Neon deployment hardening report

## 1) Neon usage search results in this repository

I searched for all likely Neon integration patterns and found **no backend/database code** in this repo.

Searches run:

- `rg -n "neon|NEON_|POSTGRES_URL|DATABASE_URL|data\.api|neon\.tech" .`
- `find . -maxdepth 2 -type f | sort`

Result: no matches for Neon, Postgres URL env vars, or server-side DB initialization.

## 2) Exact request path returning this JSON

Error observed:

```json
{"message":"The endpoint has been disabled. Enable it using Neon API and retry."}
```

Within this repository, there is no request code that can produce or handle this payload.
That means the failing request path is coming from another service/repository (likely your Render API service), not from this React frontend.

For a Neon Data/API-style integration, the failing path is usually one of these patterns in the backend service:

- `https://<project-or-endpoint>.neon.tech/sql`
- `https://console.neon.tech/api/v2/projects/:projectId/endpoints/:endpointId`

Add request logging around your DB initialization/query layer in the backend to confirm the exact URL and route.

## 3) Required env vars and where they are read

In this repository: none are read.

For the backend service that deploys on Render, these are the typical required vars:

- `DATABASE_URL` (primary Postgres connection string)
- `POSTGRES_URL` (alternate naming used by many starters)
- `POSTGRES_PRISMA_URL` (if Prisma + pooled connection is used)
- `POSTGRES_URL_NON_POOLING` (for migrations)
- `NEON_API_KEY` (only if calling Neon management API)
- `NEON_PROJECT_ID` and `NEON_ENDPOINT_ID` (if enabling endpoint via API)
- `NODE_ENV`
- `PORT`

## 4) Minimal robust backend change (PR-ready reference patch)

Apply the following in your Render backend service (not this frontend repo):

### a) Clear startup failure message + env validation

```ts
// src/config/env.ts
const required = ['DATABASE_URL'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(
      `[startup] Missing required env var ${key}. ` +
      `Set it in Render dashboard (Environment) and redeploy.`
    );
  }
}

export const env = {
  databaseUrl: process.env.DATABASE_URL!,
  neonApiKey: process.env.NEON_API_KEY,
  neonProjectId: process.env.NEON_PROJECT_ID,
  neonEndpointId: process.env.NEON_ENDPOINT_ID,
};
```

### b) Retry/backoff for initial DB connection

```ts
// src/db/connectWithRetry.ts
export async function connectWithRetry(connect: () => Promise<void>) {
  const maxAttempts = 6;
  const baseDelayMs = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await connect();
      console.log(`[db] connected on attempt ${attempt}`);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const delay = baseDelayMs * 2 ** (attempt - 1);

      console.error(`[db] connection failed (attempt ${attempt}/${maxAttempts}): ${message}`);

      if (attempt === maxAttempts) {
        throw new Error(
          `[startup] Could not connect to database after ${maxAttempts} attempts. ` +
          `If using Neon, verify endpoint is enabled and DATABASE_URL points to an active endpoint.`
        );
      }

      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
```

### c) Health endpoint reporting DB connectivity

```ts
// src/routes/health.ts
import { Router } from 'express';

export function healthRouter(checkDb: () => Promise<boolean>) {
  const router = Router();

  router.get('/healthz', async (_req, res) => {
    const dbOk = await checkDb().catch(() => false);
    const status = dbOk ? 200 : 503;

    res.status(status).json({
      ok: dbOk,
      db: dbOk ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
```

## 5) Render environment checklist

- [ ] `DATABASE_URL` is set and points to an **enabled** Neon endpoint.
- [ ] If you use Prisma, set both pooled and non-pooled URLs correctly.
- [ ] If you call Neon management API, set `NEON_API_KEY` (and IDs if required).
- [ ] Confirm region/network settings between Render and Neon.
- [ ] Configure Render health check path to `/healthz`.
- [ ] Redeploy and verify logs show successful DB connection attempt.
