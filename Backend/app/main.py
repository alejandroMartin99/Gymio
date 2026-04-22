import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import auth, exercisedb, exercises, plans, progress, workouts

load_dotenv()

logger = logging.getLogger(__name__)


async def _self_keepalive_loop() -> None:
    """Ping /health on our public URL during peak hours so Render free tier stays warm (no GitHub secrets)."""
    base = (os.getenv("KEEPALIVE_PUBLIC_URL") or os.getenv("RENDER_EXTERNAL_URL") or "").rstrip("/")
    if not base:
        return
    tz_name = os.getenv("KEEPALIVE_TZ", "Europe/Madrid")
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("Europe/Madrid")
    start_h = int(os.getenv("KEEPALIVE_START_HOUR", "16"))
    end_h = int(os.getenv("KEEPALIVE_END_HOUR_EXCLUSIVE", "20"))

    async def tick(client: httpx.AsyncClient) -> None:
        if start_h <= datetime.now(tz).hour < end_h:
            r = await client.get(f"{base}/health")
            r.raise_for_status()

    async with httpx.AsyncClient(timeout=45.0) as client:
        while True:
            try:
                await tick(client)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Keep-alive self-ping failed")
            await asyncio.sleep(600)


@asynccontextmanager
async def _lifespan(_: FastAPI):
    task = asyncio.create_task(_self_keepalive_loop())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


app = FastAPI(title="Gymio API", version="0.1.0", lifespan=_lifespan)

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
