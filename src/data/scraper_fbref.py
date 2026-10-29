import nodriver as uc
import asyncio
import sys
import pandas as pd
import json
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

PROFILE_PATH = r"C:\Users\Lenovo\fbref_profile"

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

# ── Stat types → (url_endpoint, exact_table_id, prefix_for_stat_cols)
# prefix: columns that are identity/shared → no prefix
#         columns that are stat-specific → use this prefix to avoid collisions
STATS = {
    "standard":     ("stats",        "stats_standard",    "std"),
    "shooting":     ("shooting",     "stats_shooting",    "sh"),
    "passing":      ("passing",      "stats_passing",     "pass"),
    "defense":      ("defense",      "stats_defense",     "def"),
    "possession":   ("possession",   "stats_possession",  "poss"),
    "misc":         ("misc",         "stats_misc",        "misc"),
    "gca":          ("gca",          "stats_gca",         "gca"),
}

# Identity columns shared across all stat types — never prefixed
IDENTITY_COLS = {
    "Rk", "Player", "Nation", "Pos", "Squad", "Age", "Born",
    "level", "league", "season", "stat_type",
    "Playing Time_MP", "Playing Time_Starts", "Playing Time_Min",
    "Playing Time_90s", "90s", "Matches",
}

# ─────────────────────────────
# COLUMN FLATTENING
# ─────────────────────────────
def flatten_columns(df, stat_prefix):
    """
    Flatten FBref multi-level headers into clean single strings.
    Applies stat_prefix to stat-specific columns to avoid collisions
    when concatenating all stat types.

    FBref column structure after pd.read_html(header=[0,1]):
      ('Unnamed: 0_level_0', 'Rk')       → 'Rk'         (identity)
      ('Performance', 'Gls')             → 'std_Gls'    (prefixed)
      ('Per 90 Minutes', 'Gls')          → 'std_p90_Gls'(prefixed)
      ('Total', 'Cmp')                   → 'pass_Cmp'   (prefixed)
    """
    new_cols = []
    for col in df.columns:
        if isinstance(col, tuple):
            top   = str(col[0])
            sub   = str(col[1]) if len(col) > 1 else ""
            # Strip 'Unnamed' markers
            top_clean = "" if "Unnamed" in top else top.strip()
            sub_clean = sub.strip()

            if top_clean:
                raw = f"{top_clean}_{sub_clean}" if sub_clean else top_clean
            else:
                raw = sub_clean

        else:
            raw = str(col).strip()

        # Check if this is an identity column (no prefix needed)
        if raw in IDENTITY_COLS or sub_clean in IDENTITY_COLS if isinstance(col, tuple) else raw in IDENTITY_COLS:
            new_cols.append(raw if raw in IDENTITY_COLS else (sub_clean if isinstance(col, tuple) and sub_clean in IDENTITY_COLS else f"{stat_prefix}_{raw}"))
        else:
            # Apply prefix to stat-specific columns
            new_cols.append(f"{stat_prefix}_{raw}" if raw not in IDENTITY_COLS else raw)

    df.columns = new_cols
    return df


def flatten_simple(df):
    """Simple flatten without prefix — for wages tables."""
    new_cols = []
    for col in df.columns:
        if isinstance(col, tuple):
            parts = [str(p) for p in col if "Unnamed" not in str(p) and str(p).strip()]
            new_cols.append("_".join(parts) if parts else str(col[-1]))
        else:
            new_cols.append(str(col).strip())
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


