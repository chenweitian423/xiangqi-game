# Cloudflare full deployment

This project can run entirely on Cloudflare:

- Static React/Vite app: Cloudflare Workers Static Assets
- Online API: Cloudflare Worker
- Realtime room state and WebSocket sessions: Durable Objects

The deployment is configured in `wrangler.jsonc`. The Worker serves the built
`dist` directory and handles API/WebSocket paths before static asset lookup.

## Prerequisites

1. Install dependencies:

   ```bash
   npm install
   ```

2. Sign in to Cloudflare:

   ```bash
   npx wrangler login
   ```

3. Choose the public origin for the app. For the default Workers domain it
   will look like:

   ```text
   https://<your-worker-name>.<your-subdomain>.workers.dev
   ```

4. Update `CORS_ORIGINS` in `wrangler.jsonc` to match the public origin.
   Multiple origins can be comma-separated.

## Local Cloudflare preview

Run the production build through Wrangler:

```bash
npm run cf:dev
```

Wrangler serves the static frontend and Worker routes together. The frontend
uses same-origin paths:

```env
VITE_ONLINE_API_BASE_URL=/api
VITE_ONLINE_WS_URL=/ws
```

The Worker accepts the `/api` prefix directly, so the old Vercel rewrite layer
is no longer required.

## Deploy

Deploy the full app:

```bash
npm run cf:deploy
```

The first deploy creates the Durable Object migration declared in
`wrangler.jsonc`:

```jsonc
"migrations": [
  {
    "tag": "v1",
    "new_sqlite_classes": ["RoomDurableObject"]
  }
]
```

After deployment, verify:

```bash
curl https://<your-worker-name>.<your-subdomain>.workers.dev/health
```

Expected response:

```json
{"ok":true,"service":"xiangqi-online-server"}
```

## Custom domain

After adding a custom domain in Cloudflare, update `CORS_ORIGINS` to the final
domain and redeploy:

```jsonc
"vars": {
  "CORS_ORIGINS": "https://xiangqi.example.com"
}
```

The frontend still uses same-origin `/api` and `/ws` paths, so no Vite env
change is needed for a custom domain.

## Legacy deployment files

`vercel.json` and `render.yaml` are kept for reference, but the Cloudflare full
deployment path does not use Vercel, Render, Docker, or Postgres.
