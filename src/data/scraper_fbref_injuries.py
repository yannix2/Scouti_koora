"""
scraper_fbref_injuries.py — v5 FINAL
Key fixes:
  1. Unwraps nested dicts in JS array results (nodriver wraps every element)
  2. Clicks the "Players" tab on FBref pages that default to squad view
  3. Falls back to get_content() + BeautifulSoup (same method as working scraper)

Run: python src/data/scraper_fbref_injuries.py
"""

import nodriver as uc
import asyncio
import sys
import pandas as pd
import json
import io
from pathlib import Path
from bs4 import BeautifulSoup, Comment

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# ─────────────────────────────
# CONFIG
# ─────────────────────────────
ROOT     = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "scraped"
DATA_DIR.mkdir(parents=True, exist_ok=True)

PROFILE_PATH = r"C:\Users\Yassine\fbref_profile"

LEAGUES = {
    "EPL":        {"id": 9,  "slug": "Premier-League"},
    "LaLiga":     {"id": 12, "slug": "La-Liga"},
    "SerieA":     {"id": 11, "slug": "Serie-A"},
    "Bundesliga": {"id": 20, "slug": "Bundesliga"},
    "Ligue1":     {"id": 13, "slug": "Ligue-1"},
}

SEASONS = [
    "2020-2021",
    "2021-2022",
    "2022-2023",
    "2023-2024",
    "2024-2025",
]

CHECKPOINT = DATA_DIR / "checkpoint_fbref_injuries.json"

# ─────────────────────────────
# CHECKPOINT
# ─────────────────────────────
def load_checkpoint():
    if CHECKPOINT.exists():
        with open(CHECKPOINT) as f:
            return json.load(f)
    return {"done": []}

def save_checkpoint(key, cp):
    cp["done"].append(key)
    with open(CHECKPOINT, "w") as f:
        json.dump(cp, f, indent=2)

# ─────────────────────────────
# UNWRAP
# nodriver wraps EVERY JS value in a dict, including list elements.
# e.g. ["LIVE:x", "LIVE:y"] comes back as:
#   [{"type":"string","value":"LIVE:x"}, {"type":"string","value":"LIVE:y"}]
# deep_unwrap handles both the outer container and each inner element.
# ─────────────────────────────
def deep_unwrap(val):
    """Recursively unwrap nodriver JS result dicts to raw Python values."""
    if val is None:
        return None
    if isinstance(val, dict):
        # nodriver wraps results as {"type": "...", "value": ...}
        for k in ("value", "result"):
            if k in val:
                return deep_unwrap(val[k])
        return None
    if isinstance(val, list):
        return [deep_unwrap(item) for item in val]
    return val

# ─────────────────────────────
# TABLE HELPERS
# ─────────────────────────────
def flatten(df):
    new_cols = []
    for col in df.columns:
        if isinstance(col, tuple):
            parts = [str(p) for p in col if "Unnamed" not in str(p) and str(p).strip()]
            new_cols.append("_".join(parts) if parts else str(col[-1]))
        else:
            new_cols.append(str(col))
    df.columns = new_cols
    return df


def clean(df):
    if "Player" in df.columns:
        df = df[df["Player"].notna()]
        df = df[df["Player"] != "Player"]
        df = df[df["Player"] != ""]
    if "Rk" in df.columns:
        df = df[df["Rk"] != "Rk"]
    return df.reset_index(drop=True)


def extract_from_html(html, table_id):
    """
    Extract table by ID using BeautifulSoup.
    Checks both live DOM and HTML comments.
    This is the same method used in the working scraper_fbref.py.
    """
    s = BeautifulSoup(html, "html.parser")

    # 1. Live DOM
    table = s.find("table", {"id": table_id})
    if table:
        try:
            return pd.read_html(io.StringIO(str(table)), header=[0, 1])[0]
        except Exception:
            return pd.read_html(io.StringIO(str(table)))[0]

    # 2. HTML comments (FBref lazy-loads player tables in comments)
    for c in s.find_all(string=lambda t: isinstance(t, Comment)):
        if table_id in c:
            cs = BeautifulSoup(c, "html.parser")
            table = cs.find("table", {"id": table_id})
            if table:
                try:
                    return pd.read_html(io.StringIO(str(table)), header=[0, 1])[0]
                except Exception:
                    return pd.read_html(io.StringIO(str(table)))[0]

    return None


