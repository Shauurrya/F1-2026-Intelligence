"""
F1 2026 Technical Intelligence System — Data Scraper & Updater
==============================================================
Automatically fetches, parses, and updates the F1 2026 car database.
Run weekly via scheduler or manually.

Usage:
    python scraper.py               # Full update cycle
    python scraper.py --team ferrari  # Update specific team
    python scraper.py --dry-run     # Preview without writing

Requirements:
    pip install requests beautifulsoup4 schedule
"""

import json
import os
import sys
import time
import logging
import argparse
import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# ============================================================
# CONFIG
# ============================================================
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
LOG_DIR = BASE_DIR / "logs"
DB_PATH = DATA_DIR / "f1_2026_cars.json"
LOG_PATH = LOG_DIR / "scraper.log"

DATA_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

# ============================================================
# LOGGING
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger("F1Scraper")

# ============================================================
# SOURCES CONFIG
# ============================================================
SOURCES = {
    "fia": {
        "url": "https://www.fia.com/regulation/category/110",
        "type": "regulatory",
        "priority": 1
    },
    "formula1": {
        "url": "https://www.formula1.com/en/teams",
        "type": "official",
        "priority": 1
    },
    "motorsport": {
        "url": "https://www.motorsport.com/f1/",
        "type": "news",
        "priority": 2
    },
    "the_race": {
        "url": "https://the-race.com/formula-1/",
        "type": "technical",
        "priority": 2
    }
}

TEAM_URLS = {
    "ferrari": "https://www.ferrari.com/en-EN/formula1",
    "mercedes": "https://www.mercedesamgf1.com",
    "red_bull": "https://www.redbull.com/int-en/formula1",
    "mclaren": "https://www.mclaren.com/formula1",
    "aston_martin": "https://www.astonmartinf1.com",
    "alpine": "https://www.alpinecars.com/en/formula-1",
    "haas": "https://www.haasf1team.com",
    "williams": "https://www.williamsf1.com",
    "audi": "https://www.audi.com/en/motorsport/formula-1",
    "racing_bulls": "https://www.visacashapprb.com",
    "cadillac": "https://www.cadillacracing.com"
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Cache-Control": "no-cache"
}

REQUEST_TIMEOUT = 15
REQUEST_DELAY = 2.0   # seconds between requests (be polite)

