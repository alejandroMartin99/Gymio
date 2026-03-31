from pydantic import BaseModel, EmailStr, Field


class AuthCredentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class AccessTokenRequest(BaseModel):
    access_token: str
