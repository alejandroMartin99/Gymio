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
    updated = (
        client.table("workout_records")
        .update({"workout_name": workout_name})
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
