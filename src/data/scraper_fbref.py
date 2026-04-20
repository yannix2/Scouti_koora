import nodriver as uc
import asyncio
import sys
import pandas as pd
from datetime import datetime
from pathlib import Path
import io
from bs4 import BeautifulSoup, Comment

# ─────────────────────────────
# WINDOWS FIX
# ─────────────────────────────
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# ─────────────────────────────
# CONFIG
# ─────────────────────────────
ROOT        = Path(__file__).resolve().parents[2]
DATA_DIR    = ROOT / "data" / "scraped"
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
INJURY_TABLE_ID = "stats_playing_time"
# ── Stat types → (url_endpoint, exact_table_id_on_fbref) ──
# FBref table IDs are fixed — this was the bug in the original code.
# "stats_stats" does not exist. The correct IDs are listed below.
STATS = {
    "standard":    ("stats",        "stats_standard"),
    "shooting":    ("shooting",     "stats_shooting"),
    "passing":     ("passing",      "stats_passing"),
    "defense":     ("defense",      "stats_defense"),
    "possession":  ("possession",   "stats_possession"),   # ← NEW: dribbles, carries, progressive
    "misc":        ("misc",         "stats_misc"),         # ← NEW: fouls, aerials, recoveries
    "gca":         ("gca",          "stats_gca"),
    "playing_time": ("playing_time", "stats_playing_time"),

}

# ─────────────────────────────
# HELPERS
# ─────────────────────────────
def flatten(df):
    """Flatten multi-level FBref column headers into single strings."""
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
    """Remove FBref repeated header rows and empty rows."""
    if "Player" in df.columns:
        df = df[df["Player"].notna()]
        df = df[df["Player"] != "Player"]
        df = df[df["Player"] != ""]
    if "Rk" in df.columns:
        df = df[df["Rk"] != "Rk"]
    return df.reset_index(drop=True)


def extract_table(html, table_id):
    """
    Extract a table by its HTML id from FBref page.
    FBref often wraps tables in HTML comments to lazy-load them —
    we search both the live DOM and inside comments.
    """
    soup = BeautifulSoup(html, "html.parser")

    # 1. Direct search in live DOM
    table = soup.find("table", {"id": table_id})
    if table:
        return pd.read_html(io.StringIO(str(table)), header=[0, 1])[0]

    # 2. Search inside HTML comments (FBref lazy-loads tables this way)
    comments = soup.find_all(string=lambda text: isinstance(text, Comment))
    for c in comments:
        if table_id in c:
            comment_soup = BeautifulSoup(c, "html.parser")
            table = comment_soup.find("table", {"id": table_id})
            if table:
                return pd.read_html(io.StringIO(str(table)), header=[0, 1])[0]

    return None


# ─────────────────────────────
# BROWSER HELPERS
# ─────────────────────────────
async def fetch(tab, url):
    tab = await tab.get(url)
    await tab.sleep(4)
    return tab


async def get_html(tab):
    return await tab.get_content()


# ─────────────────────────────
# URL BUILDERS
# ─────────────────────────────
def build_stat_urls(comp_id, slug, season, endpoint):
    """Two URL formats FBref uses — try both."""
    return [
        f"https://fbref.com/en/comps/{comp_id}/{season}/{endpoint}/{season}-{slug}-Stats",
        f"https://fbref.com/en/comps/{comp_id}/{endpoint}/{slug}-Stats",
    ]


def build_wage_urls(comp_id, slug, season):
    return [
        f"https://fbref.com/en/comps/{comp_id}/{season}/wages/{season}-{slug}-Wages",
        f"https://fbref.com/en/comps/{comp_id}/wages/{slug}-Wages",
    ]


# ─────────────────────────────
# SCRAPE STATS
# ─────────────────────────────
async def scrape_stats(tab, league_name, comp_id, slug, season):
    print(f"\n🏆 {league_name} | 📅 {season}")
    all_dfs = []

    for stat_name, (endpoint, table_id) in STATS.items():
        urls = build_stat_urls(comp_id, slug, season, endpoint)
        df   = None

        for url in urls:
            print(f"  📊 {stat_name:12s} → {url}")
            tab  = await fetch(tab, url)
            html = await get_html(tab)

            # Use the exact known table_id first, then fallbacks
            fallback_ids = [
                table_id,                           # correct ID e.g. "stats_passing"
                f"stats_{stat_name}",               # alternative pattern
                "stats_standard",                   # last resort for standard-only pages
            ]

            for tid in fallback_ids:
                df = extract_table(html, tid)
                if df is not None:
                    print(f"     ✅ table found: #{tid}")
                    break

            if df is not None:
                break
            else:
                print(f"     ⚠️  not found, trying next URL")

        if df is None:
            print(f"     ❌ {stat_name} — no data for {league_name} {season}")
            continue

        df = flatten(df)
        df = clean(df)

        # Tag metadata
        df["level"]     = "player" if "Player" in df.columns else "squad"
        df["league"]    = league_name
        df["season"]    = season
        df["stat_type"] = stat_name

        print(f"     📦 {len(df):,} rows | {len(df.columns)} cols")
        all_dfs.append(df)

    if not all_dfs:
        return None

    return pd.concat(all_dfs, ignore_index=True)