# ─────────────────────────────
# TABLE EXTRACTION
# ─────────────────────────────
def extract_table(html, table_id):
    """
    Extract a table by its HTML id from FBref page.
    FBref wraps tables in HTML comments — search both live DOM and comments.
    Tries lxml parser first (faster + more robust), falls back to html.parser.
    Returns raw DataFrame with MultiIndex columns (header=[0,1]).
    """
    def parse_table(table_tag):
        try:
            return pd.read_html(io.StringIO(str(table_tag)), header=[0, 1])[0]
        except Exception:
            try:
                return pd.read_html(io.StringIO(str(table_tag)), header=[0])[0]
            except Exception:
                return None

    def search_in_html(raw_html, parser="lxml"):
        try:
            soup = BeautifulSoup(raw_html, parser)
        except Exception:
            soup = BeautifulSoup(raw_html, "html.parser")

        # 1. Direct search in live DOM
        table = soup.find("table", {"id": table_id})
        if table:
            return parse_table(table)

        # 2. Search inside HTML comments (FBref lazy-loads tables this way)
        comments = soup.find_all(string=lambda text: isinstance(text, Comment))
        for c in comments:
            if table_id in c:
                comment_soup = BeautifulSoup(c, parser)
                table = comment_soup.find("table", {"id": table_id})
                if table:
                    return parse_table(table)

        return None

    # Try lxml first (more robust with malformed HTML)
    result = search_in_html(html, "lxml")
    if result is not None:
        return result

    # Fallback: html.parser
    result = search_in_html(html, "html.parser")
    if result is not None:
        return result

    # Last resort: regex extraction of the table block
    import re
    pattern = rf'<table[^>]*id=.{table_id}.[^>]*>(.*?)</table>'
    match = re.search(pattern, html, re.DOTALL | re.IGNORECASE)
    if match:
        table_html = '<table id="' + table_id + '">' + match.group(1) + '</table>'  
        try:
            return pd.read_html(io.StringIO(table_html), header=[0, 1])[0]
        except Exception:
            try:
                return pd.read_html(io.StringIO(table_html), header=[0])[0]
            except Exception:
                pass

    return None


def extract_wages_table(html, table_id):
    """
    Extract wages table with single-level header (FBref wages use header=[0]).
    Wages tables do NOT have a multi-level header.
    """
    soup = BeautifulSoup(html, "html.parser")

    def parse_wages(table_tag):
        try:
            return pd.read_html(io.StringIO(str(table_tag)), header=[0])[0]
        except Exception:
            return None

    table = soup.find("table", {"id": table_id})
    if table:
        return parse_wages(table)

    comments = soup.find_all(string=lambda text: isinstance(text, Comment))
    for c in comments:
        if table_id in c:
            comment_soup = BeautifulSoup(c, "html.parser")
            table = comment_soup.find("table", {"id": table_id})
            if table:
                return parse_wages(table)

    return None


# ─────────────────────────────
# BROWSER HELPERS
# ─────────────────────────────
async def fetch(tab, url):
    tab = await tab.get(url)
    await tab.sleep(8)
    return tab


async def get_html(tab):
    """Get full rendered HTML via JS — more reliable than get_content()."""
    await tab.sleep(2)
    try:
        html = await tab.evaluate("document.documentElement.outerHTML")
        if html and len(html) > 5000:
            return html
    except Exception:
        pass
    return await tab.get_content()


# ─────────────────────────────
# URL BUILDERS
# ─────────────────────────────
def build_stat_urls(comp_id, slug, season, endpoint):
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
# SCRAPE ONE STAT TYPE
# ─────────────────────────────
async def scrape_one_stat(tab, league_name, comp_id, slug, season, stat_name, endpoint, table_id, prefix):
    """
    Scrape a single stat table for one league+season.
    Returns a clean DataFrame with prefixed columns, or None.
    """
    urls = build_stat_urls(comp_id, slug, season, endpoint)

    for url in urls:
        print(f"  📊 {stat_name:12s} → {url}")
        tab  = await fetch(tab, url)
        html = await get_html(tab)

        # ── DEBUG ────────────────────────────────────────────────────
        print(f"     🔍 HTML: {len(html):,} chars | table_id present: {table_id in html} | 'Player' present: {'Player' in html}")
        if len(html) < 5000:
            print(f"     ⚠️  HTML too short — page may not have loaded!")
            print(f"     Preview: {html[:300]}")
        # ── END DEBUG ────────────────────────────────────────────────

        # Try the correct table_id first, then fallbacks
        fallback_ids = [table_id, f"stats_{stat_name}", "stats_standard"]

        df = None
        for tid in fallback_ids:
            df = extract_table(html, tid)
            if df is not None:
                print(f"     ✅ table found: #{tid}  raw shape: {df.shape}")
                break

        if df is None:
            print(f"     ⚠️  not found at this URL, trying next")
            continue

        # ── Flatten with per-stat prefix ──────────────────────────────
        # Build mapping: for each (top, sub) tuple, decide the output name
        new_cols = []
        seen = {}

        for col in df.columns:
            if isinstance(col, tuple):
                top = str(col[0]).strip()
                sub = str(col[1]).strip() if len(col) > 1 else ""
                top_is_unnamed = "Unnamed" in top
                sub_is_unnamed = "Unnamed" in sub

                if top_is_unnamed:
                    raw = sub  # e.g. ('Unnamed: 0_level_0', 'Player') → 'Player'
                elif sub_is_unnamed or not sub:
                    raw = top
                else:
                    raw = f"{top}_{sub}"  # e.g. ('Performance', 'Gls') → 'Performance_Gls'
            else:
                raw = str(col).strip()

            # Identity cols → keep as-is, no prefix
            if raw in IDENTITY_COLS:
                final = raw
            else:
                # Add stat-type prefix to avoid collisions in the master concat
                final = f"{prefix}_{raw}"

            # Handle column name collisions by appending index
            if final in seen:
                seen[final] += 1
                final = f"{final}_{seen[final]}"
            else:
                seen[final] = 0

            new_cols.append(final)

        df.columns = new_cols

        # ── Clean header rows ──────────────────────────────────────────
        df = clean(df)

        # ── Tag metadata ───────────────────────────────────────────────
        df["level"]     = "player" if "Player" in df.columns else "squad"
        df["league"]    = league_name
        df["season"]    = season
        df["stat_type"] = stat_name

        print(f"     📦 {len(df):,} rows | {len(df.columns)} cols | "
              f"non-null stat cols: {df.drop(columns=IDENTITY_COLS, errors='ignore').notna().any().sum()}")

        return df, tab

    print(f"     ❌ {stat_name} — no data for {league_name} {season}")
    return None, tab


