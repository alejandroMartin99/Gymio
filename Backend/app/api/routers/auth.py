from fastapi import APIRouter, HTTPException

from app.api.schemas.auth import AccessTokenRequest, AuthCredentials
from app.services.supabase.supabase_service import get_supabase_anon_client

router = APIRouter()


@router.post("/login")
def login(payload: AuthCredentials) -> dict[str, bool | object]:
    client = get_supabase_anon_client()
    response = client.auth.sign_in_with_password(
        {"email": payload.email, "password": payload.password}
    )
    if not response.session:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {
        "success": True,
        "data": {
            "user": {
                "id": response.user.id if response.user else None,
                "email": response.user.email if response.user else payload.email,
            },
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
        },
    }


@router.post("/register")
def register(payload: AuthCredentials) -> dict[str, bool | object]:
    client = get_supabase_anon_client()
    response = client.auth.sign_up({"email": payload.email, "password": payload.password})
    if not response.user:
        raise HTTPException(status_code=400, detail="Unable to register user")
    return {
        "success": True,
        "data": {
            "id": response.user.id,
            "email": response.user.email,
            "email_confirmed_at": response.user.email_confirmed_at,
        },
    }


@router.post("/me")
def me(payload: AccessTokenRequest) -> dict[str, bool | object]:
    client = get_supabase_anon_client()
    user_response = client.auth.get_user(payload.access_token)
    if not user_response.user:
        raise HTTPException(status_code=401, detail="Invalid access token")
    return {
        "success": True,
        "data": {"id": user_response.user.id, "email": user_response.user.email},
    }
