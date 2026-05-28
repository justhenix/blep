# BLEP

BLEP is a tiny AI hardware judge that helps people avoid buying bad used laptops and near e-waste devices.

Instead of acting like a chatbot, BLEP runs a focused one-shot research pipeline: it searches live sources, reads hardware evidence, asks Gemini for a strict structured verdict, validates the result, and renders a clear buy/caution/waste decision.

## What it does

BLEP judges a device or listing and returns:

- a verdict: `APPROVED`, `CAUTION`, or `WASTE`
- the estimated landfill year
- the fatal flaw
- upgradeability, thermal notes, and a forum score
- a short roast
- a practical summary
- evidence cards linked to sources

The goal is simple: save money, reduce regret, and stop people from buying hardware that should already be retired.

## Why it matters

Used hardware listings often hide the important parts: weak CPUs, soldered memory, bad screens, poor thermals, worn batteries, and limited upgrade paths. A normal buyer can miss those details until after purchase.

BLEP compresses that research into a fast verdict card backed by source evidence.

## Agentic pipeline

```text
User enters device/listing
        |
        v
SvelteKit API route validates request
        |
        v
Quota, cache, and abuse checks
        |
        v
Firecrawl searches/scrapes 3-5 sources
        |
        v
Gemini returns strict JSON verdict
        |
        v
Zod validates schema and evidence
        |
        v
UI renders verdict card
```

BLEP is intentionally not a multi-turn assistant. It is a one-shot agentic judge with a fixed job.

## Tech stack

- SvelteKit
- Svelte 5
- TypeScript
- Tailwind CSS
- SvelteKit adapter-node
- Firebase Admin SDK
- Firebase Auth
- Firestore
- Firecrawl
- Gemini via `@google/genai`
- Zod
- Docker
- Cloud Run target deployment

<details>
<summary><strong>Core API</strong></summary>

### `POST /api/scan`

Request:

```json
{
	"query": "ThinkPad T480 used laptop",
	"urls": ["https://example.com/listing"]
}
```

Response:

```json
{
	"ok": true,
	"mode": "live",
	"cached": false,
	"quota": {
		"remaining": 1,
		"limit": 2
	},
	"sources": [
		{
			"title": "Example source",
			"url": "https://example.com/source"
		}
	],
	"verdict": {
		"name": "ThinkPad T480",
		"verdict": "APPROVED",
		"landfill_year": 2029,
		"fatal_flaw": "Base panel quality can be poor.",
		"specs": {
			"upgradeable": true,
			"thermal": "Generally manageable for daily use.",
			"forum_score": 8
		},
		"roast": "It is old, but not dead.",
		"summary": "A repairable used laptop that can still make sense if priced correctly.",
		"evidence": [
			{
				"title": "Example source",
				"url": "https://example.com/source",
				"quote_or_fact": "Example fact from source.",
				"relevance": "Explains why the verdict was chosen."
			}
		]
	}
}
```

</details>

<details>
<summary><strong>Verdict schema</strong></summary>

```ts
type BlepVerdict = {
	name: string;

	verdict: 'APPROVED' | 'CAUTION' | 'WASTE';

	landfill_year: number;

	fatal_flaw: string;

	specs: {
		upgradeable: boolean;
		thermal: string;
		forum_score: number;
	};

	roast: string;

	summary: string;

	evidence: {
		title: string;
		url: string;
		quote_or_fact: string;
		relevance: string;
	}[];
};
```

</details>

<details>
<summary><strong>Modes</strong></summary>

### Mock mode

Use mock mode while polishing the frontend or demo flow.

```env
BLEP_USE_MOCK=true
BLEP_DAILY_LIMIT=999
```

Mock mode avoids paid or rate-limited services:

- no Firecrawl calls
- no Gemini calls
- no Firebase quota, cache, or abuse writes
- deterministic verdicts for common test queries

Example test queries:

```text
ThinkPad T480 used laptop
Acer Aspire DDR2 1GB RAM 160GB HDD
Axioo Hype 5 AMD X5-2 8GB 256GB for Blender
```

### Live mode

Use live mode for real scans.

```env
BLEP_USE_MOCK=false
```

Live mode uses Firecrawl, Gemini, Firestore quota, cache, and abuse controls.