# ─────────────────────────────
# SCRAPE ALL STATS FOR ONE LEAGUE+SEASON
# Each stat type saved in its own CSV to avoid column collision
# ─────────────────────────────
async def scrape_stats(tab, league_name, comp_id, slug, season):
    print(f"\n🏆 {league_name} | 📅 {season}")
    all_dfs = []

    for stat_name, (endpoint, table_id, prefix) in STATS.items():
        result, tab = await scrape_one_stat(
            tab, league_name, comp_id, slug, season,
            stat_name, endpoint, table_id, prefix
        )
        if result is not None:
            all_dfs.append(result)

    return all_dfs, tab


# ─────────────────────────────
# SCRAPE WAGES
# ─────────────────────────────
async def scrape_wages(tab, league_name, comp_id, slug, season):
    urls = build_wage_urls(comp_id, slug, season)

    for url in urls:
        print(f"  💰 wages → {url}")
        tab  = await fetch(tab, url)
        html = await get_html(tab)

        squad_df  = extract_wages_table(html, "squad_wages")
        player_df = extract_wages_table(html, "player_wages")

        if squad_df is not None or player_df is not None:
            dfs = []

            if squad_df is not None:
                squad_df = flatten_simple(squad_df)
                squad_df["type"]   = "squad"
                squad_df["league"] = league_name
                squad_df["season"] = season
                # Parse wage columns: strip £/€/$ and commas, keep numeric
                squad_df = parse_wage_columns(squad_df)
                dfs.append(squad_df)
                print(f"     ✅ squad wages: {len(squad_df):,} rows | {len(squad_df.columns)} cols")

            if player_df is not None:
                player_df = flatten_simple(player_df)
                player_df["type"]   = "player"
                player_df["league"] = league_name
                player_df["season"] = season
                player_df = parse_wage_columns(player_df)
                dfs.append(player_df)
                print(f"     ✅ player wages: {len(player_df):,} rows | {len(player_df.columns)} cols")

            return pd.concat(dfs, ignore_index=True), tab

    print(f"     ❌ wages not found for {league_name} {season}")
    return None, tab


def parse_wage_columns(df):
    """
    FBref wages columns look like: 'Weekly Wages', 'Annual Wages'
    Values look like: '£ 200,000 (€ 230,000, $ 240,000)'
    Extract clean numeric columns for GBP weekly and EUR weekly.
    """
    import re

    for col in df.columns:
        if "Weekly Wages" in col or "Annual Wages" in col:
            # Extract first currency amount (GBP or EUR depending on league)
            def extract_first_amount(val):
                if pd.isna(val):
                    return None
                val = str(val)
                # Remove currency symbols and extract numbers
                nums = re.findall(r'[\d,]+', val.replace(' ', ''))
                if nums:
                    try:
                        return int(nums[0].replace(',', ''))
                    except Exception:
                        return None
                return None

            clean_col = col.replace(" ", "_").replace("-", "_")
            df[clean_col + "_num"] = df[col].apply(extract_first_amount)

    return df


