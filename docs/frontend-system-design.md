# ScoutiKoora Frontend: System Design (MVP)

Status: **draft for approval**. No code has been written yet. Product truth lives in `PRODUCT.md`, and the visual direction is chosen in a separate step after this design is approved.

---

## 1. Goals and non-goals

**Goals**
- Fast, modern, football-themed scouting app built with Next.js (React).
- Covers every MVP area: search + player report, discovery (similar / recommend / hidden gems), compare, and account + my scouting.
- Trilingual: English, French and Arabic (full RTL).
- Structured so more screens, leagues and features can be added without rework.
- Runs locally on `localhost:3000` against the FastAPI gateway on `:8000`.

**Non-goals (MVP)**
- Deployment, payments and pricing pages.
- A marketing landing page. The home page is the product itself.
- Player photos or club crests: no asset source exists, so none are faked.
- PDF export.
- Admin tools.

---

## 2. Architecture

```
Browser
  │
  ▼
Next.js app (frontend/, :3000)
  ├── Server Components ──fetch──► FastAPI gateway :8000 (public data routes)
  ├── Route handlers /api/auth/* (BFF: sets/clears httpOnly cookies)
  └── Route handler /api/gw/[...path] ──► gateway, with Bearer from cookie
                                                (protected /scouting, /recommendations)
FastAPI gateway :8000 ──► player service :8001, similarity service :8002, Neon Postgres
```

Key decisions:

| Decision | Choice | Why |
|---|---|---|
| Framework | **Next.js, latest stable, App Router**, TypeScript strict | Server Components render the player report fast. Each route is its own page, so the app scales by adding routes. |
| Location | `frontend/` at repo root | Matches AGENTS.md. Kept separate from the Python code. |
| Styling | **Tailwind CSS v4** with design tokens as CSS variables | Tokens are set in the visual-direction step. Logical properties (`ms-`/`me-`, `start`/`end`) make RTL work automatically. |
| Components | **Radix primitives via shadcn/ui** (owned source) + selected **21st.dev** components, all restyled to the chosen visual world | Accessible dialogs, menus, tabs and combobox out of the box. 21st.dev provides richer blocks (command palette, data tables, cards). |
| Data fetching | Public reads: **Server Components** with `fetch` + revalidate. Interactive reads/writes: **TanStack Query** | Reports and lists render on the server; autocomplete, filters and shortlist mutations get caching and optimistic updates. |
| URL state | **nuqs** (typed search params) | Discover filters and compare pairs live in the URL, so they can be shared and the back button works. |
| Validation | **zod** schemas for every gateway response | Gateway responses are untyped dicts. Parsing at the edge catches field-name drift, e.g. `"Market Value"` vs `market_value_eur`. |
| Auth | **BFF with httpOnly cookies** | Login/register/refresh go through Next route handlers that store the JWTs in httpOnly cookies, so client JS never sees the tokens. A proxy route attaches the Bearer token to protected calls, and `middleware.ts` refreshes it silently on 401. |
| i18n | **next-intl** with a `[locale]` segment (`/en`, `/fr`, `/ar`) | Sets `<html lang dir>`. Messages are stored in `messages/{en,fr,ar}.json`. Numbers and currency are formatted with `Intl` per locale. |
| Charts | **Recharts** (radar, bars), each with a text/table equivalent | Mirrors in RTL and is light enough for the MVP. |
| Motion | **Motion** (Framer Motion), respecting `prefers-reduced-motion` | Used for smooth route and list transitions. |
| Quality | ESLint + Prettier + `tsc --noEmit`, plus **Playwright** smoke tests | The repo has none of these today. Smoke tests cover the five critical flows (§8). |

---

## 3. Information architecture

Every route is prefixed with `/[locale]`. Player identity is the **name**, because the backend has no player IDs: `/players/erling-haaland` encodes as a slug, and the full name is sent to the API.

| Route | Purpose | Data (gateway) | Auth |
|---|---|---|---|
| `/` | **Scout desk**: big search, trending, hidden-gem picks, coverage note (4,817 players · Big 5 · 2020–25) | `/players?q`, `/recommendations/trending`*, `/hidden-gems` | public (*trending needs auth today, see §7) |
| `/players/[slug]` | **Player report**: verdict, radar + 5 categories, strengths/weaknesses, value vs peak, injury risk, key per-90 stats, style label, similar players rail | `/report/{name}`, `/radar/{name}`, `/players/{name}`, `/similar/{name}` | public; save/list actions need auth |
| `/discover` | Tabs: **Recommend** (position, style, budget, age, leagues, minutes) · **Hidden gems** · **Plays like…** (pick a reference player) | `/recommend`, `/hidden-gems`, `/styles`, `/similar/{name}` | public |
| `/compare?a=&b=` | Side by side: overlaid radars, stat diff bars, verdicts | `/compare`, `/radar/{a}`, `/radar/{b}` | public |
| `/login`, `/register` | Email + password. Register includes a role (scout / agent / club) | `/auth/*` via BFF | none |
| `/scouting` | **My scouting**: personalized recs, saved players, my lists, recent history | `/recommendations/personalized`, `/scouting/saved`, `/scouting/lists`, `/scouting/history` | required |
| `/scouting/lists/[id]` | List detail: players, notes, public toggle, remove, compare any two | `/scouting/lists/{id}` (+ items CRUD) | required |