# ============================================================
# DATABASE MODULE
# ============================================================
class Database:
    def __init__(self, path: Path):
        self.path = path
        self._data = None

    def load(self) -> dict:
        if not self.path.exists():
            log.warning(f"Database not found at {self.path}")
            return {}
        with open(self.path, encoding='utf-8') as f:
            self._data = json.load(f)
        log.info(f"Database loaded: {len(self._data.get('teams', []))} teams")
        return self._data

    def save(self, data: dict, dry_run: bool = False) -> None:
        if dry_run:
            log.info("[DRY RUN] Would write:")
            log.info(json.dumps(data['meta'], indent=2))
            return
        with open(self.path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        log.info(f"Database saved to {self.path}")

    def get_team(self, team_id: str) -> dict | None:
        if not self._data:
            return None
        teams = self._data.get('teams', [])
        return next((t for t in teams if t['id'] == team_id), None)

    def update_team(self, team_id: str, updates: dict) -> bool:
        if not self._data:
            return False
        teams = self._data.get('teams', [])
        for i, t in enumerate(teams):
            if t['id'] == team_id:
                teams[i] = self._deep_merge(t, updates)
                log.info(f"Updated team: {team_id}")
                return True
        return False

    def update_meta(self) -> None:
        if self._data:
            self._data['meta']['last_updated'] = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            self._data['meta']['data_version'] = self._bump_version(self._data['meta'].get('data_version', '1.0.0'))

    def add_weekly_update(self, week: str, summary: str, news: list) -> None:
        if not self._data:
            return
        updates = self._data.setdefault('weekly_updates', [])
        # Check if week already exists
        for u in updates:
            if u['week'] == week:
                u['summary'] = summary
                u['news'].extend(n for n in news if n not in u['news'])
                return
        updates.insert(0, {
            "week": week,
            "date": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
            "summary": summary,
            "news": news
        })
        # Keep last 12 weeks
        self._data['weekly_updates'] = updates[:12]

    def get_data(self) -> dict:
        return self._data

    @staticmethod
    def _deep_merge(base: dict, override: dict) -> dict:
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = Database._deep_merge(result[key], value)
            elif value is not None:
                result[key] = value
        return result

    @staticmethod
    def _bump_version(v: str) -> str:
        parts = v.split('.')
        try:
            parts[-1] = str(int(parts[-1]) + 1)
        except (ValueError, IndexError):
            return '1.0.0'
        return '.'.join(parts)


# ============================================================
# HTTP CLIENT MODULE
# ============================================================
class HTTPClient:
    def __init__(self):
        self._session = None
        if HAS_REQUESTS:
            self._session = requests.Session()
            self._session.headers.update(HEADERS)

    def get(self, url: str, timeout: int = REQUEST_TIMEOUT) -> str | None:
        if not HAS_REQUESTS:
            log.warning("requests library not installed. Install with: pip install requests beautifulsoup4")
            return None
        try:
            time.sleep(REQUEST_DELAY)
            resp = self._session.get(url, timeout=timeout)
            resp.raise_for_status()
            log.info(f"GET {url} → {resp.status_code} ({len(resp.text)} chars)")
            return resp.text
        except requests.RequestException as e:
            log.error(f"HTTP error for {url}: {e}")
            return None

    def get_soup(self, url: str) -> 'BeautifulSoup | None':
        html = self.get(url)
        if not html:
            return None
        try:
            from bs4 import BeautifulSoup
            return BeautifulSoup(html, 'html.parser')
        except Exception as e:
            log.error(f"Parse error for {url}: {e}")
            return None


# ============================================================
# PARSER MODULE
# ============================================================
class Parser:
    @staticmethod
    def extract_numbers(text: str) -> list[float]:
        """Extract all numbers from a text string."""
        return [float(m) for m in re.findall(r'\d+(?:\.\d+)?', text)]

    @staticmethod
    def find_bhp(text: str) -> int | None:
        """Try to find BHP values from text."""
        patterns = [
            r'(\d{3,4})\s*(?:bhp|hp|horsepower)',
            r'(\d{3,4})\s*(?:ps|cv)',
        ]
        for p in patterns:
            m = re.search(p, text, re.IGNORECASE)
            if m:
                val = int(m.group(1))
                if 400 <= val <= 1200:
                    return val
        return None

    @staticmethod
    def find_weight(text: str) -> int | None:
        """Find weight values from text."""
        patterns = [
            r'(\d{3})\s*(?:kg|kilograms)',
        ]
        for p in patterns:
            m = re.search(p, text, re.IGNORECASE)
            if m:
                val = int(m.group(1))
                if 700 <= val <= 820:
                    return val
        return None

    @staticmethod
    def find_wheelbase(text: str) -> int | None:
        """Find wheelbase values from text."""
        m = re.search(r'(\d{4})\s*mm', text, re.IGNORECASE)
        if m:
            val = int(m.group(1))
            if 3000 <= val <= 3800:
                return val
        return None

    @staticmethod
    def extract_team_news(soup, team_keywords: list[str]) -> list[str]:
        """Extract news snippets related to a team from HTML soup."""
        if not soup:
            return []
        news = []
        texts = [el.get_text(strip=True) for el in soup.find_all(['p', 'h2', 'h3', 'li'])]
        for text in texts:
            text_lower = text.lower()
            if any(kw.lower() in text_lower for kw in team_keywords):
                if len(text) > 30 and len(text) < 300:
                    cleaned = re.sub(r'\s+', ' ', text).strip()
                    if cleaned and cleaned not in news:
                        news.append(cleaned)
                        if len(news) >= 3:
                            break
        return news


# ============================================================
# SCRAPER MODULE
# ============================================================
class F1Scraper:
    def __init__(self, db: Database, http: HTTPClient, dry_run: bool = False):
        self.db = db
        self.http = http
        self.dry_run = dry_run
        self.news_buffer = []

    def scrape_all(self) -> dict:
        """Run full update cycle for all teams."""
        log.info("=" * 60)
        log.info("F1 2026 TECHNICAL INTELLIGENCE — FULL UPDATE CYCLE")
        log.info(f"Timestamp: {datetime.now().isoformat()}")
        log.info("=" * 60)

        results = {"updated": [], "failed": [], "no_change": []}

        for team_id in TEAM_URLS.keys():
            try:
                updated = self.scrape_team(team_id)
                if updated:
                    results["updated"].append(team_id)
                else:
                    results["no_change"].append(team_id)
            except Exception as e:
                log.error(f"Failed to scrape {team_id}: {e}")
                results["failed"].append(team_id)
            time.sleep(REQUEST_DELAY)

        # Scrape general F1 news
        self._scrape_f1_news()

        # Update meta
        self.db.update_meta()

        # Add weekly update entry
        week = datetime.now().strftime('%Y-W%V')
        summary = f"Weekly update cycle completed. Updated: {len(results['updated'])} teams. Failed: {len(results['failed'])}. No change: {len(results['no_change'])}."
        self.db.add_weekly_update(week, summary, self.news_buffer[:10])

        log.info(f"\nUpdate complete: {results}")
        return results

    def scrape_team(self, team_id: str) -> bool:
        """Scrape data for a specific team. Returns True if data was updated."""
        team = self.db.get_team(team_id)
        if not team:
            log.warning(f"Team not found in DB: {team_id}")
            return False

        url = TEAM_URLS.get(team_id)
        if not url:
            log.warning(f"No URL configured for: {team_id}")
            return False

        log.info(f"\n--- Scraping: {team['name']} → {url}")
        soup = self.http.get_soup(url)

        if not soup:
            log.warning(f"Could not fetch page for {team_id}")
            return False

        updates = {}
        page_text = soup.get_text()

        # Try to extract BHP data
        bhp = Parser.find_bhp(page_text)
        if bhp and abs(bhp - team['power_unit']['total_power_bhp']) > 5:
            log.info(f"  → BHP update: {team['power_unit']['total_power_bhp']} → {bhp}")
            updates['power_unit'] = {'total_power_bhp': bhp, 'data_status': 'partial'}

        # Try to extract weight data
        weight = Parser.find_weight(page_text)
        if weight and weight != team['chassis_aero']['weight_kg']:
            log.info(f"  → Weight update: {team['chassis_aero']['weight_kg']} → {weight}")
            updates.setdefault('chassis_aero', {})['weight_kg'] = weight

        # Try to extract wheelbase
        wb = Parser.find_wheelbase(page_text)
        if wb and wb != team['chassis_aero']['wheelbase_mm']:
            log.info(f"  → Wheelbase update: {team['chassis_aero']['wheelbase_mm']} → {wb}")
            updates.setdefault('chassis_aero', {})['wheelbase_mm'] = wb

        # Extract relevant news
        news = Parser.extract_team_news(soup, [team['name'], team['chassis']])
        if news:
            log.info(f"  → Found {len(news)} news snippets")
            self.news_buffer.extend([f"{team['name']}: {n}" for n in news])

        if updates:
            self.db.update_team(team_id, updates)
            return True

        log.info(f"  → No changes detected for {team_id}")
        return False

    def _scrape_f1_news(self) -> None:
        """Scrape latest F1 technical news."""
        for source_id, source in SOURCES.items():
            if source['type'] not in ('technical', 'official'):
                continue
            log.info(f"\n--- Scraping news source: {source_id}")
            soup = self.http.get_soup(source['url'])
            if not soup:
                continue
            headlines = []
            for tag in soup.find_all(['h2', 'h3'], limit=20):
                text = tag.get_text(strip=True)
                if len(text) > 20 and any(kw in text.lower() for kw in ['f1', 'formula 1', '2026', 'chassis', 'engine', 'power unit']):
                    headlines.append(text[:200])
            if headlines:
                log.info(f"  → {len(headlines)} headlines from {source_id}")
                self.news_buffer.extend(headlines[:3])


# ============================================================
# REPORT GENERATOR
# ============================================================
class ReportGenerator:
    def __init__(self, db: Database):
        self.db = db

    def generate_weekly_report(self) -> str:
        data = self.db.get_data()
        if not data:
            return "No data available."

        lines = [
            "=" * 70,
            f"F1 2026 TECHNICAL INTELLIGENCE — WEEKLY REPORT",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "=" * 70,
            "",
            "TEAM SUMMARY TABLE",
            "-" * 70,
            f"{'Team':<20} {'Chassis':<10} {'Engine':<18} {'BHP':<8} {'Weight':<8} {'Top Spd':<10}",
            "-" * 70,
        ]
        for t in data.get('teams', []):
            pu = t['power_unit']
            ch = t['chassis_aero']
            perf = t['performance']
            lines.append(
                f"{t['name']:<20} {t['chassis']:<10} {pu['manufacturer']:<18} "
                f"{pu['total_power_bhp']:<8} {ch['weight_kg']:<8} {perf['top_speed_kmh']:<10}"
            )

        lines += [
            "",
            "ENGINE SUPPLIER DOMINANCE",
            "-" * 40,
        ]
        for s in data.get('engine_suppliers', []):
            lines.append(f"  {s['manufacturer']}: {len(s['teams'])} team(s) — {', '.join(s['teams'])}")

        if data.get('weekly_updates'):
            upd = data['weekly_updates'][0]
            lines += [
                "",
                f"LATEST UPDATE: {upd['week']} ({upd['date']})",
                "-" * 40,
                upd['summary'],
                "",
                "News:"
            ]
            lines.extend(f"  • {n}" for n in upd['news'])

        lines += ["", "=" * 70, "End of Report", "=" * 70]
        return "\n".join(lines)

    def save_report(self) -> Path:
        report = self.generate_weekly_report()
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_path = LOG_DIR / f"report_{ts}.txt"
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)
        log.info(f"Report saved: {report_path}")
        return report_path


