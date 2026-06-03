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

## Tech stack

- SvelteKit (Svelte 5)
- TypeScript
- Tailwind CSS
- Turso (libSQL)
- Firecrawl (for live market/source scraping)
- Gemini AI (with fallback support for Vertex, OpenAI, Deepseek)
- Zod (for strict agentic JSON output validation)
- Vercel

## License

**No License** - This project is currently unlicensed. All rights reserved. It is published here for portfolio demonstration purposes.
