import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import auth, exercisedb, exercises, plans, progress, workouts

load_dotenv()

app = FastAPI(title="Gymio API", version="0.1.0")

_allowed_origins = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
]
_frontend_url = os.getenv("FRONTEND_URL", "https://gymio-kappa.vercel.app")
_allowed_origins.append(_frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(workouts.router, prefix="/api/workouts", tags=["workouts"])
app.include_router(exercises.router, prefix="/api/exercises", tags=["exercises"])
app.include_router(exercisedb.router, prefix="/api/exercisedb", tags=["exercisedb"])
app.include_router(plans.router, prefix="/api/plans", tags=["plans"])
app.include_router(progress.router, prefix="/api/progress", tags=["progress"])
