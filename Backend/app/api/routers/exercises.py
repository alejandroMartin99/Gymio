from fastapi import APIRouter

router = APIRouter()


@router.get("")
def list_exercises() -> dict[str, bool | list[dict[str, str]] | int]:
    data: list[dict[str, str]] = []
    return {"success": True, "data": data, "count": len(data)}
