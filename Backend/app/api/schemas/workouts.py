from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class ExerciseSet(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    set_type: str = "normal"
    target_reps: int | None = None
    done_reps: int | None = None
    weight: float | None = None
    unit: Literal["kg", "lb"] = "kg"
    comment: str | None = None
    assisted_reps: int | None = None
    rpe: float | None = None


class WorkoutExercise(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    muscle_group: str | None = None
    notes: str | None = None
    sets: list[ExerciseSet] = Field(default_factory=list)


class WorkoutSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    status: Literal["active", "finished"] = "active"
    routine_name: str
    routine_category: str
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: datetime | None = None
    elapsed_seconds: int = 0
    exercises: list[WorkoutExercise] = Field(default_factory=list)


class StartWorkoutSessionRequest(BaseModel):
    routine_name: str = "Nueva sesion"
    routine_category: str = "Pecho"
    load_previous: bool = True


class AddExerciseRequest(BaseModel):
    name: str
    muscle_group: str | None = None
    notes: str | None = None
    external_exercise_id: str | None = None
    exercise_detail: dict | None = None


class AddSetRequest(BaseModel):
    set_type: str = "normal"
    target_reps: int | None = None
    done_reps: int | None = None
    weight: float | None = None
    unit: Literal["kg", "lb"] = "kg"
    comment: str | None = None
    assisted_reps: int | None = None
    rpe: float | None = None


class UpdateSetRequest(BaseModel):
    done_reps: int | None = None
    weight: float | None = None
    comment: str | None = None


class UpdateExerciseNotesRequest(BaseModel):
    notes: str | None = None


class UpdateWorkoutRecordRequest(BaseModel):
    workout_name: str
    trained_at: datetime | None = None


class WorkoutRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    workout_name: str
    routine_types: list[str]
    notes: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CreateWorkoutRecordRequest(BaseModel):
    workout_name: str | None = None
    routine_types: list[str] = Field(default_factory=list)
    notes: str | None = None
    replicate_latest: bool = False
    replicate_from_id: str | None = None
