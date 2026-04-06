#!/usr/bin/env python3
"""
Descarga medios ExerciseDB (RapidAPI v1, exercisedb.p.rapidapi.com):

- GIF por GET /image (sin marcas de agua del paquete Ascend); copia opcional a videos/ como .gif.
- JSON v2 / Uploadcare: imageUrl/videoUrl relativos; PNG/MP4 vía CDN público (--json, sin clave).

Modos RapidAPI: --per-target N (por grupo muscular) | --per-target 0 (paginado GET /exercises).

Requisitos: pip install requests
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


def requests_get_retry(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    params: dict | None = None,
    timeout: float = 120,
    stream: bool = False,
    label: str = "GET",
    max_retries: int = 6,
) -> requests.Response | None:
    """Reintentos ante cortes de red (p. ej. WinError 10054) en APIs y CDN."""
    transient = (
        requests.exceptions.ConnectionError,
        requests.exceptions.Timeout,
        requests.exceptions.ChunkedEncodingError,
    )
    for attempt in range(max_retries):
        try:
            return requests.get(url, headers=headers, params=params, timeout=timeout, stream=stream)
        except transient as e:
            if attempt >= max_retries - 1:
                print(f"{label} falló tras {max_retries} intentos: {e}", file=sys.stderr)
                return None
            time.sleep(min(90.0, 2.0**attempt))
    return None

# CDN público del ejemplo oficial ExerciseDB v2 (README): PNG allí usan
# {exerciseId}__{nombreSinGuiones}.png — los campos imageUrl/videoUrl del JSON son el nombre “humano”.
DEFAULT_UCARE_BASE = "https://ucarecdn.com/c12bb487-7390-4fc7-903c-a1c2298e70ad"
# Uploadcare devuelve a veces el mismo PNG “vacío” para claves incorrectas (mismo tamaño).
DEFAULT_UCARE_PLACEHOLDER_BYTES = frozenset({49957})

_SCRIPT_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPT_DIR.parent


def ucare_placeholder_bytes() -> frozenset[int]:
    raw = os.environ.get("UCARE_SKIP_BYTES", "")
    if not raw.strip():
        return DEFAULT_UCARE_PLACEHOLDER_BYTES
    out: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if part.isdigit():
            out.add(int(part))
    return frozenset(out) if out else DEFAULT_UCARE_PLACEHOLDER_BYTES


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


def uploadcare_object_name(exercise_id: str, relative_name: str) -> str:
    """Pasa de Barbell-Bench-Press_Chest.png a K6NnTv0__BarbellBenchPress_Chest.png (sin guiones en el stem)."""
    relative_name = (relative_name or "").strip()
    if not relative_name or "." not in relative_name:
        return f"{exercise_id}__{relative_name}"
    stem, ext = relative_name.rsplit(".", 1)
    compact = stem.replace("-", "")
    return f"{exercise_id}__{compact}.{ext.lower()}"


def is_v1_numeric_id(eid: str) -> bool:
    return bool(re.match(r"^\d+$", str(eid)))


def download_v2_uploadcare_assets(
    ex: dict,
    exercise_id: str,
    pngs_dir: Path,
    videos_dir: Path,
    ucare_base: str,
    sleep: float,
) -> None:
    """
    Esquema v2: imageUrl / videoUrl son nombres de archivo; en Uploadcare el objeto real usa stem sin '-'.
    No requiere RapidAPI (GET público al CDN).
    """
    base = ucare_base.rstrip("/")

    iu = ex.get("imageUrl")
    if isinstance(iu, str) and iu and not iu.startswith("http") and iu.lower().endswith(".png"):
        key = uploadcare_object_name(str(exercise_id), iu)
        url = f"{base}/{key}"
        dest = pngs_dir / Path(iu).name
        if dest.exists():
            print(f"SKIP png ya existe {dest.name}")
        else:
            r = requests.get(url, timeout=120)
            time.sleep(sleep)
            if r.status_code != 200 or r.content[:8] == b"<!DOCTYPE":
                print(f"SKIP png {url} HTTP {r.status_code}", file=sys.stderr)
            elif len(r.content) in ucare_placeholder_bytes():
                print(
                    f"SKIP png {dest.name}: respuesta placeholder ({len(r.content)} bytes); falta JSON v2 con imageUrl correcto.",
                    file=sys.stderr,
                )
            else:
                dest.write_bytes(r.content)
                print(f"OK png {dest.name}")

    vu = ex.get("videoUrl")
    if isinstance(vu, str) and vu and not vu.startswith("http") and vu.lower().endswith(".mp4"):
        key = uploadcare_object_name(str(exercise_id), vu)
        url = f"{base}/{key}"
        dest = videos_dir / Path(vu).name
        if dest.exists():
            print(f"SKIP mp4 ya existe {dest.name}")
        else:
            r = requests.get(url, timeout=300, stream=True)
            time.sleep(sleep)
            if r.status_code != 200:
                print(f"SKIP mp4 {url} HTTP {r.status_code}", file=sys.stderr)
                return
            ct = (r.headers.get("Content-Type") or "").lower()
            # En el ejemplo, la URL .mp4 puede devolver PNG; no guardar basura como vídeo.
            if "video" not in ct and "octet-stream" not in ct:
                print(
                    f"SKIP mp4 {dest.name}: el CDN devolvió Content-Type={ct!r} (a veces el MP4 real va en otro host; usa URL http en videoUrl si la tienes).",
                    file=sys.stderr,
                )
                return
            with open(dest, "wb") as f:
                for chunk in r.iter_content(65536):
                    if chunk:
                        f.write(chunk)
            print(f"OK mp4 {dest.name}")


def download_gif(
    eid: str,
    gifs_dir: Path,
    resolution: str,
    headers: dict,
    sleep: float,
) -> bool:
    gifs_dir.mkdir(parents=True, exist_ok=True)
    gif_path = gifs_dir / f"{eid}.gif"
    if gif_path.exists():
        return True
    img = requests_get_retry(
        f"{BASE}/image",
        params={"exerciseId": eid, "resolution": resolution},
        headers=headers,
        timeout=120,
        label=f"GIF /image {eid}",
    )
    time.sleep(sleep)
    if img is None:
        return False
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
                vr = requests_get_retry(u, timeout=180, stream=True, label=f"video {eid}")
                time.sleep(sleep)
                if vr is not None and vr.status_code == 200:
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
    pngs_dir: Path,
    resolution: str,
    headers: dict,
    sleep: float,
    ucare_base: str,
) -> bool:
    eid = ex.get("exerciseId") or ex.get("id")
    if not eid:
        return False
    eid_s = str(eid)

    has_v2_files = isinstance(ex.get("imageUrl"), str) and (
        ex["imageUrl"].endswith(".png") and not ex["imageUrl"].startswith("http")
    )
    if has_v2_files or (
        isinstance(ex.get("videoUrl"), str)
        and ex["videoUrl"].endswith(".mp4")
        and not ex["videoUrl"].startswith("http")
    ):
        download_v2_uploadcare_assets(ex, eid_s, pngs_dir, videos_dir, ucare_base, sleep)

    if is_v1_numeric_id(eid_s):
        download_gif(eid_s, gifs_dir, resolution, headers, sleep)
        copy_gif_to_videos(eid_s, gifs_dir, videos_dir)

    try_download_video(ex, eid_s, videos_dir, sleep)
    return True


def fetch_target_list(headers: dict) -> list[str]:
    r = requests_get_retry(
        f"{BASE}/exercises/targetList",
        headers=headers,
        timeout=60,
        label="targetList",
    )
    if r is None or r.status_code != 200:
        print(f"Error targetList: {getattr(r, 'status_code', None)} {getattr(r, 'text', '')[:400]}", file=sys.stderr)
        sys.exit(1)
    data = r.json()
    if not isinstance(data, list):
        print(data, file=sys.stderr)
        sys.exit(1)
    return [str(x) for x in data]


def fetch_exercises_by_target(target: str, limit: int, headers: dict) -> list[dict]:
    # Path: /exercises/target/{target} — codificar espacios y caracteres especiales
    path = quote(target, safe="")
    r = requests_get_retry(
        f"{BASE}/exercises/target/{path}",
        params={"limit": limit},
        headers=headers,
        timeout=120,
        label=f"target/{target[:40]}",
    )
    if r is None or r.status_code != 200:
        print(
            f"WARN target '{target}': HTTP {getattr(r, 'status_code', None)} {getattr(r, 'text', '')[:200]}",
            file=sys.stderr,
        )
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
    pngs_dir: Path,
    ucare_base: str,
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
            if process_exercise(ex, gifs_dir, videos_dir, pngs_dir, args.resolution, headers, args.sleep, ucare_base):
                total += 1

    print(f"Listo. Procesados {total} ejercicios (únicos). Salida: {args.out}")


def run_paginated(
    args: argparse.Namespace,
    headers: dict,
    gifs_dir: Path,
    videos_dir: Path,
    pngs_dir: Path,
    ucare_base: str,
) -> None:
    offset = 0
    total_done = 0

    while True:
        r = requests_get_retry(
            f"{BASE}/exercises",
            params={"offset": offset, "limit": args.limit},
            headers=headers,
            timeout=120,
            label=f"/exercises offset={offset}",
        )
        if r is None or r.status_code != 200:
            print(
                f"Error listando ejercicios offset={offset}: {getattr(r, 'status_code', None)} {getattr(r, 'text', '')[:300]}",
                file=sys.stderr,
            )
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
            if process_exercise(ex, gifs_dir, videos_dir, pngs_dir, args.resolution, headers, args.sleep, ucare_base):
                total_done += 1

        # La API puede devolver menos filas que `limit` (p. ej. tope del plan); no cortar ahí.
        offset += len(data)
        time.sleep(args.sleep)

    print(f"Listo. Procesados {total_done} ejercicios. Salida: {args.out}")


def _ucare_base_from_args(args: argparse.Namespace) -> str:
    return (args.ucare_base or os.environ.get("EXERCISEDB_UCARE_BASE") or DEFAULT_UCARE_BASE).rstrip("/")


def run_from_json_exercises(
    exercises: list[dict],
    args: argparse.Namespace,
    pngs_dir: Path,
    videos_dir: Path,
) -> int:
    ucare_base = _ucare_base_from_args(args)
    n = 0
    for ex in exercises:
        if args.max and n >= args.max:
            break
        eid = ex.get("exerciseId") or ex.get("id")
        if not eid:
            continue
        download_v2_uploadcare_assets(ex, str(eid), pngs_dir, videos_dir, ucare_base, args.sleep)
        n += 1
    return n


def run_from_json(args: argparse.Namespace, pngs_dir: Path, videos_dir: Path) -> None:
    raw = args.json.expanduser().resolve().read_text(encoding="utf-8")
    data = json.loads(raw)
    exercises = data if isinstance(data, list) else [data]
    n = run_from_json_exercises(exercises, args, pngs_dir, videos_dir)
    print(f"Listo (JSON v2). Procesados {n} ítems. Salida: {args.out}")


def run_from_json_dir(args: argparse.Namespace, pngs_dir: Path, videos_dir: Path) -> None:
    dir_path = args.json_dir.expanduser().resolve()
    if not dir_path.is_dir():
        print(f"No es carpeta: {dir_path}", file=sys.stderr)
        sys.exit(1)
    files = sorted(dir_path.glob("*.json"))
    if not files:
        print(f"Sin *.json en {dir_path}", file=sys.stderr)
        sys.exit(1)
    merged: list[dict] = []
    for jf in files:
        try:
            data = json.loads(jf.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            print(f"SKIP {jf.name}: {e}", file=sys.stderr)
            continue
        merged.extend(data if isinstance(data, list) else [data])
    n = run_from_json_exercises(merged, args, pngs_dir, videos_dir)
    print(f"Listo (JSON dir, {len(files)} ficheros, {len(merged)} entradas). Procesados {n} ítems. Salida: {args.out}")


def run_from_json_url(args: argparse.Namespace, pngs_dir: Path, videos_dir: Path) -> None:
    r = requests.get(str(args.json_url), timeout=600)
    if r.status_code != 200:
        print(f"Error HTTP {r.status_code} al bajar JSON", file=sys.stderr)
        sys.exit(1)
    try:
        data = r.json()
    except json.JSONDecodeError as e:
        print(f"JSON inválido: {e}", file=sys.stderr)
        sys.exit(1)
    exercises = data if isinstance(data, list) else [data]
    n = run_from_json_exercises(exercises, args, pngs_dir, videos_dir)
    print(f"Listo (JSON URL). Procesados {n} ítems. Salida: {args.out}")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(line_buffering=True)
        except OSError:
            pass
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--out",
        type=Path,
        default=Path("Frontend/public/exercises/exercisedb"),
        help="Carpeta base bajo public (gifs/, videos/, pngs/)",
    )
    ap.add_argument(
        "--json",
        type=Path,
        default=None,
        help="Un JSON (objeto o array) v2: PNG/MP4 por Uploadcare; no requiere RapidAPI.",
    )
    ap.add_argument(
        "--json-dir",
        type=Path,
        dest="json_dir",
        default=None,
        help="Carpeta con varios *.json v2; se concatenan y se descargan hasta --max en total.",
    )
    ap.add_argument(
        "--json-url",
        type=str,
        dest="json_url",
        default=None,
        help="URL HTTPS de un JSON array v2 (export grande).",
    )
    ap.add_argument(
        "--ucare-base",
        type=str,
        default=None,
        help=f"Base Uploadcare (default: env EXERCISEDB_UCARE_BASE o {DEFAULT_UCARE_BASE[:48]}...)",
    )
    ap.add_argument("--resolution", default="180", choices=["180", "360", "720", "1080"])
    ap.add_argument("--limit", type=int, default=50, help="Solo modo paginado: tamaño de página /exercises")
    ap.add_argument(
        "--per-target",
        type=int,
        default=0,
        help="0 = paginado GET /exercises (recomendado). >0 = N ejercicios por cada targetList.",
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

    gifs_dir = args.out / "gifs"
    videos_dir = args.out / "videos"
    pngs_dir = args.out / "pngs"
    gifs_dir.mkdir(parents=True, exist_ok=True)
    videos_dir.mkdir(parents=True, exist_ok=True)
    pngs_dir.mkdir(parents=True, exist_ok=True)

    ucare_base = (args.ucare_base or os.environ.get("EXERCISEDB_UCARE_BASE") or DEFAULT_UCARE_BASE).rstrip("/")

    json_modes = sum(1 for x in (args.json, args.json_dir, args.json_url) if x)
    if json_modes > 1:
        print("Usa solo uno de: --json, --json-dir, --json-url", file=sys.stderr)
        sys.exit(1)
    if args.json_url:
        run_from_json_url(args, pngs_dir, videos_dir)
        return
    if args.json_dir:
        run_from_json_dir(args, pngs_dir, videos_dir)
        return
    if args.json:
        if not args.json.is_file():
            print(f"No existe el fichero: {args.json}", file=sys.stderr)
            sys.exit(1)
        run_from_json(args, pngs_dir, videos_dir)
        return

    key = os.environ.get("RAPIDAPI_KEY") or os.environ.get("RAPIDAPI_KEY_EXERCISEDB")
    if not key:
        print(
            "No se encontró RAPIDAPI_KEY.\n"
            "  • PowerShell:  $env:RAPIDAPI_KEY=\"tu_clave\"\n"
            "  • O crea scripts/rapidapi.env con RAPIDAPI_KEY=...\n"
            "  • Solo descarga v2 Uploadcare (PNG/MP4):  python ... --json ejercicio.json  (sin clave)",
            file=sys.stderr,
        )
        sys.exit(1)

    headers = {"X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST}

    if args.per_target > 0:
        run_by_target(args, headers, gifs_dir, videos_dir, pngs_dir, ucare_base)
    else:
        run_paginated(args, headers, gifs_dir, videos_dir, pngs_dir, ucare_base)


if __name__ == "__main__":
    main()
