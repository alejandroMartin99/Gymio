from pydantic import BaseModel


class CreateCustomExerciseRequest(BaseModel):
    name: str
    muscle_group: str
    icon_url: str | None = None
    icon_key: str | None = None
    instructions_url: str | None = None
