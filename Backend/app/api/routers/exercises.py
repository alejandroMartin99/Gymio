from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError

from app.api.schemas.exercises import CreateCustomExerciseRequest
from app.core.auth import get_current_user_id
from app.services.supabase.supabase_service import get_supabase_service_client

router = APIRouter()


def _raise_catalog_error(error: APIError) -> None:
    code = str(getattr(error, "code", "") or "")
    message = str(getattr(error, "message", "") or "")
    if code == "PGRST205" or "exercise_catalog" in message:
        raise HTTPException(
            status_code=500,
            detail="Tabla exercise_catalog no encontrada en Supabase. Ejecuta Backend/supabase/002_exercise_catalog.sql",
        ) from error
    raise HTTPException(status_code=500, detail=message or "Error consultando catalogo de ejercicios") from error


@router.get("/groups")
def list_groups(user_id: str = Depends(get_current_user_id)) -> dict[str, bool | list[str] | int]:
    client = get_supabase_service_client()
    try:
        result = (
            client.table("exercise_catalog")
            .select("muscle_group")
            .or_(f"user_id.is.null,user_id.eq.{user_id}")
            .order("muscle_group")
            .execute()
        )
    except APIError as error:
        _raise_catalog_error(error)
    groups = sorted({row["muscle_group"] for row in (result.data or [])})
    return {"success": True, "data": groups, "count": len(groups)}


@router.get("/catalog")
def list_exercises(group: str, user_id: str = Depends(get_current_user_id)) -> dict[str, bool | object | int]:
    client = get_supabase_service_client()
    try:
        result = (
            client.table("exercise_catalog")
            .select("*")
            .eq("muscle_group", group)
            .or_(f"user_id.is.null,user_id.eq.{user_id}")
            .order("name")
            .execute()
        )
    except APIError as error:
        _raise_catalog_error(error)
    data = result.data or []
    return {"success": True, "data": data, "count": len(data)}


@router.post("/custom")
def create_custom_exercise(
    payload: CreateCustomExerciseRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, bool | object]:
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="name is required")
    if not payload.muscle_group.strip():
        raise HTTPException(status_code=400, detail="muscle_group is required")

    client = get_supabase_service_client()
    try:
        inserted = (
            client.table("exercise_catalog")
            .insert(
                {
                    "user_id": user_id,
                    "name": payload.name.strip(),
                    "muscle_group": payload.muscle_group.strip(),
                    "icon_url": payload.icon_url,
                    "icon_key": payload.icon_key,
                    "instructions_url": payload.instructions_url,
                    "is_custom": True,
                }
            )
            .execute()
        )
    except APIError as error:
        _raise_catalog_error(error)
    if not inserted.data:
        raise HTTPException(status_code=400, detail="Unable to create custom exercise")
    return {"success": True, "data": inserted.data[0]}


@router.get("")
def list_exercises(user_id: str = Depends(get_current_user_id)) -> dict[str, bool | object | int]:
    client = get_supabase_service_client()
    try:
        result = (
            client.table("exercise_catalog")
            .select("*")
            .or_(f"user_id.is.null,user_id.eq.{user_id}")
            .order("muscle_group")
            .order("name")
            .execute()
        )
    except APIError as error:
        _raise_catalog_error(error)
    data = result.data or []
    return {"success": True, "data": data, "count": len(data)}
