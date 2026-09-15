# ichiba

Ichiba — the marketplace. In V0, primary sales only; browsing needs no account (`REQ-MP-7`). Feature F-060.

Built from the Kippu specification and plan in `kippurocks/kippu-docs`: `SPEC.md`
decides behaviour, `PLAN.md` and `features/` decide how it is built. Work is
tracked as one issue per feature per milestone.

## What it is

A Next.js app (`AD-03`), rendered on the server. Ichiba never embeds the Ticketto
SDK: it reaches the ledger only through `kippu-api`.

- **API** — the Kippu API's tRPC router (contract `C5`), typed by `@kippu/api`
  and called from the server only (`src/server/kippu.ts`). The browser never
  calls the API. `KIPPU_API_URL` says where it is, read at request time; the
  default is `http://127.0.0.1:8080`.
- **No session to browse** — pages carry no session and set no cookies
  (`REQ-MP-7`). An account is needed only at the point of purchase.
- **No keys** — Ichiba holds no keys and signs nothing (`REQ-CL-4`).
- **Home page** — `/` is the public index of events on sale, rendered on the
  server for every request from `derived.events.onSale`: `Active` events with a
  `Purchased` class, most recently created first, 20 to a page, each linking to
  its event page. `?page=` carries the API's opaque token for the next page; a
  token the API refuses is the page-not-found screen.
- **Event pages** — `/events/<event id>` is rendered on the server for every
  request from `derived.events.get`: the event's ledger facts from Kippu's
  derived copy and its public document from the metadata origin, as one object
  (`AC-A3.2`). Zone kinds and status are ledger facts; names, venue, schedule,
  imagery and description come from the document. With no readable document the
  page still describes the event from its ledger facts. A `Cancelled` or
  `Finished` event says so and offers nothing for sale. An address naming no
  event is the page-not-found screen, with status 404.
- **Tickets** — an event page's tickets come from `sales.inventory`, read for
  every request: each `Purchased` class, labelled "Primary sale · sold by" the
  organiser (`REQ-MP-1`; resale labels will stand beside it), with how many are
  left counting outstanding holds (`REQ-HD-3`), and each seated zone's free
  seats. The count is a snapshot for display: the hold decides.
- **Seats** — `/events/<event id>/zones/<zone id>/seats` picks a seat in a seated
  zone (`US-B5`): the organiser's seat maps from the event's document, and a
  choice among the zone's free seats only — canonical, neither issued nor held.
  Choosing submits to the server, which checks the seat against the seats free
  at that moment. A held, issued or non-canonical seat asked for is refused with
  a reason (`AC-B5.2`), and never selected. Selecting holds nothing: checkout
  does.
- **Copy** — no fee, gas, top-up, funding or balance language (`REQ-SP-1a`), and
  no trustless, tamper-proof or decentralised claims (`REQ-TM-2`).
  `pnpm lint:copy` checks every user-visible string in `src/`, on whole words.
- **Health** — `GET /health` answers `ok` while Ichiba's server can reach the
  Kippu API, and `503` otherwise.

## Screens

Every screen has a stable `screenId`, carried in the rendered tree as
`data-screen`, and `screens.json` lists them all with their routes, titles and
the screens each can navigate to (`F-070` plan §5.4, format `kippu.screens/1`).
`kippu-e2e` merges it into the navigation map.

- **The registry** in `src/screens/registry.ts` names each screen's id, title,
  route and chrome. Routes are the app router's, with `:name` for a dynamic
  segment: `src/app/events/[event]/page.tsx` is `/events/:event`. A route with
  several steps declares one screen per step. Ids name what the screen is for,
  as `area.subject.step`, never copy or indices, and are not renamed once used.
- **Every screen renders inside `<Screen id>`**, with the id as a string literal,
  in a file under `src/app/`. The route of that file is checked against the
  registry, and every route renders at least one screen.
- **Every navigation declares its edge**, naming both screens literally:
  `<ScreenLink from to params>` for links, `navigate(from, to, params)` to
  redirect from server code, and `transition(from, to)` where the screen changes
  without the router — a step in a flow, or a handoff to Saifu, written
  `saifu:<screenId>`. `from` may be a chrome, such as `chrome:site` for the site
  header, whose edges belong to every screen inside it.