**Global UI**
- **Command palette** (⌘K / Ctrl+K, plus a search button on mobile): player autocomplete from any page, with a "Compare with…" action.
- **Shortlist tray**: quick save, and "Add to list" from any player card or row. Logged-out users get a sign-in prompt that returns them to where they were.
- **View tracking**: opening a player report fires `POST /scouting/track` when logged in. This feeds personalized recommendations.
- **Language switcher**: keeps the current route and search params.

**User flow:** search → report → (similar | compare | save) → list. Every discovery result is one click from save, compare or "plays like".

---

## 4. Frontend structure

```
frontend/
  app/
    [locale]/
      layout.tsx            # html lang/dir, fonts, providers, nav, command palette
      page.tsx              # scout desk
      players/[slug]/page.tsx (+ loading.tsx, not-found.tsx, opengraph-image.tsx)
      discover/page.tsx
      compare/page.tsx
      (auth)/login/page.tsx, register/page.tsx
      scouting/page.tsx, scouting/lists/[id]/page.tsx
    api/auth/[action]/route.ts   # login | register | refresh | logout | me
    api/gw/[...path]/route.ts    # authenticated proxy to gateway
  features/                       # feature-sliced: each owns its UI + queries + schemas
    player/  discover/  compare/  scouting/  auth/  search/
  components/ui/                  # restyled primitives (button, input, tabs, dialog, table…)
  lib/
    api/client.ts               # typed fetch wrapper, error mapping
    api/schemas.ts              # zod schemas per endpoint
    format.ts                   # € values, per-90 numbers, percentages (Intl, per-locale)
    slug.ts                     # name <-> slug
  i18n/ (routing, request config)   messages/en.json fr.json ar.json
  middleware.ts                   # locale detection + auth cookie refresh + /scouting guard
  styles/tokens.css               # design tokens (set by visual-direction step)
  tests/e2e/*.spec.ts             # Playwright smoke tests
```

To add a feature, create `features/<name>/` and a route. Nothing shared needs to change.

---

## 5. Data contracts and states

- Market value is formatted on the client from the raw `market_value_eur`. The gateway's preformatted `"Market Value"` string can't be localized, so it is not used for display (see §7).
- **Every data view has four designed states:** loading (skeleton), empty (with a next step), error (retry + message), and partial data. Missing stats show "—" plus a tooltip; they are never shown as 0.
- **Charts:** the radar comes with a hidden-by-default data table and an `aria-label` summary.
- **Players without photos** get a generated monogram badge: initials plus position colour. It is clearly not a photo.

---

## 6. Performance, SEO, accessibility

- **Rendering:**
  - The report page is server-rendered with `revalidate` of 1 hour, because the data changes only when notebooks are rerun.
  - Autocomplete is debounced (200 ms) with a minimum of 2 characters, matching the API.
- **SEO (seo-check skill):**
  - Every route gets its own `generateMetadata` and `hreflang` alternates for en/fr/ar.
  - Player pages get a generated OG image with stats and verdict.
  - No fabricated structured data.
- **Budgets:** LCP < 2.5 s on the report page locally, and a route JS budget of ~150 KB gz. Charts are loaded on the client only.
- **Accessibility:**
  - WCAG 2.2 AA contrast.
  - Every flow is keyboard-complete, including the palette, tabs and table sort.
  - Focus is visible.
  - RTL is checked on every screen.
  - Motion respects `prefers-reduced-motion`.

---

## 7. Backend issues found (needs your call)

Found while checking `/report/Erling Haaland` and the gateway code:

| # | Issue | Effect in UI | Proposed fix |
|---|---|---|---|
| B1 | `conversion_rate` scored against a max of 100 when the data appears to be a 0–1 fraction. Haaland gets **0.2/100**. | Elite finishers look terrible | Fix scale in gateway `_STAT_MAXES` after checking the data range |
| B2 | `value_score` = 0.1 for Haaland: `value_efficiency` is not on a 0–100 scale | "Value" bar is near zero for everyone | Same: rescale from the data's real range |
| B3 | Injury: 15 injuries but 0 days out, risk score 0 | Contradictory injury card | Check notebook join; frontend shows "days out unknown" meanwhile |
| B4 | `/recommendations/trending` requires login | Home page can't show trending for visitors | Make it public, or show it only when logged in |
| B5 | `"Market Value"` sent as a preformatted "€" string on some endpoints | Can't localize or sort | Gateway also returns raw `market_value_eur` |
| B6 | No player IDs. Names are matched with a fuzzy substring, first hit wins | Two players with similar names can collide | MVP uses name slugs; add a stable ID later |

Fixing B1/B2/B4/B5 is about 20 lines in `src/api/main.py` and the recommendations router. B3 needs a notebook check.

---

## 8. Definition of done (MVP)

1. All routes in §3 work in en, fr and ar. Arabic is fully mirrored.
2. Smoke tests pass for five flows:
   - search → report;
   - discover filter → save;
   - compare two players;
   - register → login → list CRUD;
   - personalized recommendations appear after viewing players.
3. `npm run build` and `tsc` pass. The detector and finish review are done, and DESIGN.md is written from the built UI.
4. Run with `cd frontend && npm install && npm run dev`, with `API_URL=http://localhost:8000` in `frontend/.env.local`.

---

## 9. Next step after approval: visual direction

Mode is **Operate** (app UI: scanning, comparing, deciding). The visual world (palette, type, component character, signature interaction) is chosen in a direction round. You pick from concrete directions drawn from football and scouting culture before any UI code is written. There is no image generation in this environment, so the build is code-first, with the ambition written into a direction contract and audited at the finish.