</details>

<details>
<summary><strong>Environment variables</strong></summary>

Create `.env` from `.env.example`.

```env
GEMINI_API_KEY=
FIRECRAWL_API_KEY=
FIREBASE_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=

BLEP_USE_MOCK=true
BLEP_DEMO_MODE=false
BLEP_DAILY_LIMIT=2
BLEP_ABUSE_DAILY_LIMIT=10
BLEP_COOLDOWN_SECONDS=15
BLEP_CACHE_TTL_HOURS=24
BLEP_HASH_SALT=change-me-local-dev
BLEP_PROMPT_VERSION=v1

GEMINI_MODEL_MAIN=gemini-3.1-flash-lite
GEMINI_MODEL_BACKUP=gemini-2.5-flash-lite
GEMINI_MODEL_DEMO=gemini-3.5-flash
```

Local Firebase Admin setup:

```env
GOOGLE_APPLICATION_CREDENTIALS="D:/path/to/blep-firebase-adminsdk.json"
```

Do not commit `.env`, service account JSON, or other secrets.

</details>

<details>
<summary><strong>Development and API testing</strong></summary>

Install dependencies:

```sh
npm install
```

Run dev server:

```sh
npm run dev
```

Run with a fixed local host and port:

```sh
npm run dev -- --host 127.0.0.1 --port 5180
```

Check types:

```sh
npm run check
```

Build:

```sh
npm run build
```

Preview production build:

```sh
npm run preview
```

### Manual API test

PowerShell:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:5180/api/scan" `
  -ContentType "application/json" `
  -Body '{"query":"ThinkPad T480 used laptop"}'
```

curl:

```sh
curl -X POST http://127.0.0.1:5180/api/scan \
  -H "Content-Type: application/json" \
  -d '{"query":"ThinkPad T480 used laptop"}'
```

</details>

<details>
<summary><strong>Backend safety and optimization</strong></summary>

BLEP includes several backend protections:

- strict request validation with Zod
- strict Gemini JSON schema output
- schema validation before returning verdicts
- evidence URL validation against scraped sources
- quota limits
- cache for repeated scans
- cooldown and abuse checks
- hashed request identity instead of raw IP storage
- safe fallback responses
- no API keys exposed to the client

### Cache behavior

Repeated live scans can be served from Firestore cache instead of calling Firecrawl and Gemini again. Cache keys are derived from normalized query text, normalized URLs, and the prompt version.

### Abuse control

Requests are tracked using a salted hash of request identity. Raw IP addresses are not stored or returned to the client.

</details>

<details>
<summary><strong>Deployment</strong></summary>

The project is prepared for a Node server build through SvelteKit adapter-node and can be deployed to Cloud Run.

Example source deploy:

```sh
gcloud run deploy blep \
  --source . \
  --region asia-southeast2 \
  --allow-unauthenticated
```

Use Secret Manager or Cloud Run secrets for production environment variables. Do not deploy local `.env` files or service account JSON files.

</details>

<details>
<summary><strong>Demo script</strong></summary>

1. Open BLEP.
2. Enter a bad listing, such as:

   ```text
   Acer Aspire DDR2 1GB RAM 160GB HDD
   ```

3. Show the agent log while BLEP scans.
4. Show the verdict card.
5. Point out the fatal flaw, landfill year, and evidence.
6. Enter a more reasonable used laptop, such as:

   ```text
   ThinkPad T480 used laptop
   ```

7. Compare how the verdict changes.

</details>

<details>
<summary><strong>Project shape</strong></summary>

```text
src/routes/
  api/scan/+server.ts
  +page.svelte

src/lib/blep/
  mock.ts
  prompt.ts
  schema.ts
  types.ts

src/lib/server/
  abuse.ts
  cache.ts
  env.ts
  errors.ts
  firecrawl.ts
  firebase-admin.ts
  gemini.ts
  quota.ts
  request-identity.ts
```

</details>

## Status

Backend live scan is functional. Mock mode is available for frontend work without burning Firecrawl or Gemini credits.

Immediate next steps:

- polish frontend presentation
- keep mock mode on during UI work
- deploy to Cloud Run
- configure production secrets
- add Firebase Auth UI when needed