# ============================================================
# CSV EXPORT MODULE
# ============================================================
class CSVExporter:
    def __init__(self, db: Database):
        self.db = db

    def export(self) -> Path:
        data = self.db.get_data()
        if not data:
            return None

        csv_path = DATA_DIR / "f1_2026_teams.csv"
        rows = []
        headers = [
            "Team", "Full Name", "Chassis", "Is Works", "Engine Manufacturer",
            "ICE BHP", "MGU-K BHP", "Total BHP", "RPM Limit", "Hybrid Spec",
            "Monocoque", "Front Suspension", "Rear Suspension", "Wheelbase (mm)",
            "Weight (kg)", "Active Aero", "Drag Cd",
            "0-100 (s)", "Top Speed (km/h)", "Speed Rank",
            "2025 DNFs", "2025 Engine Failures", "2025 PU Penalties", "2025 Completion %",
            "Drivers", "Notable Changes"
        ]

        for t in data.get('teams', []):
            pu = t['power_unit']
            ch = t['chassis_aero']
            perf = t['performance']
            rel = t['reliability']
            row = [
                t['name'], t['full_name'], t['chassis'],
                'Yes' if t['is_works_team'] else 'No',
                pu['manufacturer'], pu['ice_power_bhp'], pu['mgu_k_power_bhp'],
                pu['total_power_bhp'], pu.get('rpm_limit', 15000), pu.get('hybrid_spec', ''),
                ch.get('monocoque', ''), ch.get('suspension_front', ''), ch.get('suspension_rear', ''),
                ch.get('wheelbase_mm', ''), ch.get('weight_kg', ''),
                'Yes' if ch.get('active_aero') else 'No',
                ch.get('drag_coefficient', 'N/A'),
                perf.get('zero_to_100_kmh_s', ''), perf.get('top_speed_kmh', ''),
                perf.get('straight_line_rank', ''),
                rel.get('dnfs_2025', 'N/A'), rel.get('engine_failures_2025', 'N/A'),
                rel.get('grid_penalties_pu_2025', 'N/A'), rel.get('avg_race_completion_pct', 'N/A'),
                ' / '.join(t.get('drivers', [])),
                t.get('notable_changes', '')
            ]
            rows.append(row)

        with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            import csv
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)

        log.info(f"CSV exported: {csv_path}")
        return csv_path


