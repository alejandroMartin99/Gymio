"""
Download ExerciseDB media in hourly batches and keep local/frontend in sync.

What it does:
- Sends up to N distinct media requests per batch (default: 10).
- Saves each successful GIF immediately to Backend/data/exercisedb/gifs.
- Mirrors saved GIFs to Frontend/public/exercises/exercisedb/gifs.
- Regenerates Frontend/src/app/core/exercisedb-local-media.ts after each OK.
- Writes a rolling status report with OK / KO / WAIT.

Usage:
    cd Backend
    python -m scripts.hourly_media_sync --run-forever --interval-minutes 10 --per-batch 10
    python -m scripts.hourly_media_sync --once --per-batch 10
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data" / "exercisedb"
GIFS_DIR = DATA_DIR / "gifs"
STATE_PATH = DATA_DIR / "hourly_media_state.json"
LOG_PATH = DATA_DIR / "hourly_media_log.jsonl"
STATUS_PATH = DATA_DIR / "hourly_media_status.txt"
ID_NAME_MAP_PATH = DATA_DIR / "exercise_id_name_map.json"
MEDIA_INVENTORY_PATH = DATA_DIR / "media_inventory.json"

FRONTEND_GIFS_DIR = BACKEND_DIR.parent / "Frontend" / "public" / "exercises" / "exercisedb" / "gifs"
FRONTEND_MEDIA_INDEX = BACKEND_DIR.parent / "Frontend" / "src" / "app" / "core" / "exercisedb-local-media.ts"

BASE = "https://exercisedb.p.rapidapi.com"
DEFAULT_PER_BATCH = 50
DEFAULT_INTERVAL_MINUTES = 10

load_dotenv(BACKEND_DIR / ".env")


def _headers() -> dict[str, str]:
    key = (os.environ.get("RAPIDAPI_KEY") or "").strip()
    if not key:
        raise RuntimeError("RAPIDAPI_KEY not configured in Backend/.env")
    return {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
        "Content-Type": "application/json",
    }


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_exercise_ids() -> list[str]:
    path = DATA_DIR / "exercises.json"
    if not path.exists():
        raise RuntimeError("Missing Backend/data/exercisedb/exercises.json. Run scrape first.")
    data = json.loads(path.read_text(encoding="utf-8"))
    out: list[str] = []
    for row in data:
        eid = str(row.get("id", "")).strip()
        if eid:
            out.append(eid)
    # Preserve API ordering but deduplicate.
    seen: set[str] = set()
    unique: list[str] = []
    for eid in out:
        if eid in seen:
            continue
        seen.add(eid)
        unique.append(eid)
    return unique


def _load_exercise_index() -> dict[str, dict[str, str]]:
    path = DATA_DIR / "exercises.json"
    if not path.exists():
        raise RuntimeError("Missing Backend/data/exercisedb/exercises.json. Run scrape first.")
    data = json.loads(path.read_text(encoding="utf-8"))
    index: dict[str, dict[str, str]] = {}
    for row in data:
        eid = str(row.get("id", "")).strip()
        if not eid:
            continue
        index[eid] = {
            "id": eid,
            "name_en": str(row.get("name", "")).strip(),
            "bodyPart": str(row.get("bodyPart", "")).strip(),
            "target": str(row.get("target", "")).strip(),
            "equipment": str(row.get("equipment", "")).strip(),
        }
    return index


def _write_id_name_map(exercise_index: dict[str, dict[str, str]]) -> None:
    existing_name_es: dict[str, str] = {}
    if ID_NAME_MAP_PATH.exists():
        try:
            existing_rows = json.loads(ID_NAME_MAP_PATH.read_text(encoding="utf-8"))
            for row in existing_rows:
                eid = str(row.get("id", "")).strip()
                name_es = str(row.get("name_es", "")).strip()
                if eid and name_es:
                    existing_name_es[eid] = name_es
        except Exception:
            pass

    rows: list[dict[str, str]] = []
    for eid in sorted(exercise_index.keys()):
        base = dict(exercise_index[eid])
        if eid in existing_name_es:
            base["name_es"] = existing_name_es[eid]
        rows.append(base)
    ID_NAME_MAP_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def _write_media_inventory(
    exercise_index: dict[str, dict[str, str]],
    recent_log: list[dict[str, Any]] | None = None,
) -> None:
    recent_log = recent_log or _read_recent_log_entries()
    last_by_id: dict[str, dict[str, Any]] = {}
    for item in recent_log:
        eid = str(item.get("exercise_id", "")).strip()
        if eid:
            last_by_id[eid] = item

    rows: list[dict[str, Any]] = []
    for eid in sorted(exercise_index.keys()):
        backend_gif = GIFS_DIR / f"{eid}.gif"
        frontend_gif = FRONTEND_GIFS_DIR / f"{eid}.gif"
        last = last_by_id.get(eid, {})
        rows.append(
            {
                **exercise_index[eid],
                "backend_gif_exists": backend_gif.exists(),
                "frontend_gif_exists": frontend_gif.exists(),
                "last_status": last.get("status"),
                "last_detail": last.get("detail"),
                "last_attempt_at": last.get("ts"),
            }
        )

    MEDIA_INVENTORY_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_state(total_ids: int) -> dict[str, Any]:
    if not STATE_PATH.exists():
        return {"cursor": 0, "total_ids": total_ids, "updated_at": _utc_now_iso()}
    try:
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"cursor": 0, "total_ids": total_ids, "updated_at": _utc_now_iso()}
    cursor = int(state.get("cursor", 0))
    if cursor < 0:
        cursor = 0
    if total_ids > 0:
        cursor = cursor % total_ids
    state["cursor"] = cursor
    state["total_ids"] = total_ids
    return state


def _save_state(state: dict[str, Any]) -> None:
    state["updated_at"] = _utc_now_iso()
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def _append_log(entry: dict[str, Any]) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _write_status_report(last_entries: list[dict[str, Any]]) -> None:
    lines: list[str] = []
    lines.append(f"Updated: {_utc_now_iso()}")
    lines.append("Format: timestamp | exercise_id | status | detail")
    lines.append("")
    for item in last_entries[-80:]:
        lines.append(
            f"{item.get('ts','?')} | {item.get('exercise_id','-')} | "
            f"{item.get('status','-')} | {item.get('detail','')}"
        )
    STATUS_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _read_recent_log_entries(max_entries: int = 5000) -> list[dict[str, Any]]:
    if not LOG_PATH.exists():
        return []
    rows: list[dict[str, Any]] = []
    with LOG_PATH.open("r", encoding="utf-8") as fp:
        for raw in fp:
            raw = raw.strip()
            if not raw:
                continue
            try:
                rows.append(json.loads(raw))
            except Exception:
                continue
    return rows[-max_entries:]


def _copy_to_frontend(eid: str) -> None:
    src = GIFS_DIR / f"{eid}.gif"
    if not src.exists():
        return
    FRONTEND_GIFS_DIR.mkdir(parents=True, exist_ok=True)
    dst = FRONTEND_GIFS_DIR / src.name
    shutil.copy2(src, dst)


def _regenerate_frontend_media_index() -> None:
    FRONTEND_GIFS_DIR.mkdir(parents=True, exist_ok=True)
    ids = sorted(path.stem for path in FRONTEND_GIFS_DIR.glob("*.gif"))
    lines = ["export const EXERCISEDB_LOCAL_MEDIA_IDS = new Set<string>(["]
    lines.extend(f"  '{eid}'," for eid in ids)
    lines.append("]);")
    lines.append("")
    FRONTEND_MEDIA_INDEX.parent.mkdir(parents=True, exist_ok=True)
    FRONTEND_MEDIA_INDEX.write_text("\n".join(lines), encoding="utf-8")


def _sleep_interval(minutes: int) -> None:
    wait = max(1, int(minutes * 60))
    print(f"[WAIT] sleeping {wait}s until next batch")
    time.sleep(wait)


def _parse_wait_seconds(resp: httpx.Response) -> int | None:
    retry_after = (resp.headers.get("Retry-After") or "").strip()
    if retry_after.isdigit():
        return max(1, int(retry_after))

    # RapidAPI often sends reset seconds in custom headers.
    reset = (resp.headers.get("x-ratelimit-requests-reset") or "").strip()
    if reset.isdigit():
        # This value is provider-dependent; clamp to avoid absurd waits.
        return max(60, min(int(reset), 24 * 3600))
    return None


def _download_one(client: httpx.Client, eid: str, resolution: str) -> dict[str, Any]:
    out: dict[str, Any] = {"ts": _utc_now_iso(), "exercise_id": eid}
    try:
        resp = client.get(
            f"{BASE}/image",
            headers=_headers(),
            params={"exerciseId": eid, "resolution": resolution},
            timeout=45.0,
        )
    except Exception as exc:  # noqa: BLE001
        out["status"] = "KO"
        out["detail"] = f"{type(exc).__name__}"
        return out

    if resp.status_code == 200:
        GIFS_DIR.mkdir(parents=True, exist_ok=True)
        dst = GIFS_DIR / f"{eid}.gif"
        dst.write_bytes(resp.content)
        _copy_to_frontend(eid)
        _regenerate_frontend_media_index()
        out["status"] = "OK"
        out["detail"] = f"saved {len(resp.content)} bytes"
        return out

    if resp.status_code == 429:
        wait_s = _parse_wait_seconds(resp) or 3600
        out["status"] = "WAIT"
        out["detail"] = f"429 rate-limit, wait {wait_s}s"
        out["wait_seconds"] = wait_s
        return out

    out["status"] = "KO"
    snippet = (resp.text or "").strip().replace("\n", " ")
    out["detail"] = f"HTTP {resp.status_code} {snippet[:180]}"
    return out


def run_hour_batch(
    *,
    ids: list[str],
    exercise_index: dict[str, dict[str, str]],
    state: dict[str, Any],
    per_hour: int,
    resolution: str,
) -> tuple[dict[str, Any], bool]:
    """
    Returns (new_state, should_wait_until_next_hour).
    """
    if not ids:
        raise RuntimeError("No exercise ids found in exercises.json")

    cursor = int(state.get("cursor", 0)) % len(ids)
    processed = 0
    should_wait_hour = True
    recent = _read_recent_log_entries()

    with httpx.Client(timeout=45.0, follow_redirects=True) as client:
        while processed < per_hour:
            eid = ids[cursor]
            cursor = (cursor + 1) % len(ids)

            # Distinct in this hour: we simply walk the queue cursor forward.
            # Skip if already downloaded locally.
            if (GIFS_DIR / f"{eid}.gif").exists():
                entry = {"ts": _utc_now_iso(), "exercise_id": eid, "status": "OK", "detail": "already local"}
                _append_log(entry)
                recent.append(entry)
                processed += 1
                continue

            entry = _download_one(client, eid, resolution)
            _append_log(entry)
            recent.append(entry)
            processed += 1

            status = entry.get("status")
            detail = entry.get("detail", "")
            print(f"[{status}] {eid} - {detail}")

            if status == "WAIT":
                wait_s = int(entry.get("wait_seconds", 3600))
                _write_status_report(recent)
                state["cursor"] = cursor
                _save_state(state)
                print(f"[WAIT] sleeping {wait_s}s due to provider limit")
                time.sleep(wait_s)
                should_wait_hour = False
                break

            # Small spacing to avoid burst behavior.
            time.sleep(1.0)

    state["cursor"] = cursor
    _save_state(state)
    _write_status_report(recent)
    _write_media_inventory(exercise_index, recent)
    return state, should_wait_hour


def main() -> None:
    parser = argparse.ArgumentParser(description="Interval media downloader for ExerciseDB")
    parser.add_argument("--per-batch", type=int, default=DEFAULT_PER_BATCH, help="Distinct requests per batch")
    parser.add_argument(
        "--interval-minutes",
        type=int,
        default=DEFAULT_INTERVAL_MINUTES,
        help="Minutes between batches (default 60)",
    )
    parser.add_argument("--resolution", default="180", choices=["180", "360", "720", "1080"])
    parser.add_argument("--once", action="store_true", help="Run one batch and exit")
    parser.add_argument("--run-forever", action="store_true", help="Run indefinitely")
    args = parser.parse_args()

    if not args.once and not args.run_forever:
        parser.error("Choose --once or --run-forever")
    if args.per_batch <= 0:
        parser.error("--per-batch must be > 0")
    if args.interval_minutes <= 0:
        parser.error("--interval-minutes must be > 0")

    ids = _load_exercise_ids()
    exercise_index = _load_exercise_index()
    _write_id_name_map(exercise_index)
    _write_media_inventory(exercise_index)
    state = _load_state(total_ids=len(ids))

    print(
        f"Starting media sync | ids={len(ids)} | per_batch={args.per_batch} | interval_min={args.interval_minutes} | "
        f"cursor={state.get('cursor', 0)}"
    )

    if args.once:
        run_hour_batch(
            ids=ids,
            exercise_index=exercise_index,
            state=state,
            per_hour=args.per_batch,
            resolution=args.resolution,
        )
        print("Done (--once).")
        return

    while True:
        state, should_wait_hour = run_hour_batch(
            ids=ids,
            exercise_index=exercise_index,
            state=state,
            per_hour=args.per_batch,
            resolution=args.resolution,
        )
        if should_wait_hour:
            _sleep_interval(args.interval_minutes)


if __name__ == "__main__":
    main()

