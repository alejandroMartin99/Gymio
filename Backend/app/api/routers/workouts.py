from fastapi import APIRouter, Depends, HTTPException
import re
import unicodedata
from postgrest.exceptions import APIError

from app.api.schemas.workouts import (
    AddExerciseRequest,
    AddSetRequest,
    CreateWorkoutRecordRequest,
    UpdateSetRequest,
    UpdateWorkoutRecordRequest,
    UpdateExerciseNotesRequest,
)
from app.core.auth import get_current_user_id
from app.services.supabase.supabase_service import get_supabase_service_client

router = APIRouter()


@router.get("")
def list_workouts() -> dict[str, bool | list[dict[str, str]] | int]:
    data: list[dict[str, str]] = []
    return {"success": True, "data": data, "count": len(data)}


@router.get("/records")
def list_workout_records(user_id: str = Depends(get_current_user_id)) -> dict[str, bool | object | int]:
    client = get_supabase_service_client()
    result = (
        client.table("workout_records")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    data = result.data or []
    return {"success": True, "data": data, "count": len(data)}


@router.get("/records/latest")
def latest_workout_record(user_id: str = Depends(get_current_user_id)) -> dict[str, bool | object | None]:
    client = get_supabase_service_client()
    result = (
        client.table("workout_records")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    data = result.data[0] if result.data else None
    return {"success": True, "data": data}


@router.get("/records/{workout_id}")
def workout_record_detail(workout_id: str, user_id: str = Depends(get_current_user_id)) -> dict[str, bool | object]:
    client = get_supabase_service_client()
    detail = _build_workout_detail(client, user_id, workout_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Workout not found")
    return {"success": True, "data": detail}


@router.post("/records")
def create_workout_record(
    payload: CreateWorkoutRecordRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, bool | object]:
    client = get_supabase_service_client()
    latest = _get_latest_record(client, user_id)

    if payload.replicate_from_id:
        source_detail = _build_workout_detail(client, user_id, payload.replicate_from_id)
        if not source_detail:
            raise HTTPException(status_code=404, detail="Source workout not found")
        source_name = source_detail["workout_name"]
        created = _insert_record(
            client,
            user_id,
            source_name,
            source_detail.get("routine_types") or [],
        )
        _copy_exercises_and_sets(client, user_id, payload.replicate_from_id, created["id"])
        return {"success": True, "data": created}

    if payload.replicate_latest and latest:
        created = _insert_record(client, user_id, latest["workout_name"], latest.get("routine_types") or [])
        _copy_exercises_and_sets(client, user_id, latest["id"], created["id"])
        return {"success": True, "data": created}

    workout_name = (payload.workout_name or "").strip()
    if not workout_name:
        raise HTTPException(status_code=400, detail="workout_name is required")
    created = _insert_record(client, user_id, workout_name, payload.routine_types, payload.notes)
    return {"success": True, "data": created}


@router.post("/records/{workout_id}/exercises")
def add_exercise(
    workout_id: str,
    payload: AddExerciseRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, bool | object]:
    client = get_supabase_service_client()
    position = _next_exercise_position(client, workout_id)
    row: dict = {
        "workout_id": workout_id,
        "user_id": user_id,
        "name": payload.name,
        "muscle_group": payload.muscle_group,
        "notes": payload.notes,
        "position": position,
    }
    if payload.external_exercise_id:
        row["external_exercise_id"] = payload.external_exercise_id.strip()
    if payload.exercise_detail is not None:
        row["exercise_detail"] = payload.exercise_detail

    result = client.table("workout_exercises").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Unable to add exercise")
    return {"success": True, "data": result.data[0]}


@router.post("/records/{workout_id}/exercises/{exercise_id}/sets")
def add_set(
    workout_id: str,
    exercise_id: str,
    payload: AddSetRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, bool | object]:
    client = get_supabase_service_client()
    position = _next_set_position(client, exercise_id)
    result = (
        client.table("exercise_sets")
        .insert(
            {
                "workout_id": workout_id,
                "workout_exercise_id": exercise_id,
                "user_id": user_id,
                "set_type": payload.set_type,
                "target_reps": payload.target_reps,
                "done_reps": payload.done_reps,
                "weight": payload.weight,
                "unit": payload.unit,
                "comment": payload.comment,
                "assisted_reps": payload.assisted_reps,
                "rpe": payload.rpe,
                "position": position,
            }
        )
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=400, detail="Unable to add set")
    return {"success": True, "data": result.data[0]}


@router.patch("/records/{workout_id}/exercises/{exercise_id}")
def update_exercise_notes(
    workout_id: str,
    exercise_id: str,
    payload: UpdateExerciseNotesRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, bool | object]:
    client = get_supabase_service_client()
    updated = (
        client.table("workout_exercises")
        .update({"notes": payload.notes})
        .eq("id", exercise_id)
        .eq("workout_id", workout_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not updated.data:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return {"success": True, "data": updated.data[0]}


@router.delete("/records/{workout_id}/exercises/{exercise_id}/sets/{set_id}")
def delete_set(
    workout_id: str,
    exercise_id: str,
    set_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, bool]:
    client = get_supabase_service_client()
    existing = (
        client.table("exercise_sets")
        .select("id")
        .eq("id", set_id)
        .eq("workout_id", workout_id)
        .eq("workout_exercise_id", exercise_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Set not found")
    client.table("exercise_sets").delete().eq("id", set_id).eq("user_id", user_id).execute()
    return {"success": True}


@router.patch("/records/{workout_id}/exercises/{exercise_id}/sets/{set_id}")
def update_set(
    workout_id: str,
    exercise_id: str,
    set_id: str,
    payload: UpdateSetRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, bool | object]:
    client = get_supabase_service_client()
    existing = (
        client.table("exercise_sets")
        .select("id")
        .eq("id", set_id)
        .eq("workout_id", workout_id)
        .eq("workout_exercise_id", exercise_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Set not found")
    updates = {
        "done_reps": payload.done_reps,
        "weight": payload.weight,
        "comment": payload.comment,
    }
    updated = (
        client.table("exercise_sets")
        .update(updates)
        .eq("id", set_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not updated.data:
        raise HTTPException(status_code=400, detail="Unable to update set")
    return {"success": True, "data": updated.data[0]}


@router.get("/stats")
def workout_stats(user_id: str = Depends(get_current_user_id)) -> dict:
    from datetime import datetime, timedelta, timezone

    client = get_supabase_service_client()

    records_res = (
        client.table("workout_records")
        .select("id, created_at, workout_name")
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    )
    record_rows = records_res.data or []

    if not record_rows:
        return {"success": True, "data": _empty_stats()}

    ex_res = (
        client.table("workout_exercises")
        .select("id, workout_id, name, muscle_group")
        .eq("user_id", user_id)
        .execute()
    )
    ex_rows = ex_res.data or []

    set_res = (
        client.table("exercise_sets")
        .select("workout_exercise_id, weight, done_reps")
        .eq("user_id", user_id)
        .execute()
    )
    set_rows = set_res.data or []

    # Lookup maps
    sets_by_ex: dict[str, list] = {}
    for s in set_rows:
        eid = s.get("workout_exercise_id", "")
        if eid:
            sets_by_ex.setdefault(eid, []).append(s)

    sets_count_by_workout: dict[str, int] = {}
    for ex in ex_rows:
        wid = ex.get("workout_id", "")
        if not wid:
            continue
        for s in sets_by_ex.get(ex["id"], []):
            sets_count_by_workout[wid] = sets_count_by_workout.get(wid, 0) + 1

    record_date_map: dict[str, datetime] = {}
    for r in record_rows:
        ts_str = r.get("created_at", "")
        if not ts_str:
            continue
        try:
            record_date_map[r["id"]] = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except ValueError:
            pass

    # Sessions per week — from 2026-01-01 to now, with start_date for month axis
    now_utc = datetime.now(timezone.utc)
    year_start = datetime(2026, 1, 6, tzinfo=timezone.utc)  # first Monday ≥ 2026-01-01
    sessions_per_week = []
    week_start = year_start
    while week_start < now_utc:
        week_end = week_start + timedelta(weeks=1)
        count = sum(
            1 for r in record_rows
            if r["id"] in record_date_map and week_start <= record_date_map[r["id"]] < week_end
        )
        sessions_per_week.append({
            "label": week_start.strftime("W%V"),
            "start_date": week_start.strftime("%Y-%m-%d"),
            "count": count,
        })
        week_start = week_end

    # Top exercises by frequency
    ex_freq: dict[str, dict] = {}
    ex_max_weight: dict[str, float] = {}
    for ex in ex_rows:
        norm = _normalize_name(ex.get("name", ""))
        if not norm:
            continue
        if norm not in ex_freq:
            ex_freq[norm] = {"display": ex.get("name", norm), "count": 0}
        ex_freq[norm]["count"] += 1
        for s in sets_by_ex.get(ex["id"], []):
            w = float(s.get("weight") or 0)
            if w > ex_max_weight.get(norm, 0.0):
                ex_max_weight[norm] = w
    top_exercises = sorted(ex_freq.values(), key=lambda x: x["count"], reverse=True)[:7]
    for t in top_exercises:
        t["max_weight"] = ex_max_weight.get(_normalize_name(t["display"]), 0.0)

    # Muscle group breakdown
    muscle_counts: dict[str, int] = {}
    for ex in ex_rows:
        mg = (ex.get("muscle_group") or "Otros").strip() or "Otros"
        muscle_counts[mg] = muscle_counts.get(mg, 0) + 1
    muscle_breakdown = sorted(
        [{"group": k, "count": v} for k, v in muscle_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:8]

    # Week-based streaks
    unique_dates = sorted(set(r["created_at"][:10] for r in record_rows if r.get("created_at")))
    current_streak_weeks, max_streak_weeks = _compute_week_streaks(unique_dates)

    # Progress by exercise — current 14 days vs previous 14 days
    cutoff_current = now_utc - timedelta(days=14)
    cutoff_previous = now_utc - timedelta(days=28)

    ex_progress: dict[str, dict] = {}
    for ex in ex_rows:
        norm = _normalize_name(ex.get("name", ""))
        if not norm:
            continue
        wid = ex.get("workout_id", "")
        workout_ts = record_date_map.get(wid)
        if workout_ts is None:
            continue
        mg = (ex.get("muscle_group") or "Otros").strip() or "Otros"
        if norm not in ex_progress:
            ex_progress[norm] = {
                "display": ex.get("name", norm),
                "muscle_group": mg,
                "current_max": 0.0,
                "prev_max": 0.0,
            }
        for s in sets_by_ex.get(ex["id"], []):
            w = float(s.get("weight") or 0)
            if w <= 0:
                continue
            if workout_ts >= cutoff_current:
                ex_progress[norm]["current_max"] = max(ex_progress[norm]["current_max"], w)
            elif workout_ts >= cutoff_previous:
                ex_progress[norm]["prev_max"] = max(ex_progress[norm]["prev_max"], w)

    # Build full history per normalized exercise name (all time)
    ex_history_map: dict[str, dict[str, dict]] = {}  # norm -> {date -> {max_weight, max_reps_at_max}}
    for ex in ex_rows:
        norm = _normalize_name(ex.get("name", ""))
        if not norm:
            continue
        wid = ex.get("workout_id", "")
        workout_ts = record_date_map.get(wid)
        if workout_ts is None:
            continue
        date_str = workout_ts.strftime("%Y-%m-%d")
        if norm not in ex_history_map:
            ex_history_map[norm] = {}
        day = ex_history_map[norm].setdefault(date_str, {"max_weight": 0.0, "max_reps": 0})
        for s in sets_by_ex.get(ex["id"], []):
            w = float(s.get("weight") or 0)
            r = int(s.get("done_reps") or 0)
            if w > day["max_weight"]:
                day["max_weight"] = w
                day["max_reps"] = r
            elif w == day["max_weight"] and r > day["max_reps"]:
                day["max_reps"] = r

    progress_by_muscle_map: dict[str, list] = {}
    for norm, data in ex_progress.items():
        if data["current_max"] <= 0:
            continue
        mg = data["muscle_group"]
        if mg not in progress_by_muscle_map:
            progress_by_muscle_map[mg] = []
        change_pct: float | None = None
        if data["prev_max"] > 0:
            change_pct = round(((data["current_max"] - data["prev_max"]) / data["prev_max"]) * 100, 1)
        # Build history_points for this exercise (all time)
        day_map = ex_history_map.get(norm, {})
        history_points = sorted(
            [{"date": d, "max_weight": v["max_weight"], "max_reps": v["max_reps"]}
             for d, v in day_map.items() if v["max_weight"] > 0],
            key=lambda x: x["date"],
        )
        all_time_min = min((p["max_weight"] for p in history_points), default=None)
        change_vs_min_pct: float | None = None
        if all_time_min and all_time_min > 0 and data["current_max"] > all_time_min:
            change_vs_min_pct = round(((data["current_max"] - all_time_min) / all_time_min) * 100, 1)
        progress_by_muscle_map[mg].append({
            "display": data["display"],
            "current_max": data["current_max"],
            "prev_max": data["prev_max"],
            "change_pct": change_pct,
            "all_time_min": all_time_min,
            "change_vs_min_pct": change_vs_min_pct,
            "history_points": history_points,
        })

    for exlist in progress_by_muscle_map.values():
        exlist.sort(key=lambda x: (x["change_pct"] or 0, x["current_max"]), reverse=True)

    progress_by_muscle = sorted(
        [{"muscle_group": k, "exercises": v[:5]} for k, v in progress_by_muscle_map.items()],
        key=lambda x: sum(e["current_max"] for e in x["exercises"]),
        reverse=True,
    )[:6]

    total_sets = sum(sets_count_by_workout.values())

    # Monthly persistence — target: 4 sessions/week
    monthly_persistence = _compute_monthly_persistence(record_rows)

    return {
        "success": True,
        "data": {
            "sessions_per_week": sessions_per_week,
            "muscle_breakdown": muscle_breakdown,
            "progress_by_muscle": progress_by_muscle,
            "monthly_persistence": monthly_persistence,
            "totals": {
                "sessions": len(record_rows),
                "sets": total_sets,
                "current_streak_weeks": current_streak_weeks,
                "max_streak_weeks": max_streak_weeks,
                "unique_days": len(unique_dates),
            },
        },
    }


def _compute_monthly_persistence(record_rows: list[dict]) -> dict:
    from datetime import date, timedelta
    import calendar as cal

    today = date.today()
    SESSIONS_PER_WEEK_TARGET = 4

    def month_sessions(year: int, month: int) -> int:
        start = date(year, month, 1).isoformat()
        last_day = cal.monthrange(year, month)[1]
        end = date(year, month, last_day).isoformat()
        return sum(1 for r in record_rows if start <= (r.get("created_at") or "")[:10] <= end)

    def month_target(year: int, month: int, cap_to_today: bool) -> float:
        start = date(year, month, 1)
        last_day = cal.monthrange(year, month)[1]
        end = date(year, month, last_day)
        if cap_to_today:
            end = min(end, today)
        days = (end - start).days + 1
        return (days / 7) * SESSIONS_PER_WEEK_TARGET

    def month_label(year: int, month: int) -> str:
        return date(year, month, 1).strftime("%B %Y")

    # Current month
    cy, cm = today.year, today.month
    curr_sessions = month_sessions(cy, cm)
    curr_target = month_target(cy, cm, cap_to_today=True)
    curr_pct = round(min(100.0, curr_sessions / max(curr_target, 1) * 100), 1)

    # Previous month
    if cm == 1:
        py, pm = cy - 1, 12
    else:
        py, pm = cy, cm - 1
    prev_sessions = month_sessions(py, pm)
    prev_target = month_target(py, pm, cap_to_today=False)
    prev_pct = round(min(100.0, prev_sessions / max(prev_target, 1) * 100), 1)

    return {
        "current_pct": curr_pct,
        "prev_pct": prev_pct,
        "current_sessions": curr_sessions,
        "prev_sessions": prev_sessions,
        "current_month": month_label(cy, cm),
        "prev_month": month_label(py, pm),
        "change_pct": round(curr_pct - prev_pct, 1),
    }


def _compute_week_streaks(sorted_unique_dates: list[str]) -> tuple[int, int]:
    from datetime import date, timedelta

    if not sorted_unique_dates:
        return 0, 0

    dates = [date.fromisoformat(d) for d in sorted_unique_dates]

    def iso_week(d: date) -> tuple[int, int]:
        iso = d.isocalendar()
        return (iso[0], iso[1])

    weeks_trained = sorted(set(iso_week(d) for d in dates))

    if not weeks_trained:
        return 0, 0

    # Max consecutive-week streak
    max_streak = 1
    cur = 1
    for i in range(1, len(weeks_trained)):
        y1, w1 = weeks_trained[i - 1]
        y2, w2 = weeks_trained[i]
        d1 = date.fromisocalendar(y1, w1, 1)
        d2 = date.fromisocalendar(y2, w2, 1)
        if (d2 - d1).days == 7:
            cur += 1
            if cur > max_streak:
                max_streak = cur
        else:
            cur = 1

    # Current streak
    today = date.today()
    week_set = set(weeks_trained)
    anchor = iso_week(today)
    if anchor not in week_set:
        anchor = iso_week(today - timedelta(days=7))
    if anchor not in week_set:
        return 0, max_streak

    current_streak = 0
    ay, aw = anchor
    d = date.fromisocalendar(ay, aw, 1)
    while iso_week(d) in week_set:
        current_streak += 1
        d -= timedelta(days=7)

    return current_streak, max_streak


def _empty_stats() -> dict:
    return {
        "sessions_per_week": [],
        "muscle_breakdown": [],
        "progress_by_muscle": [],
        "monthly_persistence": {
            "current_pct": 0.0, "prev_pct": 0.0,
            "current_sessions": 0, "prev_sessions": 0,
            "current_month": "", "prev_month": "", "change_pct": 0.0,
        },
        "totals": {
            "sessions": 0, "sets": 0,
            "current_streak_weeks": 0, "max_streak_weeks": 0, "unique_days": 0,
        },
    }


@router.delete("/records/{workout_id}/exercises/{exercise_id}")
def delete_exercise(
    workout_id: str,
    exercise_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, bool]:
    client = get_supabase_service_client()
    existing = (
        client.table("workout_exercises")
        .select("id")
        .eq("id", exercise_id)
        .eq("workout_id", workout_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Exercise not found")

    client.table("workout_exercises").delete().eq("id", exercise_id).eq("user_id", user_id).execute()
    return {"success": True}


@router.delete("/records/{workout_id}")
def delete_workout_record(workout_id: str, user_id: str = Depends(get_current_user_id)) -> dict[str, bool]:
    client = get_supabase_service_client()
    existing = (
        client.table("workout_records")
        .select("id")
        .eq("id", workout_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Workout not found")
    client.table("workout_records").delete().eq("id", workout_id).eq("user_id", user_id).execute()
    return {"success": True}


@router.patch("/records/{workout_id}")
def update_workout_record(
    workout_id: str,
    payload: UpdateWorkoutRecordRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, bool | object]:
    client = get_supabase_service_client()
    workout_name = (payload.workout_name or "").strip()
    if not workout_name:
        raise HTTPException(status_code=400, detail="workout_name is required")
    updates: dict = {"workout_name": workout_name}
    if payload.trained_at is not None:
        updates["created_at"] = payload.trained_at.isoformat()
    updated = (
        client.table("workout_records")
        .update(updates)
        .eq("id", workout_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not updated.data:
        raise HTTPException(status_code=404, detail="Workout not found")
    return {"success": True, "data": updated.data[0]}


def _get_latest_record(client, user_id: str) -> dict | None:
    latest = (
        client.table("workout_records")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return latest.data[0] if latest.data else None


def _insert_record(client, user_id: str, workout_name: str, routine_types: list[str], notes: str | None = None) -> dict:
    try:
        inserted = (
            client.table("workout_records")
            .insert(
                {
                    "user_id": user_id,
                    "workout_name": workout_name,
                    "routine_types": routine_types,
                    "notes": notes,
                }
            )
            .execute()
        )
    except APIError as error:
        # Fallback for environments that still keep old unique constraints on workout_name.
        if "duplicate key value violates unique constraint" in str(error).lower():
            existing = _find_record_by_name(client, user_id, workout_name)
            if existing:
                return existing
        raise
    if not inserted.data:
        raise HTTPException(status_code=400, detail="Unable to create workout")
    return inserted.data[0]


def _find_record_by_name(client, user_id: str, workout_name: str) -> dict | None:
    target = _normalize_name(workout_name)
    if not target:
        return None
    records = (
        client.table("workout_records")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    for item in (records.data or []):
        if _normalize_name(item.get("workout_name")) == target:
            return item
    return None


def _copy_exercises_and_sets(client, user_id: str, from_workout_id: str, to_workout_id: str) -> None:
    old_exercises = (
        client.table("workout_exercises")
        .select("*")
        .eq("workout_id", from_workout_id)
        .order("position")
        .execute()
    )
    exercise_id_map: dict[str, str] = {}

    for old in old_exercises.data or []:
        insert_row: dict = {
            "workout_id": to_workout_id,
            "user_id": user_id,
            "name": old["name"],
            "muscle_group": old.get("muscle_group"),
            "notes": old.get("notes"),
            "position": old.get("position", 0),
        }
        if old.get("external_exercise_id"):
            insert_row["external_exercise_id"] = old["external_exercise_id"]
        if old.get("exercise_detail") is not None:
            insert_row["exercise_detail"] = old["exercise_detail"]
        new_ex = client.table("workout_exercises").insert(insert_row).execute()
        if not new_ex.data:
            continue
        exercise_id_map[old["id"]] = new_ex.data[0]["id"]

    # Template mode: when repeating a routine, copy only exercises.
    # Sets are intentionally not copied so the user confirms each new set with the check action.


def _next_exercise_position(client, workout_id: str) -> int:
    result = (
        client.table("workout_exercises")
        .select("position")
        .eq("workout_id", workout_id)
        .order("position", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return 1
    return int(result.data[0].get("position", 0)) + 1


def _next_set_position(client, exercise_id: str) -> int:
    result = (
        client.table("exercise_sets")
        .select("position")
        .eq("workout_exercise_id", exercise_id)
        .order("position", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return 1
    return int(result.data[0].get("position", 0)) + 1


def _build_workout_detail(client, user_id: str, workout_id: str) -> dict | None:
    record = (
        client.table("workout_records")
        .select("*")
        .eq("id", workout_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not record.data:
        return None

    workout = record.data[0]
    exercises = (
        client.table("workout_exercises")
        .select("*")
        .eq("workout_id", workout_id)
        .eq("user_id", user_id)
        .order("position")
        .execute()
    )
    exercise_list = exercises.data or []
    exercise_ids = [item["id"] for item in exercise_list]
    sets_data: list[dict] = []
    if exercise_ids:
        sets_query = (
            client.table("exercise_sets")
            .select("*")
            .in_("workout_exercise_id", exercise_ids)
            .eq("user_id", user_id)
            .order("position")
            .execute()
        )
        sets_data = sets_query.data or []

    sets_by_exercise: dict[str, list[dict]] = {}
    for set_item in sets_data:
        sets_by_exercise.setdefault(set_item["workout_exercise_id"], []).append(set_item)

    previous_sets_cache: dict[str, list[dict]] = {}
    enriched_exercises: list[dict] = []
    for exercise in exercise_list:
        name_key = _normalize_name(exercise.get("name"))
        if name_key not in previous_sets_cache:
            previous_sets_cache[name_key] = _previous_sets_for_exercise_name(
                client=client,
                user_id=user_id,
                current_workout_id=workout_id,
                exercise_name=exercise.get("name", ""),
            )
        enriched_exercises.append(
            {
                **exercise,
                "sets": sets_by_exercise.get(exercise["id"], []),
                "previous_sets": previous_sets_cache[name_key],
                "history_points": _history_points_for_exercise_name(
                    client=client,
                    user_id=user_id,
                    current_workout_id=workout_id,
                    exercise_name=exercise.get("name", ""),
                ),
            }
        )
    workout["exercises"] = enriched_exercises
    return workout


def _previous_sets_for_exercise_name(client, user_id: str, current_workout_id: str, exercise_name: str) -> list[dict]:
    if not exercise_name:
        return []
    target_name = _normalize_name(exercise_name)
    if not target_name:
        return []
    previous_exercises = (
        client.table("workout_exercises")
        .select("id, name")
        .eq("user_id", user_id)
        .neq("workout_id", current_workout_id)
        .execute()
    )
    rows = previous_exercises.data or []
    if not rows:
        return []
    previous_exercise_ids = [row["id"] for row in rows if _normalize_name(row.get("name")) == target_name]
    if not previous_exercise_ids:
        return []
    previous_sets = (
        client.table("exercise_sets")
        .select("*")
        .in_("workout_exercise_id", previous_exercise_ids)
        .eq("user_id", user_id)
        .order("position")
        .execute()
    )
    return previous_sets.data or []


def _normalize_name(value: str | None) -> str:
    raw = (value or "").strip().lower()
    if not raw:
        return ""
    normalized = unicodedata.normalize("NFKD", raw)
    without_accents = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", without_accents).strip()


def _history_points_for_exercise_name(client, user_id: str, current_workout_id: str, exercise_name: str) -> list[dict]:
    if not exercise_name:
        return []
    target_name = _normalize_name(exercise_name)
    if not target_name:
        return []
    previous_exercises = (
        client.table("workout_exercises")
        .select("id, workout_id, name")
        .eq("user_id", user_id)
        .neq("workout_id", current_workout_id)
        .execute()
    )
    rows = [row for row in (previous_exercises.data or []) if _normalize_name(row.get("name")) == target_name]
    if not rows:
        return []
    exercise_ids = [row["id"] for row in rows]
    workout_ids = list({row["workout_id"] for row in rows})

    sets_result = (
        client.table("exercise_sets")
        .select("workout_id, weight, done_reps, created_at, workout_exercise_id")
        .in_("workout_exercise_id", exercise_ids)
        .eq("user_id", user_id)
        .execute()
    )
    sets_rows = sets_result.data or []
    if not sets_rows:
        return []

    records_result = (
        client.table("workout_records")
        .select("id, created_at")
        .in_("id", workout_ids)
        .eq("user_id", user_id)
        .execute()
    )
    record_date_by_id = {row["id"]: row.get("created_at") for row in (records_result.data or [])}

    history_by_workout: dict[str, dict] = {}
    for row in sets_rows:
        workout_id = row.get("workout_id")
        if not workout_id:
            continue
        point = history_by_workout.setdefault(
            workout_id,
            {
                "workout_id": workout_id,
                "date": (record_date_by_id.get(workout_id) or row.get("created_at") or "")[:10],
                "max_weight": 0.0,
                "max_reps": 0,
            },
        )
        weight = float(row.get("weight") or 0.0)
        reps = int(row.get("done_reps") or 0)
        if weight > point["max_weight"]:
            point["max_weight"] = weight
        if reps > point["max_reps"]:
            point["max_reps"] = reps

    points = list(history_by_workout.values())
    points.sort(key=lambda item: item.get("date", ""))
    return points
