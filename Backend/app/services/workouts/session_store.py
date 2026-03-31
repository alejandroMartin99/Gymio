from datetime import datetime, timezone

from app.api.schemas.workouts import ExerciseSet, WorkoutExercise, WorkoutSession


class WorkoutSessionStore:
    def __init__(self) -> None:
        self.active_session: WorkoutSession | None = None
        self.history: list[WorkoutSession] = []

    def get_active(self) -> WorkoutSession | None:
        return self.active_session

    def start(self, routine_name: str, routine_category: str, load_previous: bool) -> WorkoutSession:
        if self.active_session:
            return self.active_session

        exercises: list[WorkoutExercise] = []
        if load_previous:
            last = self._find_last_by_category(routine_category)
            if last:
                exercises = [
                    WorkoutExercise(
                        name=exercise.name,
                        muscle_group=exercise.muscle_group,
                        notes=exercise.notes,
                        sets=[
                            ExerciseSet(
                                set_type=set_item.set_type,
                                target_reps=set_item.target_reps,
                                done_reps=set_item.done_reps,
                                weight=set_item.weight,
                                unit=set_item.unit,
                                comment=set_item.comment,
                                assisted_reps=set_item.assisted_reps,
                                rpe=set_item.rpe,
                            )
                            for set_item in exercise.sets
                        ],
                    )
                    for exercise in last.exercises
                ]

        self.active_session = WorkoutSession(
            routine_name=routine_name,
            routine_category=routine_category,
            exercises=exercises,
        )
        return self.active_session

    def finish(self, session_id: str) -> WorkoutSession | None:
        if not self.active_session or self.active_session.id != session_id:
            return None

        ended_at = datetime.now(timezone.utc)
        started_at = self.active_session.started_at
        elapsed = int((ended_at - started_at).total_seconds())
        finished = self.active_session.model_copy(
            update={"status": "finished", "ended_at": ended_at, "elapsed_seconds": elapsed}
        )
        self.history.insert(0, finished)
        self.active_session = None
        return finished

    def add_exercise(self, session_id: str, exercise: WorkoutExercise) -> WorkoutExercise | None:
        if not self.active_session or self.active_session.id != session_id:
            return None
        self.active_session.exercises.append(exercise)
        return exercise

    def add_set(self, session_id: str, exercise_id: str, new_set: ExerciseSet) -> ExerciseSet | None:
        if not self.active_session or self.active_session.id != session_id:
            return None
        for exercise in self.active_session.exercises:
            if exercise.id == exercise_id:
                exercise.sets.append(new_set)
                return new_set
        return None

    def _find_last_by_category(self, category: str) -> WorkoutSession | None:
        for session in self.history:
            if session.routine_category == category:
                return session
        return None


workout_session_store = WorkoutSessionStore()