- **`pnpm screens:write`** regenerates `screens.json`. **`pnpm screens:check`**
  (CI) fails when it is out of date, when a route renders no screen id, when a
  screen is rendered at a route the registry does not give it, when a navigation
  names a screen non-literally or one the registry lacks, and when anything
  navigates around the declarations: an `<a href>`, next/link's `<Link>`,
  `redirect`, `useRouter`, `window.location`, or `hrefOf` outside `src/screens/`.
- **`e2e/screens.spec.ts`** walks Ichiba through every screen in `screens.json`,
  and fails if a step shows no `data-screen`, more than one, or one not in the
  manifest; if a transition taken is not declared; or if any manifest screen is
  never reached.

## Development

Requires Node 24 or later, pnpm (the version is pinned in `package.json`), and
Docker for the local test API's store and metadata storage.

```sh
pnpm install
pnpm lint        # Biome
pnpm lint:copy   # no fee vocabulary or trust claims in user-visible strings
pnpm typecheck   # TypeScript, over the whole repository
pnpm test        # Vitest
pnpm screens:check  # screens.json matches the registry, the routes and the declared navigation
pnpm build       # the production build, in .next/
pnpm start       # serves the production build on http://localhost:3000
pnpm test-api    # runs kippu-api on 127.0.0.1:8080 (see below)
pnpm dev         # the development server on http://localhost:3000
pnpm e2e         # Playwright: the production build, against the test API
```

`next build` does not type-check: `pnpm typecheck` does, with the repository's
TypeScript, locally and in CI.

### The preview

No hosting is chosen, and none is created. CI's preview is the production build
served by `next start` inside the end-to-end job, which Playwright drives against
the test API. Where Ichiba will be hosted, and how it reaches `kippu-api` there,
is a decision that has not been taken; nothing but `KIPPU_API_URL` should need to
change.

### `@kippu/api`

`@kippu/api` is not published to a registry. It is vendored as a `pnpm pack`
tarball from a pinned `kippu-api` commit (`vendor/kippu-api/`):
`pnpm vendor:kippu-api <commit>` re-pins it, and `pnpm vendor:check` (run in CI)
rebuilds it at the recorded commit and fails if it differs.

### The test API

`tools/test-api.sh` runs the real kippu-api server at the same recorded commit,
built once into `.test-api/`, so the end-to-end tests exercise the server whose
types Ichiba compiles against.

- **Ledger** — kippu-api's development wiring
  (`KIPPU_LEDGER_ENVIRONMENT=development`): `backend-memory`, a software KMS for
  organiser keys and a development sponsor, all in the server's memory and lost
  when it exits.
- **Store** — PostgreSQL. CI passes `KIPPU_DATABASE_URL` for a service
  container. Locally, without it, the script starts kippu-api's own compose
  store and recreates an `ichiba_e2e` database there on every start.
- **Metadata storage** — MinIO, an S3-compatible stand-in: CI runs the image
  kippu-api's CI pins by digest. Locally, without the `KIPPU_METADATA_S3_*` keys,
  kippu-api's compose file runs it. `KIPPU_METADATA_PUBLIC_URL` defaults to
  `https://meta.kippu.rocks`, the origin locators name (`AD-22`); no object
  store, CDN or DNS record exists for it yet.
- **Login relying party** — `KIPPU_LOGIN_RP_ID` defaults to `localhost` and
  `KIPPU_LOGIN_ORIGINS` to `http://localhost:3000`, so tests can sign up the
  organisers whose events they browse. Ichiba itself signs nobody in.
- **Saifu stand-in** — placing a hold needs a holder session, which Saifu opens
  by proving control of a credential registered on the ledger. The development
  wiring's ledger lives inside kippu-api's process, where no other process can
  register one, so `e2e/support/saifu.ts` writes a holder session straight into
  the test API's store (`F-060` plan §7, "a Saifu handoff stub"). Test data only;
  Ichiba itself never holds a holder session.
- **Port** — `KIPPU_API_PORT` moves the test API off `8080` when that port is in
  use locally; Playwright passes the matching `KIPPU_API_URL` to Ichiba.
