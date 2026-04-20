"""
scraper_transfermarkt.py
Scrapes live from Transfermarkt:
  - Player market values per league per season
  - Transfer rumors (live)
  - Recent completed transfers
  - Player injury history

Run: python src/data/scraper_transfermarkt.py
"""

import nodriver as uc
import asyncio, sys, json, re, pandas as pd
from datetime import datetime
from pathlib import Path
from bs4 import BeautifulSoup

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# ─────────────────────────────
# CONFIG
# ─────────────────────────────
ROOT         = Path(__file__).resolve().parents[2]
DATA_DIR     = ROOT / "data" / "scraped"
DATA_DIR.mkdir(parents=True, exist_ok=True)
PROFILE_PATH = r"C:\Users\Yassine\fbref_profile"

LEAGUES = {
    "EPL":        {"slug": "premier-league",   "id": "GB1"},
    "LaLiga":     {"slug": "primera-division", "id": "ES1"},
    "SerieA":     {"slug": "serie-a",          "id": "IT1"},
    "Bundesliga": {"slug": "1-bundesliga",     "id": "L1"},
    "Ligue1":     {"slug": "ligue-1",          "id": "FR1"},
}

SEASONS = {
    "2024-2025": "2024",
    "2023-2024": "2023",
    "2022-2023": "2022",
    "2021-2022": "2021",
    "2020-2021": "2020",
}

# ─────────────────────────────
# CHECKPOINT
# ─────────────────────────────
CP_FILE = DATA_DIR / "checkpoint_tm.json"

def load_cp():
    if CP_FILE.exists():
        with open(CP_FILE) as f: return json.load(f)
    return {"done": []}

def save_cp(key, cp):
    cp["done"].append(key)
    with open(CP_FILE, "w") as f: json.dump(cp, f, indent=2)

# ─────────────────────────────
# HELPERS
# ─────────────────────────────
async def goto(tab, url, wait=3):
    tab = await tab.get(url)
    await tab.sleep(wait)
    return tab

async def get_html(tab):
    return await tab.get_content()

def parse_value(text):
    if not text or text.strip() in ["-", "?", ""]: return None
    t = re.sub(r"[€£$,\s]", "", text.strip())
    mult = 1
    if "m" in t.lower(): mult = 1_000_000; t = t.lower().replace("m","")
    elif "k" in t.lower(): mult = 1_000; t = t.lower().replace("k","")
    try: return float(t) * mult
    except: return None

def ts(): return datetime.now().strftime("%Y-%m-%d %H:%M")

# ─────────────────────────────────────────────────────────────
# 1. PLAYER MARKET VALUES
# ─────────────────────────────────────────────────────────────
async def scrape_player_values(tab, league_name, league_slug, comp_id, season_id):
    url  = f"https://www.transfermarkt.com/{league_slug}/startseite/wettbewerb/{comp_id}/saison_id/{season_id}"
    tab  = await goto(tab, url, wait=3)
    soup = BeautifulSoup(await get_html(tab), "html.parser")

    club_links, seen = [], set()
    for a in soup.select("table.items td.hauptlink a"):
        href = a.get("href", "")
        if "/startseite/verein/" in href and href not in seen:
            seen.add(href); club_links.append({"name": a.get_text(strip=True), "href": href})

    print(f"  {league_name} {season_id}: {len(club_links)} clubs")
    rows = []

    for club in club_links:
        squad_url = f"https://www.transfermarkt.com{club['href'].replace('startseite','kader')}/saison_id/{season_id}/plus/1"
        tab  = await goto(tab, squad_url, wait=2)
        soup = BeautifulSoup(await get_html(tab), "html.parser")

        for tr in soup.select("table.items tbody tr.odd, table.items tbody tr.even"):
            tds      = tr.find_all("td")
            name_tag = tr.select_one("td.hauptlink a")
            val_tag  = tr.select_one("td.rechts.hauptlink")
            nat_tags = tr.select("img.flagge")
            pos_tag  = tr.select_one("td.posrela table tr td")
            if not name_tag: continue
            pid = re.search(r"/spieler/(\d+)", name_tag.get("href",""))
            rows.append({
                "tm_player_id":     pid.group(1) if pid else None,
                "player_name":      name_tag.get_text(strip=True),
                "position":         pos_tag.get_text(strip=True) if pos_tag else None,
                "age":              tds[2].get_text(strip=True) if len(tds)>2 else None,
                "nationality":      nat_tags[0].get("title") if nat_tags else None,
                "market_value":     val_tag.get_text(strip=True) if val_tag else None,
                "market_value_eur": parse_value(val_tag.get_text(strip=True) if val_tag else ""),
                "club":             club["name"],
                "league":           league_name,
                "season_id":        season_id,
                "scraped_at":       ts(),
            })
        print(f"    {club['name']}: {len(rows)} rows total")

    return pd.DataFrame(rows)

