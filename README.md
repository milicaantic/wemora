# Wemora

**Web → mobile migration that proves it works.** Wemora takes a React web app (an SPA with React Router) and builds an Expo (React Native) app, screen by screen. For every screen it **proves with executable tests** that the mobile version behaves like the original.

> **Srpski, ukratko:** Wemora je CLI alat koji od React web aplikacije pravi Expo mobilnu aplikaciju i za svaki ekran izvršnim testovima dokazuje da se ponaša isto kao original. Projekat za JigJoy × NTP Novi Sad Hackathon (Freestyle), napravljen na Mozaik frameworku.

> 🚧 **Work in progress.** This README is filled in as each part lands. Every command below works today; sections marked *in progress* describe parts that are not merged yet.

## Why

*In progress.* Teams with a web app and a client who wants a mobile app today choose between a wrapper (Capacitor/PWA, not a real native app) and an AI generator that writes plausible code with no proof that it works. Wemora's product is the **proof**: tests are written from the running original, the mobile code can never change them, and plain code (not AI) gives the verdict.

## How it works

*In progress.* A run has four stages:

1. **Analysis:** 1–4 analyzer agents read their part of the web app; an architect agent merges their reports into a plan.
2. **Building and testing at the same time:** builder agents write mobile screens while tester agents write tests against the original web app.
3. **Gatekeeper:** plain code runs type checks and the tests, and only promotes screens that pass.
4. **Report:** every screen ends as *proven*, *partially proven*, *unproven* or *failed*, with the reason.

Architecture details (in Serbian): [docs/architecture.md](docs/architecture.md).

## How Wemora uses Mozaik

*In progress:* parallel agents, the shared board (`MigrationState`), ID-only events, dynamic agent count with `join`/`leave`, `OwnershipGuard` interception.

## Quick start

Requirements: **Node 22.12+** and npm. On Windows, use Git Bash or PowerShell.

```bash
git clone https://github.com/milicaantic/wemora.git
cd wemora
npm ci
npx playwright install chromium   # browser for the UI tests
npm run build                     # type check + layer rules
npm test                          # unit tests, no network, no API key
```

### Run the example apps

Wemora ships two input apps in [`examples/`](examples/):

| App | What it is | Run |
|---|---|---|
| [Recepti](examples/recepti/) | 5 screens, built **for desktop only** on purpose (sidebar, wide table, side-by-side views, hover) | see below |
| [TodoMVC](examples/todomvc/) | the React TodoMVC from [tastejs/todomvc](https://github.com/tastejs/todomvc), unchanged, so Wemora is not tuned to our own example | `cd examples/todomvc && npm ci && npm run build && npm run serve` → http://localhost:7002 |

Recepti reads its data from a small mock API, so start that first:

```bash
# terminal 1
cd examples/mock-api
npm start                 # http://localhost:3000, no install needed

# terminal 2
cd examples/recepti
npm ci
npm run dev               # http://localhost:5173
```

## Verify a finished run (no API key)

*In progress:* `npm run verify -- runs/<run>` re-runs every test of a committed run with no AI and no API key. `npm run sabotage -- runs/<run> <unitId>` breaks one screen on purpose, and `verify` must then fail on that screen only.

## Run a full migration

*In progress:* `npm run migrate -- examples/recepti --budget 3` (needs `ANTHROPIC_API_KEY` in `.env`), or `npm run migrate:mock -- examples/todomvc` to run the whole flow with recorded model answers for $0.

## Output of a run

```
output/<run-id>/
  plan.json             migration plan from the architect
  analysis/             one report per analyzer
  tests/<screen>.json   validated tests, written by testers only
  staging/<builder>/    drafts; builders write only here
  app/                  the Expo app; only the Gatekeeper writes here
  results/<screen>.json gate and test results
  run.jsonl             every event with time and cost
  report.html           the report
```

## Limitations

*In progress.* Supported input: React 18/19 SPA with React Router 6/7 routes, plain CSS or CSS modules, hooks and Context, `fetch` and `localStorage`. Not supported: Next.js/SSR, Tailwind, CSS-in-JS, auth, native APIs, iOS, pixel comparison.

## Team

*In progress.*