# ─────────────────────────────
# CHECKPOINT SYSTEM
# ─────────────────────────────
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
# SAVE HELPERS
# ─────────────────────────────
def save_stats(stat_name, new_df, data_dir):
    """Save each stat type to its own CSV file to avoid column collisions."""
    path = data_dir / f"STATS_{stat_name.upper()}.csv"
    if path.exists():
        existing = pd.read_csv(path, low_memory=False)
        combined = pd.concat([existing, new_df], ignore_index=True)
        dedup_keys = ["Player", "Squad", "league", "season"]
        dedup_keys = [k for k in dedup_keys if k in combined.columns]
        combined = combined.drop_duplicates(subset=dedup_keys, keep="last")
    else:
        combined = new_df
    combined.to_csv(path, index=False)
    return combined


def merge_all_stats(data_dir):
    """
    Merge all per-stat CSVs into ALL_STATS.csv using a long format.
    Each stat type has its own columns, NaN in other stat type columns is EXPECTED.
    """
    all_dfs = []
    for stat_name in STATS:
        path = data_dir / f"STATS_{stat_name.upper()}.csv"
        if path.exists():
            df = pd.read_csv(path, low_memory=False)
            all_dfs.append(df)
            print(f"  Loaded STATS_{stat_name.upper()}.csv: {len(df):,} rows × {len(df.columns)} cols")

    if not all_dfs:
        return None

    # Concat — each stat type row will have NaN in other stat types' columns
    # This is the expected long format — pipeline pivots this to wide later
    merged = pd.concat(all_dfs, ignore_index=True)
    merged.to_csv(data_dir / "ALL_STATS.csv", index=False)
    print(f"\n✅ ALL_STATS: {len(merged):,} rows × {len(merged.columns)} cols")
    print(f"   Stat types: {sorted(merged['stat_type'].unique())}")
    print(f"   Seasons:    {sorted(merged['season'].unique())}")
    print(f"   Leagues:    {sorted(merged['league'].unique())}")
    return merged


# ─────────────────────────────
# MAIN
# ─────────────────────────────
async def run():
    cp = load_checkpoint()
    already = len(cp["done"])
    total   = len(LEAGUES) * len(SEASONS)
    print(f"📋 Checkpoint: {already} tasks done")
    print(f"📁 Output dir: {DATA_DIR}")

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

    all_wages = []

    wages_path = DATA_DIR / "ALL_WAGES.csv"
    if wages_path.exists():
        all_wages.append(pd.read_csv(wages_path, low_memory=False))
        print(f"📂 Loaded existing ALL_WAGES: {len(all_wages[0]):,} rows")

    for league, info in LEAGUES.items():
        for season in SEASONS:

            # ── Stats (per stat type) ───────────────────────────────
            stats_key = f"stats_{league}_{season}"
            if stats_key in cp["done"]:
                print(f"⏭️  Skipping stats {league} {season} (already done)")
            else:
                stat_dfs, tab = await scrape_stats(
                    tab, league, info["id"], info["slug"], season
                )
                for df in stat_dfs:
                    stat_name = df["stat_type"].iloc[0]
                    saved = save_stats(stat_name, df, DATA_DIR)
                    print(f"  💾 STATS_{stat_name.upper()}.csv: {len(saved):,} rows total")

                save_checkpoint(stats_key, cp)

            # ── Wages ───────────────────────────────────────────────
            wages_key = f"wages_{league}_{season}"
            if wages_key in cp["done"]:
                print(f"⏭️  Skipping wages {league} {season} (already done)")
            else:
                wages_df, tab = await scrape_wages(
                    tab, league, info["id"], info["slug"], season
                )
                if wages_df is not None:
                    all_wages.append(wages_df)
                    full_w = pd.concat(all_wages, ignore_index=True)
                    full_w = full_w.drop_duplicates(keep="last")
                    full_w.to_csv(wages_path, index=False)
                    print(f"  💾 ALL_WAGES: {len(full_w):,} rows total")
                save_checkpoint(wages_key, cp)

    # ── Final merge of all stat CSVs into ALL_STATS.csv ────────────
    print("\n" + "="*55)
    print("  ✅ SCRAPING COMPLETE — merging stat files")
    print("="*55)
    merge_all_stats(DATA_DIR)

    if all_wages:
        final_wages = pd.concat(all_wages, ignore_index=True)
        final_wages = final_wages.drop_duplicates(keep="last")
        final_wages.to_csv(wages_path, index=False)
        print(f"  💰 ALL_WAGES → {len(final_wages):,} rows × {len(final_wages.columns)} cols")

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(run())
