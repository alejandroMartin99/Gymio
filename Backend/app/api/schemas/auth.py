from pydantic import BaseModel, Field


class AuthCredentials(BaseModel):
    email: str
    password: str = Field(min_length=6)


class AccessTokenRequest(BaseModel):
    access_token: str
