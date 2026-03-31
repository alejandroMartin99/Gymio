from fastapi import APIRouter

router = APIRouter()


@router.post("/login")
def login() -> dict[str, bool | str]:
    return {"success": True, "detail": "Login endpoint scaffolded"}
