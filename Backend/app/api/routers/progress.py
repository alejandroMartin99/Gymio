from fastapi import APIRouter

router = APIRouter()


@router.get("")
def get_progress() -> dict[str, bool | dict[str, int]]:
    return {"success": True, "data": {"sessions": 0, "prs": 0}}