# ============================================================
# SCHEDULER
# ============================================================
class Scheduler:
    def run_weekly(self, callback):
        """Run callback weekly. Uses schedule library if available."""
        try:
            import schedule
            log.info("Scheduler started — updates every 7 days.")
            schedule.every(7).days.do(callback)
            while True:
                schedule.run_pending()
                time.sleep(3600)
        except ImportError:
            log.warning("schedule library not installed. Running once now. Install: pip install schedule")
            callback()


# ============================================================
# CLI
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="F1 2026 Technical Intelligence Data Scraper")
    parser.add_argument('--team', help='Scrape specific team only (e.g. ferrari)')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without saving')
    parser.add_argument('--report', action='store_true', help='Generate weekly report only')
    parser.add_argument('--csv', action='store_true', help='Export CSV only')
    parser.add_argument('--schedule', action='store_true', help='Run as scheduled weekly updater')
    args = parser.parse_args()

    db = Database(DB_PATH)
    data = db.load()
    if not data and not args.report:
        log.error("Database not found or empty. Cannot proceed.")
        sys.exit(1)

    http = HTTPClient()
    scraper = F1Scraper(db, http, dry_run=args.dry_run)
    report_gen = ReportGenerator(db)
    csv_exp = CSVExporter(db)

    if args.report:
        print(report_gen.generate_weekly_report())
        report_gen.save_report()
        return

    if args.csv:
        path = csv_exp.export()
        log.info(f"CSV saved: {path}")
        return

    def update_cycle():
        if args.team:
            success = scraper.scrape_team(args.team)
            log.info(f"Team scrape result: {'Updated' if success else 'No change'}")
        else:
            results = scraper.scrape_all()
            log.info(f"Full update: {results}")

        if not args.dry_run:
            db.save(db.get_data())
            csv_exp.export()
            report_gen.save_report()

    if args.schedule:
        scheduler = Scheduler()
        scheduler.run_weekly(update_cycle)
    else:
        update_cycle()

    log.info("\n✅ F1 2026 Data update complete!")


if __name__ == "__main__":
    main()