def find_all_table_ids(html):
    """Find all table IDs in live DOM and HTML comments."""
    s   = BeautifulSoup(html, "html.parser")
    ids = []

    # Live DOM
    for t in s.find_all("table", id=True):
        ids.append(f"LIVE:{t['id']}")

    # Comments
    for c in s.find_all(string=lambda t: isinstance(t, Comment)):
        cs = BeautifulSoup(c, "html.parser")
        for t in cs.find_all("table", id=True):
            ids.append(f"COMMENT:{t['id']}")

    return list(dict.fromkeys(ids))  # deduplicate preserving order


# ─────────────────────────────
# CLICK PLAYERS TAB
# FBref pages default to squad view.
# The "Players" toggle switches to player-level stats.
# ─────────────────────────────
async def click_players_tab(tab):
    """
    Try to click the Players tab/toggle on FBref pages
    that show squad stats by default.
    Returns True if clicked, False if not found.
    """
    # FBref uses anchor links or buttons to toggle player/squad view
    # Common selectors across different FBref page versions
    selectors = [
        "a[href*='#players']",
        "button[data-show='#div_stats_playing_time']",
        "#switcher_playing_time a",
        "a[href='#div_stats_playing_time']",
        ".filter.switcher a",
        "#content a.sr_preset",
    ]

    for sel in selectors:
        try:
            result = deep_unwrap(await tab.evaluate(f"""
                (function() {{
                    var el = document.querySelector('{sel}');
                    if (el) {{ el.click(); return true; }}
                    return false;
                }})()
            """))
            if result is True:
                await tab.sleep(2)
                print(f"     🖱️  Clicked tab: {sel}")
                return True
        except Exception:
            continue

    # Try clicking any link/button containing text "Players"
    try:
        result = deep_unwrap(await tab.evaluate("""
            (function() {
                var links = Array.from(document.querySelectorAll('a, button'));
                for (var l of links) {
                    if (l.textContent.trim() === 'Players') {
                        l.click();
                        return l.textContent.trim();
                    }
                }
                return null;
            })()
        """))
        if result:
            await tab.sleep(2)
            print(f"     🖱️  Clicked 'Players' element")
            return True
    except Exception:
        pass

    return False


# ─────────────────────────────
# SCRAPE ONE LEAGUE + SEASON
# ─────────────────────────────
async def scrape_playing_time(tab, league_name, comp_id, slug, season):
    target_id = "stats_playing_time"

    urls = [
        f"https://fbref.com/en/comps/{comp_id}/{season}/playing_time/{season}-{slug}-Stats",
        f"https://fbref.com/en/comps/{comp_id}/playing_time/{slug}-Stats",
    ]

    df = None

    for url in urls:
        print(f"  🔗 {url}")
        tab = await tab.get(url)
        await tab.sleep(4)

        # ── Try 1: get_content() + BeautifulSoup (same as working scraper) ──
        html  = await tab.get_content()
        ids   = find_all_table_ids(html)
        stats = [i for i in ids if "stats_" in i]
        print(f"     📋 Tables: {stats[:8]}")

        df = extract_from_html(html, target_id)
        if df is not None:
            print(f"     ✅ found #{target_id} via get_content()")
            break

        # ── Try 2: click Players tab, then re-read ───────────────────────
        clicked = await click_players_tab(tab)
        if clicked:
            html = await tab.get_content()
            ids2 = find_all_table_ids(html)
            print(f"     📋 After tab click: {[i for i in ids2 if 'stats_' in i][:8]}")
            df = extract_from_html(html, target_id)
            if df is not None:
                print(f"     ✅ found #{target_id} after tab click")
                break

        # ── Try 3: fallback — use any player-level table ─────────────────
        # Accept any table that has a Player column (player-level data)
        all_html = [html]
        s = BeautifulSoup(html, "html.parser")
        for c in s.find_all(string=lambda t: isinstance(t, Comment)):
            all_html.append(c)

        for chunk in all_html:
            cs = BeautifulSoup(chunk, "html.parser")
            for table in cs.find_all("table", id=True):
                tid = table.get("id", "")
                if not tid.startswith("stats_"):
                    continue
                try:
                    df_try = pd.read_html(io.StringIO(str(table)), header=[0, 1])[0]
                    df_flat = flatten(df_try.copy())
                    if "Player" in df_flat.columns and len(df_flat) > 5:
                        print(f"     ✅ fallback: #{tid}")
                        df = df_try
                        break
                except Exception:
                    continue
            if df is not None:
                break

        if df is not None:
            break

        print(f"     ❌ no player table — trying next URL")

    if df is None:
        print(f"     ❌ No data for {league_name} {season}")
        return None

    df = flatten(df)
    df = clean(df)
    df["league"]    = league_name
    df["season"]    = season
    df["stat_type"] = "playing_time"

    # ── Normalize column names ──────────────────────────
    col_map = {}
    for c in df.columns:
        cl = c.lower()
        if cl in ["mp", "playing time_mp"]:             col_map[c] = "games_played"
        elif cl in ["min", "playing time_min"]:         col_map[c] = "minutes_played"
        elif "min%" in cl:                              col_map[c] = "availability_pct"
        elif cl in ["starts", "playing time_starts"]:  col_map[c] = "starts"
        elif "compl" in cl:                             col_map[c] = "complete_games"
        elif cl == "subs":                              col_map[c] = "sub_appearances"
        elif "unsub" in cl:                             col_map[c] = "subbed_off"
        elif "ppm" in cl:                               col_map[c] = "points_per_match"
        elif "ong" in cl and "ga" not in cl:            col_map[c] = "goals_while_on"
        elif "onga" in cl:                              col_map[c] = "conceded_while_on"
        elif "+/-" in c and "90" not in c:              col_map[c] = "goal_diff_on_pitch"
        elif "+/-90" in c:                              col_map[c] = "goal_diff_per90"

    df.rename(columns=col_map, inplace=True)

    # ── Injury risk signal ──────────────────────────────
    if "availability_pct" in df.columns:
        df["availability_pct"] = pd.to_numeric(df["availability_pct"], errors="coerce")
        df["injury_risk"] = pd.cut(
            df["availability_pct"],
            bins=[0, 40, 60, 80, 100],
            labels=["high_risk", "medium_risk", "low_risk", "available"],
            right=True
        )

    if "games_played" in df.columns and "starts" in df.columns:
        gp = pd.to_numeric(df["games_played"], errors="coerce")
        st = pd.to_numeric(df["starts"],       errors="coerce")
        df["sub_ratio"] = ((gp - st) / gp.replace(0, pd.NA)).round(3)

    print(f"     📦 {len(df):,} players | {len(df.columns)} cols")
    return df


