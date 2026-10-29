---
version: 1
slug: "frontend-app-locale-page-tsx"
primary_target: "frontend/app/[locale]/page.tsx"
related_targets: ["frontend/app/[locale]/layout.tsx"]
---

# Surface: Scout desk (home) and app shell

Mode: Operate. This surface sets the tone for every other screen: player report, discover, compare and my scouting.
Audience/job: scouts, agents and club recruiters start a session here. They search a name, or spot trending players and hidden gems, then jump to the player report.
Constraints: EN/FR/AR with full RTL. Light (desk, daytime) and dark (floodlit, match nights) are both first-class. Avoid: generic SaaS gray, neon AI, betting-site look, game cards. No player photos exist. Coverage stated honestly: 4,817 players, Big 5, 2020–25.
Memorable moment: the pitch lines draw themselves, and hovering any player row lights their spot on the pitch. User asked for "smooth and animated": an orchestrated entrance, spring layout transitions on expand/filter, smooth theme and route changes.
Unresolved: final tokens are tuned at build. Arabic numerals use Western digits (0–9) unless the user asks otherwise.

## Direction contract

THESIS: The desk is a freshly marked pitch, and every player is placed in their zone. It refuses the gray card-grid dashboard with a green accent.

OWN-WORLD:
- **Palette:** deep turf `#123D2B` shell rail; chalk `#F2F4EC` ground; ink `#13201A`; mown two-tone stripe banding on rows; corner-flag red `#D9483B` reserved for risk and alerts. Night mode is the same pitch under floodlight: turf-black ground, chalk lines.
- **Colour:** flat fills, with no gradients, glow or glass. 1.5px chalk-line rules and arcs. User decision (2026-10-28): soft layered turf-tinted shadows (offset + blur) give elevation to panels, focused rows and overlays, built with shadcn/ui.
- **Type:** one family across all levels (Alexandria, Latin + Arabic; replaced Readex Pro at build because it has no tabular figures). Tabular figures everywhere.

STORY: The scout sees the whole pool laid out by position and understands where the talent sits. They search or click a dot or row, then land on the report.

FIRST VIEWPORT:
- **Left:** turf rail nav.
- **Centre (about 60%):** a chalk-lined pitch, with search in the centre circle as the primary action, and trending players and gems as dots in their zones.
- **Right:** ranked table with stripe banding and a coverage note.

FORM: Marked Pitch, grounded candidate 3 of 7, seed aedb4ad1. Raises:
- centre-rail Compare (from centre-rail setting);
- flat colour (from guide map);
- focus-row reveal of the three stats behind a score (from catalog wall);
- tabular figures (from datamatics);
- one family (from design annual).
Signature: chalk-line draw. Lines are laid like a line-marking machine (stroke draw, under 600ms, once per view, honouring reduced-motion), and row hover lights the player's pitch spot.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
