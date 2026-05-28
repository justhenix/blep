# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@0.15.3 create --template minimal --types ts --add prettier eslint tailwindcss="plugins:none" sveltekit-adapter="adapter:node" --install npm blep
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Backend hardening

Cheap defenses sit in front of paid Firecrawl + Gemini calls:

- **Mock mode** - `BLEP_USE_MOCK=true` short-circuits before any external call. Frontend can polish UI for free.
- **Query cache** - Firestore `scan_cache/{cacheKey}` keyed by `sha256(query :: urls :: promptVersion)`. TTL via `BLEP_CACHE_TTL_HOURS` (default 24h). Cache hits skip paid calls and quota consume.
- **Privacy-safe identity** - IP and User-Agent become one salted SHA-256 hash. Raw IP is never stored or logged.
- **Cooldown + abuse cap** - `BLEP_COOLDOWN_SECONDS` between uncached requests per identity hash; `BLEP_ABUSE_DAILY_LIMIT` daily ceiling per identity hash. Both stored in Firestore `abuse/{identityHash_date}`.
- **Daily quota** - `BLEP_DAILY_LIMIT` per UID or identity hash, only consumed after valid uncached live verdict.

See [`docs/dev-api.md`](docs/dev-api.md) for the full pipeline + error codes.
