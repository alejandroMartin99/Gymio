from fastapi import APIRouter, HTTPException

from app.api.schemas.workouts import (
    AddExerciseRequest,
    AddSetRequest,
    CreateWorkoutRecordRequest,
    ExerciseSet,
    StartWorkoutSessionRequest,
    WorkoutExercise,
)
from app.services.workouts.record_store import workout_record_store
from app.services.workouts.session_store import workout_session_store

router = APIRouter()


@router.get("")
def list_workouts() -> dict[str, bool | list[dict[str, str]] | int]:
    data: list[dict[str, str]] = []
    return {"success": True, "data": data, "count": len(data)}


@router.get("/records")
def list_workout_records() -> dict[str, bool | object | int]:
    data = workout_record_store.list_records()
    return {"success": True, "data": data, "count": len(data)}


@router.get("/records/latest")
def latest_workout_record() -> dict[str, bool | object | None]:
    return {"success": True, "data": workout_record_store.get_last_record()}


@router.post("/records")
def create_workout_record(payload: CreateWorkoutRecordRequest) -> dict[str, bool | object]:
    if not payload.workout_name.strip():
        raise HTTPException(status_code=400, detail="workout_name is required")
    if len(payload.routine_types) == 0:
        raise HTTPException(status_code=400, detail="At least one routine type is required")
    created = workout_record_store.create_record(payload)
    return {"success": True, "data": created}


@router.get("/sessions/active")
def get_active_session() -> dict[str, bool | object | None]:
    return {"success": True, "data": workout_session_store.get_active()}


@router.post("/sessions/start")
def start_session(payload: StartWorkoutSessionRequest) -> dict[str, bool | object]:
    session = workout_session_store.start(
        routine_name=payload.routine_name,
        routine_category=payload.routine_category,
        load_previous=payload.load_previous,
    )
    return {"success": True, "data": session}


@router.post("/sessions/{session_id}/finish")
def finish_session(session_id: str) -> dict[str, bool | object]:
    session = workout_session_store.finish(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")
    return {"success": True, "data": session}


@router.post("/sessions/{session_id}/exercises")
def add_exercise(session_id: str, payload: AddExerciseRequest) -> dict[str, bool | object]:
    created = workout_session_store.add_exercise(
        session_id,
        WorkoutExercise(name=payload.name, muscle_group=payload.muscle_group, notes=payload.notes),
    )
    if not created:
        raise HTTPException(status_code=404, detail="Active session not found")
    return {"success": True, "data": created}


@router.post("/sessions/{session_id}/exercises/{exercise_id}/sets")
def add_set(session_id: str, exercise_id: str, payload: AddSetRequest) -> dict[str, bool | object]:
    created = workout_session_store.add_set(
        session_id,
        exercise_id,
        ExerciseSet(
            set_type=payload.set_type,
            target_reps=payload.target_reps,
            done_reps=payload.done_reps,
            weight=payload.weight,
            unit=payload.unit,
            comment=payload.comment,
            assisted_reps=payload.assisted_reps,
            rpe=payload.rpe,
        ),
    )
    if not created:
        raise HTTPException(status_code=404, detail="Session or exercise not found")
    return {"success": True, "data": created}
