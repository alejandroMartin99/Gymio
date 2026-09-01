"""ExerciseDB local — datos pre-descargados, cero llamadas a red."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse

from app.core.auth import get_current_user_id

router = APIRouter()

_DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "exercisedb"
_GIFS_DIR = _DATA_DIR / "gifs"

_loaded = False
_exercises: list[dict[str, Any]] = []
_body_parts: list[str] = []
_targets: list[str] = []
_by_id: dict[str, dict[str, Any]] = {}
_by_body_part: dict[str, list[dict[str, Any]]] = {}
_by_target: dict[str, list[dict[str, Any]]] = {}
_name_lookup: dict[str, tuple[str, str]] = {}


def _ensure_loaded() -> None:
    global _loaded, _exercises, _body_parts, _targets, _by_id, _by_body_part, _by_target, _name_lookup
    if _loaded:
        return
    _loaded = True

    ex_path = _DATA_DIR / "exercises.json"
    if not ex_path.exists():
        return

    raw: list[dict[str, Any]] = json.loads(ex_path.read_text(encoding="utf-8"))

    _exercises = raw

    bp_path = _DATA_DIR / "body_parts.json"
    if bp_path.exists():
        _body_parts = json.loads(bp_path.read_text(encoding="utf-8"))

    tgt_path = _DATA_DIR / "targets.json"
    if tgt_path.exists():
        _targets = json.loads(tgt_path.read_text(encoding="utf-8"))

    for ex in raw:
        eid = str(ex["id"])
        _by_id[eid] = ex

        name_key = " ".join((ex.get("name") or "").strip().lower().split())
        bp = (ex.get("bodyPart") or "").strip().lower()
        tgt = (ex.get("target") or "").strip().lower()

        if bp:
            _by_body_part.setdefault(bp, []).append(ex)
        if tgt:
            _by_target.setdefault(tgt, []).append(ex)
        if name_key and bp:
            _name_lookup[name_key] = (ex["bodyPart"], tgt)


def get_body_part_lookup() -> dict[str, tuple[str, str]]:
    """Shared lookup used by workouts router — avoids duplicate JSON load."""
    _ensure_loaded()
    return _name_lookup


def _require_data() -> None:
    _ensure_loaded()
    if not _exercises:
        raise HTTPException(
            status_code=503,
            detail="No hay datos locales de ExerciseDB. Ejecuta: cd Backend && python -m scripts.scrape_exercisedb",
        )


@router.get("/exercises")
def list_exercises(
    user_id: str = Depends(get_current_user_id),
    offset: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=200),
    body_part: str | None = Query(None),
    target: str | None = Query(None),
) -> dict[str, Any]:
    _require_data()

    if body_part and body_part.strip() and target and target.strip():
        raise HTTPException(status_code=400, detail="Usa solo uno: body_part o target.")

    if body_part and body_part.strip():
        pool = _by_body_part.get(body_part.strip().lower(), [])
    elif target and target.strip():
        pool = _by_target.get(target.strip().lower(), [])
    else:
        pool = _exercises

    page = pool[offset : offset + limit]
    return {"success": True, "data": page, "count": len(page)}


@router.get("/search")
def search_exercises_by_name(
    name: str = Query(..., min_length=1),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _require_data()
    q = name.strip().lower()
    results = [ex for ex in _exercises if q in ex.get("name", "").lower()]
    return {"success": True, "data": results, "count": len(results)}


@router.get("/targets")
def target_list(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    _ensure_loaded()
    data = _targets or [
        "abductors", "abs", "adductors", "biceps", "calves",
        "cardiovascular system", "delts", "forearms", "glutes",
        "hamstrings", "lats", "levator scapulae", "pectorals",
        "quads", "serratus anterior", "spine", "traps", "triceps",
        "upper back",
    ]
    return {"success": True, "data": data, "count": len(data)}


@router.get("/exercises/{exercise_id}")
def get_exercise(
    exercise_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    _require_data()
    ex = _by_id.get(exercise_id.strip())
    if ex is None:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")
    return {"success": True, "data": ex}


@router.get("/body-parts")
def body_parts(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    _ensure_loaded()
    data = _body_parts or [
        "back", "cardio", "chest", "lower arms", "lower legs",
        "neck", "shoulders", "upper arms", "upper legs", "waist",
    ]
    return {"success": True, "data": data, "count": len(data)}


@router.get("/media/{exercise_id}")
def exercise_media(
    exercise_id: str,
    user_id: str = Depends(get_current_user_id),
    resolution: str = Query("180"),
) -> FileResponse:
    eid = exercise_id.strip()
    gif_path = _GIFS_DIR / f"{eid}.gif"
    if not gif_path.exists():
        raise HTTPException(status_code=404, detail="GIF no encontrado localmente")
    return FileResponse(gif_path, media_type="image/gif")
