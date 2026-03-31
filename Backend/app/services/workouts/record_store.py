from app.api.schemas.workouts import CreateWorkoutRecordRequest, WorkoutRecord


class WorkoutRecordStore:
    def __init__(self) -> None:
        self.records: list[WorkoutRecord] = []

    def list_records(self) -> list[WorkoutRecord]:
        return self.records

    def create_record(self, payload: CreateWorkoutRecordRequest) -> WorkoutRecord:
        record = WorkoutRecord(
            workout_name=payload.workout_name,
            routine_types=payload.routine_types,
            notes=payload.notes,
        )
        self.records.insert(0, record)
        return record

    def get_last_record(self) -> WorkoutRecord | None:
        return self.records[0] if self.records else None


workout_record_store = WorkoutRecordStore()
