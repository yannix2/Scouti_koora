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
ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "scraped"
DATA_DIR.mkdir(parents=True, exist_ok=True)

PROFILE_PATH = r"C:\Users\Yassine\fbref_profile"

LEAGUES = {
    "EPL": {"id": 9, "slug": "Premier-League"},
    "LaLiga": {"id": 12, "slug": "La-Liga"},
    "SerieA": {"id": 11, "slug": "Serie-A"},
    "Bundesliga": {"id": 20, "slug": "Bundesliga"},
    "Ligue1": {"id": 13, "slug": "Ligue-1"},
}

SEASONS = [
    "2020-2021",
    "2021-2022",
    "2022-2023",
    "2023-2024",
    "2024-2025",
]

STATS = {
    "standard": "stats",
    "shooting": "shooting",
    "passing": "passing",
    "defense": "defense",
    "gca": "gca",
}

# ─────────────────────────────
# CLEAN
# ─────────────────────────────
def flatten(df):
    df.columns = [
        "_".join([str(i) for i in col if "Unnamed" not in str(i)])
        if isinstance(col, tuple)
        else col
        for col in df.columns
    ]
    return df


def clean(df):
    if "Player" in df.columns:
        df = df[df["Player"].notna()]
        df = df[df["Player"] != "Player"]
    return df.reset_index(drop=True)


# ─────────────────────────────
# EXTRACT TABLE (FIXED)
# ─────────────────────────────
def extract_table(html, table_id):
    soup = BeautifulSoup(html, "html.parser")

    # direct
    table = soup.find("table", {"id": table_id})
    if table:
        return pd.read_html(io.StringIO(str(table)))[0]

    # inside comments
    comments = soup.find_all(string=lambda text: isinstance(text, Comment))

    for c in comments:
        if table_id in c:
            comment_soup = BeautifulSoup(c, "html.parser")
            table = comment_soup.find("table", {"id": table_id})
            if table:
                return pd.read_html(io.StringIO(str(table)))[0]

    return None


# ─────────────────────────────
# FETCH
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
def build_urls(comp_id, slug, season, endpoint):
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

    for stat_name, endpoint in STATS.items():

        urls = build_urls(comp_id, slug, season, endpoint)
        df = None

        for url in urls:
            print(f"🌐 {stat_name}: {url}")

            tab = await fetch(tab, url)
            html = await get_html(tab)

            # 🔥 ALL POSSIBLE TABLE IDS
            table_ids = [
                f"stats_{endpoint}",
                f"stats_{endpoint}_squads",
                "stats_standard",
                "stats_squads_standard",
            ]

            for tid in table_ids:
                df = extract_table(html, tid)
                if df is not None:
                    print(f"✅ found table: {tid}")
                    break

            if df is not None:
                break
            else:
                print("❌ try next")

        if df is None:
            print(f"❌ {stat_name} failed")
            continue

        df = flatten(df)
        df = clean(df)

        # identify level
        df["level"] = "player" if "Player" in df.columns else "squad"

        df["league"] = league_name
        df["season"] = season
        df["stat_type"] = stat_name

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
        print(f"💰 wages: {url}")

        tab = await fetch(tab, url)
        html = await get_html(tab)

        squad = extract_table(html, "squad_wages")
        player = extract_table(html, "player_wages")

        if squad is not None or player is not None:

            dfs = []

            if squad is not None:
                squad["type"] = "squad"
                squad["league"] = league_name
                squad["season"] = season
                dfs.append(squad)

            if player is not None:
                player["type"] = "player"
                player["league"] = league_name
                player["season"] = season
                dfs.append(player)

            return pd.concat(dfs, ignore_index=True)

    print("❌ wages failed")
    return None


# ─────────────────────────────
# MAIN
# ─────────────────────────────
async def run():

    browser = await uc.start(
        headless=False,
        user_data_dir=PROFILE_PATH,
        browser_args=["--start-maximized"],
    )

    tab = await browser.get("https://fbref.com/en/")

    print("\n⚠️ Solve CAPTCHA if needed then press ENTER")
    input()

    all_stats = []
    all_wages = []

    for league, info in LEAGUES.items():
        for season in SEASONS:

            stats = await scrape_stats(tab, league, info["id"], info["slug"], season)
            if stats is not None:
                all_stats.append(stats)

            wages = await scrape_wages(tab, league, info["id"], info["slug"], season)
            if wages is not None:
                all_wages.append(wages)

    # SAVE RESULTS
    if all_stats:
        full_stats = pd.concat(all_stats, ignore_index=True)
        full_stats.to_csv(DATA_DIR / "ALL_STATS.csv", index=False)
        print(f"\n🔥 Stats saved: {len(full_stats)} rows")

    if all_wages:
        full_wages = pd.concat(all_wages, ignore_index=True)
        full_wages.to_csv(DATA_DIR / "ALL_WAGES.csv", index=False)
        print(f"💰 Wages saved: {len(full_wages)} rows")

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(run())