# ─────────────────────────────
# MAIN
# ─────────────────────────────
async def run():
    cp    = load_checkpoint()
    total = len(LEAGUES) * len(SEASONS)
    print(f"📋 Checkpoint: {len(cp['done'])} / {total} tasks done\n")

    browser = await uc.start(
        headless=False,
        user_data_dir=PROFILE_PATH,
        browser_args=["--start-maximized"],
    )

    tab = await browser.get("https://fbref.com/en/")

    print("=" * 55)
    print("  Solve CAPTCHA if shown, wait for FBref homepage")
    print("  Press ENTER when ready")
    print("=" * 55)
    input()

    all_dfs  = []
    out_path = DATA_DIR / "FBREF_PLAYING_TIME.csv"

    if out_path.exists():
        all_dfs.append(pd.read_csv(out_path, low_memory=False))
        print(f"📂 Loaded existing: {len(all_dfs[0]):,} rows\n")

    for league, info in LEAGUES.items():
        for season in SEASONS:
            key = f"{league}_{season}"
            if key in cp["done"]:
                print(f"⏭️  {league} {season} — done")
                continue

            print(f"\n🏆 {league} | 📅 {season}")
            df = await scrape_playing_time(
                tab, league, info["id"], info["slug"], season
            )

            if df is not None and not df.empty:
                all_dfs.append(df)
                combined = pd.concat(all_dfs, ignore_index=True)
                dedup = [c for c in ["Player","league","season"] if c in combined.columns]
                combined.drop_duplicates(subset=dedup, keep="last", inplace=True)
                combined.to_csv(out_path, index=False)
                print(f"  💾 saved: {len(combined):,} rows")

            save_checkpoint(key, cp)

    # ── Final report ─────────────────────────────────────
    print("\n" + "="*55)
    print("  ✅ COMPLETE")
    print("="*55)

    if out_path.exists():
        final = pd.read_csv(out_path, low_memory=False)
        print(f"  Rows: {len(final):,} | Cols: {len(final.columns)}")
        if "availability_pct" in final.columns:
            a = final["availability_pct"].dropna()
            print(f"  Availability: mean={a.mean():.1f}%  high risk={( a<50).sum():,}")
        if "injury_risk" in final.columns:
            print(final["injury_risk"].value_counts().to_string())

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(run())