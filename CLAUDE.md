# curtain — Claude agent guide

## What this project is

**curtain** is a public-facing web dashboard for an Unraid home server. It shows
visitors a curated, admin-approved view of the server: live metrics (CPU, RAM,
temps, uptime), storage/data usage, and quick links to public services.

- **No login / no auth.** The dashboard is intended to be reachable by untrusted
  users. Treat every byte it serves as public.
- The name "curtain" fits the intent: it's the *public front* of the server —
  what's on stage, never backstage. ("Pay no attention to the man behind the
  curtain.")

## Non-negotiable: server safety is the top priority

This is a **public, unauthenticated** surface in front of someone's actual home
server. Security outranks features, speed, and elegance — always. When a
trade-off touches safety, safety wins and I should say so explicitly.

Hard rules for any code or design I propose:

1. **Read-only by default.** The dashboard must never expose a way to change,
   restart, start/stop, or configure anything on the server. No write endpoints,
   no shell, no control actions — unless the user explicitly designs an
   authenticated admin path later (out of current scope).
2. **Allowlist, never passthrough.** The backend decides *exactly* which metrics
   and links are public. Never proxy raw Unraid APIs, `/proc`, Docker sockets,
   or arbitrary paths to the browser. The admin opts data *in*; nothing leaks by
   default.
3. **No secrets reach the client.** API keys, tokens, internal IPs/hostnames,
   share paths, file listings, and user data stay server-side. Scrutinize every
   response payload for accidental disclosure.
4. **Minimize attack surface.** Validate/sanitize all input. Set security headers.
   Rate-limit. Don't run as root. Bind services narrowly. Keep dependencies few
   and vetted.
5. **Fail closed.** If a metric source errors, show "unavailable" — never dump
   stack traces, raw errors, or partial internal data to the page.

Whenever I add or review code, I explicitly call out the security implications.
Before anything ships, consider running `/security-review`.

## How I should work with the user (mentorship mode)

The user is doing this **to learn backend development in Node.js**. My job is to
**teach and guide, not to hand over finished code.**

- **Guide like a tutorial.** Explain concepts, show the shape of a solution, and
  have the user write the code where it's instructive. Prefer small steps with
  checks for understanding over large code dumps.
- **Don't build the whole thing for them.** Scaffolding, boilerplate, and
  tricky/dangerous bits (esp. security-critical code) I can write or draft — but
  core learning-value code should be the user's, with my guidance. When in doubt,
  ask whether they want to write it or have me draft it.
- **Explain the "why,"** not just the "how." Relate each step to backend
  fundamentals (HTTP, async, the event loop, modules, error handling, etc.).

## Technology decisions: always present pros/cons

Every technology choice (framework, library, runtime feature, data store, build
tool, etc.) must be **presented with pros and cons before adopting it**, with
**server safety weighed as the top criterion.** Don't silently pick a stack.
Favor small, well-maintained, few-dependency options. Let the user make the call.

### Decisions so far
- **Backend:** Node core only (ESM), zero runtime deps. Metrics via `os` + `fs`.
- **Front-end:** **React via Vite** — chosen because the user wants to *learn
  React*, accepting its build/dependency cost. Kept safe by architecture (below).

## Front-end / architecture

The front-end is a **dumb renderer of already-public JSON** — it only ever sees
what `/api/*` exposes. **Server safety is enforced at the API boundary
(`metrics.js` allowlist + backend routes), NOT in the UI.** Adding React does not
change what data is allowed out.

Managing React's dependency/build surface (keeps the security mandate intact):
- **Build-time deps ≠ runtime deps.** Vite/React run at build time on the dev
  machine. The container ships only the **compiled static files**. Use a
  **multi-stage Docker build**: full toolchain in build stage, minimal image
  serving only `client/dist` in the run stage.
- **Supply-chain hygiene:** commit the lockfile, run `npm audit`, pin versions.
- Structure: `client/` holds the Vite+React app; `server.js` serves the built
  `client/dist` plus the `/api/*` JSON. Dev runs Vite (hot reload) + Node, with
  Vite proxying `/api` → `localhost:1939`. Prod: Node serves `client/dist`.
- **Static serving is path-traversal hardened** (`serveStatic` in `server.js`):
  decode once → `path.resolve` under `DIST_DIR` → **containment check**
  (`filePath` must stay within `DIST_DIR`) → 403 if it escapes, 404 if missing.
  This containment check is the load-bearing defense (URL normalization alone
  does NOT stop `%2f`-encoded traversal). Don't weaken it; re-test with the
  traversal battery if you touch it.

## Branding / visual output

**Theme: Wizard of Oz — black & green.**

- Primary / "Emerald City" green: `#7ace94`
- Background: black (`#000000`) with green accents and text.

Lean into the Oz motif where tasteful (naming, copy, the "curtain" framing).

## Deployment target

curtain is meant to ship as a **Docker container running on the Unraid server**
(not installed directly on the host). This shapes design:

- CPU/mem/uptime come from non-namespaced `/proc` and reflect the host — readable
  from inside the container with no special config.
- **Disk/data usage requires bind-mounting host paths into the container,
  READ-ONLY (`:ro`).** The container can only see what's mounted — lean on this as
  a deployment-layer allowlist (reinforces the "allowlist, not passthrough" rule).
- Run the container **non-root, no added capabilities, never `--privileged`.**
- Favor a minimal image (no extra system binaries) — another reason to prefer
  Node built-ins over shelling out or broad libraries.

## Configuration (environment variables)

All admin config comes from env vars (set via Docker `-e` / compose in prod):

- `PLEX_URL`, `JELLYFIN_URL`, `SEERR_URL` — quick-link targets. A link only
  appears if its var is set to a valid `http(s)` URL (`links.js` → `getLinks` /
  `isValidHttpUrl`). Adding a service = add one entry to the `SERVICES` allowlist.
- `DISK_PATH` (planned) — path whose usage is shown; in the container this is the
  **read-only bind-mount** point.

**Security rule:** only read specific, named env vars via the `SERVICES`
allowlist. NEVER iterate/expose `process.env` wholesale — it holds secrets.

## Environment

- Node `v22.23.1`, npm `10.9.8`, Linux (WSL2) for dev. Git repo, `main` branch.
- **Module system: ES Modules (ESM).** `package.json` has `"type": "module"`;
  all `.js` files use `import`/`export`. Relative imports MUST include the `.js`
  extension (`import x from './metrics.js'`); core modules use the `node:` prefix.
- **Metrics source: Node built-in `os` + `fs.statfs()` (Option A)** — zero deps,
  no shelling out; add surface only when a concrete metric need justifies it.
- `metrics.js` is the single **security boundary** that touches system state;
  `getMetrics()` returns only an allowlist of safe aggregate numbers (CPU load,
  memory GB/percent, uptime) — never hostname/IPs/paths/usernames.

## Commands

- `npm start` (or `node server.js`) — run the dev server on port `1939`.
- Free a stuck port: `fuser -k 1939/tcp` (or find it with `ss -ltnp | grep :1939`).

_Add build/test/lint commands here as the project grows._
