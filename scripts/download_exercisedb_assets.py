#!/usr/bin/env python3
"""
Descarga GIFs desde ExerciseDB vía RapidAPI.

También deja una copia en videos/ (misma animación .gif): esta API no sirve MP4 en /video;
si el JSON incluye URL de vídeo, se intenta además descargar ese archivo.

Requisitos:
  pip install requests

Por defecto descarga unos pocos ejercicios **por grupo muscular** (target), usando:
  GET /exercises/targetList
  GET /exercises/target/{target}?limit=N

Uso (PowerShell), una de estas:
  $env:RAPIDAPI_KEY="tu_clave"
  python scripts/download_exercisedb_assets.py --out Frontend/public/exercises/exercisedb --per-target 5

  O crea scripts/rapidapi.env (ver rapidapi.env.example) y ejecuta sin variable de entorno.

Modo antiguo (todo el listado paginado /exercises):
  python scripts/download_exercisedb_assets.py --per-target 0 --max 200

Opciones:
  --per-target N   ejercicios por target (0 = modo paginado /exercises; default 5)
  --resolution     180|360|720|1080
  --max            tope total de ejercicios procesados (0 = sin tope)
  --sleep          pausa entre peticiones
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path
from urllib.parse import quote, urlparse

try:
    import requests
except ImportError:
    print("Instala dependencias: pip install requests", file=sys.stderr)
    sys.exit(1)

BASE = "https://exercisedb.p.rapidapi.com"
HOST = "exercisedb.p.rapidapi.com"

_SCRIPT_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPT_DIR.parent


def load_env_file(path: Path) -> None:
    """Carga KEY=valor en os.environ si la clave aún no existe (sin dependencia python-dotenv)."""
    if not path.is_file():
        return
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and val and key not in os.environ:
            os.environ[key] = val


def load_optional_env_files() -> None:
    """Orden: raíz del repo .env, scripts/.env, scripts/rapidapi.env."""
    load_env_file(_REPO_ROOT / ".env")
    load_env_file(_SCRIPT_DIR / ".env")
    load_env_file(_SCRIPT_DIR / "rapidapi.env")


def safe_video_name(url: str, exercise_id: str) -> str:
    path = urlparse(url).path
    base = os.path.basename(path) or f"{exercise_id}.mp4"
    base = re.sub(r"[^a-zA-Z0-9._-]", "_", base)
    return base[:180] if len(base) > 180 else base


def download_gif(
    eid: str,
    gifs_dir: Path,
    resolution: str,
    headers: dict,
    sleep: float,
) -> bool:
    gif_path = gifs_dir / f"{eid}.gif"
    if gif_path.exists():
        return True
    img = requests.get(
        f"{BASE}/image",
        params={"exerciseId": eid, "resolution": resolution},
        headers=headers,
        timeout=120,
    )
    time.sleep(sleep)
    if img.status_code != 200:
        print(f"SKIP gif {eid}: HTTP {img.status_code}", file=sys.stderr)
        return False
    gif_path.write_bytes(img.content)
    print(f"OK gif {eid}")
    return True


def copy_gif_to_videos(eid: str, gifs_dir: Path, videos_dir: Path) -> None:
    """La API suele no servir MP4; las animaciones van en GIF. Copia a videos/ para previsualización."""
    src = gifs_dir / f"{eid}.gif"
    dst = videos_dir / f"{eid}.gif"
    if src.exists() and not dst.exists():
        shutil.copy2(src, dst)
        print(f"OK video {eid}.gif (animación, mismo contenido que gifs/)")


def try_download_video(ex: dict, eid: str, videos_dir: Path, sleep: float) -> None:
    for field in ("videoUrl", "gifUrl", "gif", "video"):
        u = ex.get(field)
        if isinstance(u, str) and u.startswith("http"):
            vn = safe_video_name(u, str(eid))
            vpath = videos_dir / vn
            if vpath.exists():
                return
            try:
                vr = requests.get(u, timeout=180, stream=True)
                time.sleep(sleep)
                if vr.status_code == 200:
                    with open(vpath, "wb") as f:
                        for chunk in vr.iter_content(65536):
                            if chunk:
                                f.write(chunk)
                    print(f"OK video {vn}")
            except OSError as e:
                print(f"SKIP video {u}: {e}", file=sys.stderr)
            return


def process_exercise(
    ex: dict,
    gifs_dir: Path,
    videos_dir: Path,
    resolution: str,
    headers: dict,
    sleep: float,
) -> bool:
    eid = ex.get("id") or ex.get("exerciseId")
    if not eid:
        return False
    download_gif(str(eid), gifs_dir, resolution, headers, sleep)
    copy_gif_to_videos(str(eid), gifs_dir, videos_dir)
    try_download_video(ex, str(eid), videos_dir, sleep)
    return True


def fetch_target_list(headers: dict) -> list[str]:
    r = requests.get(f"{BASE}/exercises/targetList", headers=headers, timeout=60)
    if r.status_code != 200:
        print(f"Error targetList: {r.status_code} {r.text[:400]}", file=sys.stderr)
        sys.exit(1)
    data = r.json()
    if not isinstance(data, list):
        print(data, file=sys.stderr)
        sys.exit(1)
    return [str(x) for x in data]


def fetch_exercises_by_target(target: str, limit: int, headers: dict) -> list[dict]:
    # Path: /exercises/target/{target} — codificar espacios y caracteres especiales
    path = quote(target, safe="")
    r = requests.get(
        f"{BASE}/exercises/target/{path}",
        params={"limit": limit},
        headers=headers,
        timeout=120,
    )
    if r.status_code != 200:
        print(f"WARN target '{target}': HTTP {r.status_code} {r.text[:200]}", file=sys.stderr)
        return []
    try:
        data = r.json()
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    return data


def run_by_target(
    args: argparse.Namespace,
    headers: dict,
    gifs_dir: Path,
    videos_dir: Path,
) -> None:
    targets = fetch_target_list(headers)
    time.sleep(args.sleep)
    print(f"Targets: {len(targets)} grupos. {args.per_target} ejercicios por grupo (máx).")
    total = 0
    seen_ids: set[str] = set()

    for target in targets:
        exercises = fetch_exercises_by_target(target, args.per_target, headers)
        time.sleep(args.sleep)
        if not exercises:
            continue
        print(f"--- {target}: {len(exercises)} ejercicios ---")
        for ex in exercises:
            if args.max and total >= args.max:
                print(f"Fin (--max {args.max})")
                return
            eid = ex.get("id") or ex.get("exerciseId")
            if eid and str(eid) in seen_ids:
                continue
            if eid:
                seen_ids.add(str(eid))
            if process_exercise(ex, gifs_dir, videos_dir, args.resolution, headers, args.sleep):
                total += 1

    print(f"Listo. Procesados {total} ejercicios (únicos). Salida: {args.out}")


def run_paginated(
    args: argparse.Namespace,
    headers: dict,
    gifs_dir: Path,
    videos_dir: Path,
) -> None:
    offset = 0
    total_done = 0

    while True:
        r = requests.get(
            f"{BASE}/exercises",
            params={"offset": offset, "limit": args.limit},
            headers=headers,
            timeout=120,
        )
        if r.status_code != 200:
            print(f"Error listando ejercicios offset={offset}: {r.status_code} {r.text[:300]}", file=sys.stderr)
            sys.exit(1)

        try:
            data = r.json()
        except json.JSONDecodeError:
            print(r.text[:500], file=sys.stderr)
            sys.exit(1)

        if not data:
            break

        for ex in data:
            if args.max and total_done >= args.max:
                print(f"Fin (--max {args.max})")
                return
            if process_exercise(ex, gifs_dir, videos_dir, args.resolution, headers, args.sleep):
                total_done += 1

        if len(data) < args.limit:
            break
        offset += args.limit
        time.sleep(args.sleep)

    print(f"Listo. Procesados {total_done} ejercicios. Salida: {args.out}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--out",
        type=Path,
        default=Path("Frontend/public/exercises/exercisedb"),
        help="Carpeta base bajo public (gifs/ y videos/)",
    )
    ap.add_argument("--resolution", default="180", choices=["180", "360", "720", "1080"])
    ap.add_argument("--limit", type=int, default=50, help="Solo modo paginado: tamaño de página /exercises")
    ap.add_argument(
        "--per-target",
        type=int,
        default=5,
        help="Ejercicios a descargar por grupo muscular (target). 0 = modo paginado /exercises.",
    )
    ap.add_argument("--max", type=int, default=0, help="Máximo de ejercicios a procesar (0 = sin límite)")
    ap.add_argument("--sleep", type=float, default=0.15)
    ap.add_argument(
        "--env-file",
        type=Path,
        default=None,
        help="Fichero opcional con RAPIDAPI_KEY=... (además de los que se buscan por defecto)",
    )
    ap.add_argument("--key", default=None, help="Clave RapidAPI (solo para pruebas; mejor usar env o rapidapi.env)")
    args = ap.parse_args()

    load_optional_env_files()
    if args.env_file:
        load_env_file(args.env_file.expanduser().resolve())
    if args.key:
        os.environ["RAPIDAPI_KEY"] = args.key

    key = os.environ.get("RAPIDAPI_KEY") or os.environ.get("RAPIDAPI_KEY_EXERCISEDB")
    if not key:
        print(
            "No se encontró RAPIDAPI_KEY.\n"
            "  • PowerShell:  $env:RAPIDAPI_KEY=\"tu_clave\"\n"
            "  • O crea el archivo scripts/rapidapi.env con una línea:\n"
            "      RAPIDAPI_KEY=tu_clave\n"
            "  • O pasa:  --key tu_clave  (evita dejar la clave en el historial si puedes)",
            file=sys.stderr,
        )
        sys.exit(1)

    headers = {"X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST}

    gifs_dir = args.out / "gifs"
    videos_dir = args.out / "videos"
    gifs_dir.mkdir(parents=True, exist_ok=True)
    videos_dir.mkdir(parents=True, exist_ok=True)

    if args.per_target > 0:
        run_by_target(args, headers, gifs_dir, videos_dir)
    else:
        run_paginated(args, headers, gifs_dir, videos_dir)


if __name__ == "__main__":
    main()