# ─────────────────────────────────────────────────────────────
# 2. TRANSFER RUMORS
# ─────────────────────────────────────────────────────────────
async def scrape_rumors(tab, pages=5):
    print(f"\n  Transfer rumors ({pages} pages)...")
    rows = []
    for p in range(1, pages+1):
        url  = f"https://www.transfermarkt.com/transfers/transfergeruechte/statistik/top/ajax/yw1/page/{p}"
        tab  = await goto(tab, url, wait=2)
        soup = BeautifulSoup(await get_html(tab), "html.parser")
        for tr in soup.select("table.items tbody tr"):
            name_tag = tr.select_one("td.hauptlink a")
            clubs    = tr.select("td.no-border-links.hauptlink a")
            val_tag  = tr.select_one("td.rechts")
            src_tag  = tr.select_one("a[href*='http']")
            if not name_tag: continue
            pid = re.search(r"/spieler/(\d+)", name_tag.get("href",""))
            rows.append({
                "tm_player_id": pid.group(1) if pid else None,
                "player_name":  name_tag.get_text(strip=True),
                "current_club": clubs[0].get_text(strip=True) if clubs else None,
                "rumored_to":   clubs[1].get_text(strip=True) if len(clubs)>1 else None,
                "value":        val_tag.get_text(strip=True) if val_tag else None,
                "value_eur":    parse_value(val_tag.get_text(strip=True) if val_tag else ""),
                "source":       src_tag.get("href") if src_tag else None,
                "scraped_at":   ts(),
            })
        print(f"    Page {p}: {len(rows)} rumors")
    return pd.DataFrame(rows)

# ─────────────────────────────────────────────────────────────
# 3. RECENT COMPLETED TRANSFERS
# ─────────────────────────────────────────────────────────────
async def scrape_recent_transfers(tab, pages=10):
    print(f"\n  Recent transfers ({pages} pages)...")
    rows = []
    for p in range(1, pages+1):
        url  = f"https://www.transfermarkt.com/transfers/neuestetransfers/statistik/top/plus/0/galerie/0/page/{p}"
        tab  = await goto(tab, url, wait=2)
        soup = BeautifulSoup(await get_html(tab), "html.parser")
        for tr in soup.select("table.items tbody tr.odd, table.items tbody tr.even"):
            tds      = tr.find_all("td")
            name_tag = tr.select_one("td.hauptlink a")
            clubs    = tr.select("td.no-border-links.hauptlink a")
            fee_tag  = tr.select_one("td.rechts.hauptlink")
            if not name_tag or len(tds)<5: continue
            pid = re.search(r"/spieler/(\d+)", name_tag.get("href",""))
            rows.append({
                "tm_player_id": pid.group(1) if pid else None,
                "player_name":  name_tag.get_text(strip=True),
                "from_club":    clubs[0].get_text(strip=True) if clubs else None,
                "to_club":      clubs[1].get_text(strip=True) if len(clubs)>1 else None,
                "fee":          fee_tag.get_text(strip=True) if fee_tag else None,
                "fee_eur":      parse_value(fee_tag.get_text(strip=True) if fee_tag else ""),
                "date":         tds[5].get_text(strip=True) if len(tds)>5 else None,
                "scraped_at":   ts(),
            })
        print(f"    Page {p}: {len(rows)} transfers")
    return pd.DataFrame(rows)