# ─────────────────────────────
# SCRAPE WAGES
# ─────────────────────────────
async def scrape_wages(tab, league_name, comp_id, slug, season):
    urls = build_wage_urls(comp_id, slug, season)

    for url in urls:
        print(f"  💰 wages → {url}")
        tab  = await fetch(tab, url)
        html = await get_html(tab)

        squad_df  = extract_table(html, "squad_wages")
        player_df = extract_table(html, "player_wages")

        if squad_df is not None or player_df is not None:
            dfs = []

            if squad_df is not None:
                squad_df = flatten(squad_df)
                squad_df["type"]   = "squad"
                squad_df["league"] = league_name
                squad_df["season"] = season
                dfs.append(squad_df)
                print(f"     ✅ squad wages: {len(squad_df):,} rows")

            if player_df is not None:
                player_df = flatten(player_df)
                player_df["type"]   = "player"
                player_df["league"] = league_name
                player_df["season"] = season
                dfs.append(player_df)
                print(f"     ✅ player wages: {len(player_df):,} rows")

            return pd.concat(dfs, ignore_index=True)

    print(f"     ❌ wages not found for {league_name} {season}")
    return None


# ─────────────────────────────
# CHECKPOINT SYSTEM
# ─────────────────────────────
import json

CHECKPOINT = DATA_DIR / "checkpoint.json"

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
# MAIN
# ─────────────────────────────
async def run():
    cp = load_checkpoint()
    already = len(cp["done"])
    total   = len(LEAGUES) * len(SEASONS)
    print(f"📋 Checkpoint: {already} / {total * (len(STATS) + 1)} tasks done")

    browser = await uc.start(
        headless=False,
        user_data_dir=PROFILE_PATH,
        browser_args=["--start-maximized"],
    )

    tab = await browser.get("https://fbref.com/en/")

    print("\n" + "="*55)
    print("  👀 LOOK AT THE CHROME WINDOW")
    print("  Solve CAPTCHA if shown, wait for FBref homepage")
    print("  Then press ENTER here to start scraping")
    print("="*55)
    input()

    all_stats = []
    all_wages = []

    # Load existing saved data
    stats_path = DATA_DIR / "ALL_STATS.csv"
    wages_path = DATA_DIR / "ALL_WAGES.csv"
    if stats_path.exists():
        all_stats.append(pd.read_csv(stats_path, low_memory=False))
        print(f"📂 Loaded existing ALL_STATS: {len(all_stats[0]):,} rows")
    if wages_path.exists():
        all_wages.append(pd.read_csv(wages_path, low_memory=False))
        print(f"📂 Loaded existing ALL_WAGES: {len(all_wages[0]):,} rows")

    for league, info in LEAGUES.items():
        for season in SEASONS:

            # ── Stats ──────────────────────────────────
            stats_key = f"stats_{league}_{season}"
            if stats_key in cp["done"]:
                print(f"⏭️  Skipping stats {league} {season} (already done)")
            else:
                stats_df = await scrape_stats(
                    tab, league, info["id"], info["slug"], season
                )
                if stats_df is not None:
                    all_stats.append(stats_df)
                    # Save incrementally after every league+season
                    full = pd.concat(all_stats, ignore_index=True)
                    full.to_csv(stats_path, index=False)
                    print(f"  💾 ALL_STATS saved: {len(full):,} rows total")
                save_checkpoint(stats_key, cp)

            # ── Wages ──────────────────────────────────
            wages_key = f"wages_{league}_{season}"
            if wages_key in cp["done"]:
                print(f"⏭️  Skipping wages {league} {season} (already done)")
            else:
                wages_df = await scrape_wages(
                    tab, league, info["id"], info["slug"], season
                )
                if wages_df is not None:
                    all_wages.append(wages_df)
                    full_w = pd.concat(all_wages, ignore_index=True)
                    full_w.to_csv(wages_path, index=False)
                    print(f"  💾 ALL_WAGES saved: {len(full_w):,} rows total")
                save_checkpoint(wages_key, cp)

    # ── Final save ─────────────────────────────────────
    print("\n" + "="*55)
    print("  ✅ SCRAPING COMPLETE")
    print("="*55)

    if all_stats:
        final_stats = pd.concat(all_stats, ignore_index=True)
        # Deduplicate
        dedup_keys = ["Player", "Squad", "league", "season", "stat_type"]
        dedup_keys = [k for k in dedup_keys if k in final_stats.columns]
        final_stats = final_stats.drop_duplicates(subset=dedup_keys, keep="last")
        final_stats.to_csv(stats_path, index=False)
        print(f"  📊 ALL_STATS  → {len(final_stats):,} rows × {len(final_stats.columns)} cols")
        print(f"     Stat types: {sorted(final_stats['stat_type'].unique())}")
        print(f"     Seasons:    {sorted(final_stats['season'].unique())}")
        print(f"     Leagues:    {sorted(final_stats['league'].unique())}")

    if all_wages:
        final_wages = pd.concat(all_wages, ignore_index=True)
        final_wages = final_wages.drop_duplicates(keep="last")
        final_wages.to_csv(wages_path, index=False)
        print(f"  💰 ALL_WAGES  → {len(final_wages):,} rows")

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(run())