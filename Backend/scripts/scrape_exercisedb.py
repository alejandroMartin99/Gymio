"""
Scrape all exercises + GIFs from ExerciseDB (RapidAPI) and cache locally.

Usage:
    cd Backend
    python -m scripts.scrape_exercisedb          # full run
    python -m scripts.scrape_exercisedb --no-gifs # JSON only (fast)
    python -m scripts.scrape_exercisedb --gifs-only # only download missing GIFs
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data" / "exercisedb"
GIFS_DIR = DATA_DIR / "gifs"

load_dotenv(BACKEND_DIR / ".env")

BASE = "https://exercisedb.p.rapidapi.com"
PAGE_SIZE = 10
MAX_RETRIES = 3


def _headers() -> dict[str, str]:
    key = os.environ.get("RAPIDAPI_KEY", "").strip()
    if not key:
        sys.exit("ERROR: RAPIDAPI_KEY not set in Backend/.env")
    return {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
        "Content-Type": "application/json",
    }


def fetch_json_retry(client: httpx.Client, path: str, params: dict | None = None) -> list | dict:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = client.get(f"{BASE}{path}", headers=_headers(), params=params or {})
            r.raise_for_status()
            return r.json()
        except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.RemoteProtocolError) as exc:
            wait = 3 * attempt
            if attempt == MAX_RETRIES:
                raise
            print(f"\n  retry {attempt}/{MAX_RETRIES} after {type(exc).__name__}, wait {wait}s …")
            time.sleep(wait)
    return []


def scrape_metadata(client: httpx.Client) -> None:
    print("[1/3] Body part list …")
    bp = fetch_json_retry(client, "/exercises/bodyPartList")
    (DATA_DIR / "body_parts.json").write_text(json.dumps(bp, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"       {len(bp)} body parts")

    print("[2/3] Target list …")
    tg = fetch_json_retry(client, "/exercises/targetList")
    (DATA_DIR / "targets.json").write_text(json.dumps(tg, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"       {len(tg)} targets")

    print("[3/3] Equipment list …")
    try:
        eq = fetch_json_retry(client, "/exercises/equipmentList")
        (DATA_DIR / "equipment.json").write_text(json.dumps(eq, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"       {len(eq)} equipment types")
    except Exception as exc:
        print(f"       WARN: {exc}")


def scrape_exercises(client: httpx.Client) -> list[dict]:
    exercises_path = DATA_DIR / "exercises.json"

    existing: list[dict] = []
    if exercises_path.exists():
        existing = json.loads(exercises_path.read_text(encoding="utf-8"))
        print(f"\nResuming: {len(existing)} exercises already cached")

    seen_ids = {str(e["id"]) for e in existing}
    offset = len(existing)

    print(f"Fetching exercises from offset={offset} (batches of {PAGE_SIZE}) …")

    while True:
        try:
            batch = fetch_json_retry(client, "/exercises", params={"offset": offset, "limit": PAGE_SIZE})
        except Exception as exc:
            print(f"\n  FATAL at offset={offset}: {exc}")
            break

        if not isinstance(batch, list) or len(batch) == 0:
            break

        new_items = [e for e in batch if str(e["id"]) not in seen_ids]
        existing.extend(new_items)
        for e in new_items:
            seen_ids.add(str(e["id"]))

        sys.stdout.write(f"\r       {len(existing)} exercises …")
        sys.stdout.flush()

        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.4)

    print(f"\n       TOTAL: {len(existing)} exercises -> exercises.json")
    exercises_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    return existing


def download_gifs(exercises: list[dict]) -> None:
    GIFS_DIR.mkdir(parents=True, exist_ok=True)
    total = len(exercises)
    downloaded = 0
    skipped = 0
    failed = 0
    failed_ids: list[str] = []

    print(f"\nDownloading GIFs ({total} exercises, 180px) …")

    with httpx.Client(timeout=30.0, follow_redirects=True) as dl:
        for i, ex in enumerate(exercises):
            eid = str(ex.get("id", ""))
            if not eid:
                continue

            dest = GIFS_DIR / f"{eid}.gif"
            if dest.exists() and dest.stat().st_size > 500:
                skipped += 1
                continue

            ok = False
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    r = dl.get(
                        f"{BASE}/image",
                        headers=_headers(),
                        params={"exerciseId": eid, "resolution": "180"},
                        timeout=30.0,
                    )
                    r.raise_for_status()
                    dest.write_bytes(r.content)
                    downloaded += 1
                    ok = True
                    break
                except Exception as exc:
                    if attempt == MAX_RETRIES:
                        print(f"\n  FAIL [{eid}]: {type(exc).__name__}")
                        failed += 1
                        failed_ids.append(eid)
                    else:
                        time.sleep(3 * attempt)

            sys.stdout.write(
                f"\r  [{i + 1}/{total}]  new={downloaded}  cached={skipped}  fail={failed}   "
            )
            sys.stdout.flush()

            if ok:
                time.sleep(0.8)

    print(f"\n\nGIF download: {downloaded} new, {skipped} cached, {failed} failed")
    if failed_ids:
        fail_path = DATA_DIR / "failed_gifs.json"
        fail_path.write_text(json.dumps(failed_ids), encoding="utf-8")
        print(f"Failed IDs saved to: {fail_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape ExerciseDB to local cache")
    parser.add_argument("--no-gifs", action="store_true", help="Skip GIF download")
    parser.add_argument("--gifs-only", action="store_true", help="Only download missing GIFs")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if args.gifs_only:
        ex_path = DATA_DIR / "exercises.json"
        if not ex_path.exists():
            sys.exit("exercises.json not found — run without --gifs-only first")
        exercises = json.loads(ex_path.read_text(encoding="utf-8"))
        download_gifs(exercises)
        return

    with httpx.Client(timeout=180.0) as client:
        scrape_metadata(client)
        exercises = scrape_exercises(client)

    if not args.no_gifs:
        download_gifs(exercises)
    else:
        print("\n--no-gifs: skipping GIF download")

    print("\nDone! Data saved to:", DATA_DIR)


if __name__ == "__main__":
    main()