# ─────────────────────────────────────────────────────────────
# 4. INJURY HISTORY PER PLAYER
# ─────────────────────────────────────────────────────────────
async def scrape_injuries(tab, player_list):
    print(f"\n  Injury history: {len(player_list)} players...")
    rows, done_ids = [], set()
    cp_inj = DATA_DIR / "checkpoint_injuries.json"

    if cp_inj.exists():
        with open(cp_inj) as f: done_ids = set(json.load(f).get("done",[]))
    print(f"    {len(done_ids)} already scraped, resuming...")

    for i, (tm_id, player_name) in enumerate(player_list):
        if str(tm_id) in done_ids: continue

        slug = re.sub(r"[^\w\s-]","", player_name.lower().strip())
        slug = re.sub(r"\s+","-",slug).strip("-")

        url  = f"https://www.transfermarkt.com/{slug}/verletzungen/spieler/{tm_id}"
        tab  = await goto(tab, url, wait=2)
        soup = BeautifulSoup(await get_html(tab), "html.parser")

        table = soup.find("table", {"class": "items"})
        if table:
            for tr in table.select("tbody tr"):
                tds = tr.find_all("td")
                if len(tds)<5: continue
                rows.append({
                    "tm_player_id": tm_id,
                    "player_name":  player_name,
                    "season":       tds[0].get_text(strip=True),
                    "injury_type":  tds[1].get_text(strip=True),
                    "from_date":    tds[2].get_text(strip=True),
                    "until_date":   tds[3].get_text(strip=True),
                    "days_out":     tds[4].get_text(strip=True),
                    "games_missed": tds[5].get_text(strip=True) if len(tds)>5 else None,
                    "scraped_at":   ts(),
                })

        done_ids.add(str(tm_id))

        if (i+1) % 50 == 0:
            with open(cp_inj,"w") as f: json.dump({"done":list(done_ids)},f)
            if rows: pd.DataFrame(rows).to_csv(DATA_DIR/"TM_INJURIES.csv", index=False)
            print(f"    {i+1}/{len(player_list)} — {len(rows)} injuries found")

    with open(cp_inj,"w") as f: json.dump({"done":list(done_ids)},f)
    return pd.DataFrame(rows)

# ─────────────────────────────
# MAIN
# ─────────────────────────────
async def run():
    cp = load_cp()
    print(f"Checkpoint: {len(cp['done'])} tasks done\n")

    browser = await uc.start(headless=False, user_data_dir=PROFILE_PATH, browser_args=["--start-maximized"])
    tab     = await browser.get("https://www.transfermarkt.com/")

    print("="*55)
    print("  Accept cookies if asked, wait for homepage")
    print("  Press ENTER when ready")
    print("="*55)
    input()

    # 1. Market values
    print("\nSTEP 1 — Market values")
    all_vals, val_path = [], DATA_DIR/"TM_PLAYER_VALUES.csv"
    if val_path.exists():
        all_vals.append(pd.read_csv(val_path, low_memory=False))
        print(f"  Loaded existing: {len(all_vals[0]):,} rows")

    for lg, info in LEAGUES.items():
        for slabel, sid in SEASONS.items():
            key = f"values_{lg}_{sid}"
            if key in cp["done"]: print(f"  Skip {lg} {slabel}"); continue
            df = await scrape_player_values(tab, lg, info["slug"], info["id"], sid)
            if not df.empty:
                all_vals.append(df)
                full = pd.concat(all_vals, ignore_index=True)
                full.to_csv(val_path, index=False)
                print(f"  Saved TM_PLAYER_VALUES: {len(full):,} rows")
            save_cp(key, cp)

    # 2. Rumors
    print("\nSTEP 2 — Rumors")
    if "rumors" not in cp["done"]:
        df = await scrape_rumors(tab, pages=5)
        if not df.empty:
            df.to_csv(DATA_DIR/"TM_RUMORS.csv", index=False)
            print(f"  Saved TM_RUMORS: {len(df):,} rows")
        save_cp("rumors", cp)
    else: print("  Skip (done)")

    # 3. Recent transfers
    print("\nSTEP 3 — Recent transfers")
    if "recent_transfers" not in cp["done"]:
        df = await scrape_recent_transfers(tab, pages=10)
        if not df.empty:
            df.to_csv(DATA_DIR/"TM_RECENT_TRANSFERS.csv", index=False)
            print(f"  Saved TM_RECENT_TRANSFERS: {len(df):,} rows")
        save_cp("recent_transfers", cp)
    else: print("  Skip (done)")

    # 4. Injuries
    print("\nSTEP 4 — Injuries")
    if "injuries" not in cp["done"]:
        if val_path.exists():
            val_df = pd.read_csv(val_path).dropna(subset=["tm_player_id","player_name"]).drop_duplicates("tm_player_id")
            plist  = val_df[["tm_player_id","player_name"]].values.tolist()
            df = await scrape_injuries(tab, plist)
            if not df.empty:
                df.to_csv(DATA_DIR/"TM_INJURIES.csv", index=False)
                print(f"  Saved TM_INJURIES: {len(df):,} rows")
        save_cp("injuries", cp)
    else: print("  Skip (done)")

    print("\n"+"="*55+"\n  COMPLETE\n"+"="*55)
    for f in ["TM_PLAYER_VALUES.csv","TM_RUMORS.csv","TM_RECENT_TRANSFERS.csv","TM_INJURIES.csv"]:
        p = DATA_DIR/f
        if p.exists(): print(f"  {f:<32} {len(pd.read_csv(p)):,} rows")

    browser.stop()

if __name__ == "__main__":
    uc.loop().run_until_complete(run())