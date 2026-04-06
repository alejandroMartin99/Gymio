from __future__ import annotations

import json
import re
from pathlib import Path

MAP_PATH = Path("c:/Users/Alex/Documents/GitHub/Gymio/Backend/data/exercisedb/exercise_id_name_map.json")
TS_TRANSLATIONS_PATH = Path(
    "c:/Users/Alex/Documents/GitHub/Gymio/Frontend/src/app/core/exercisedb-name-translations.ts"
)
TS_MANUAL_TRANSLATIONS_PATH = Path(
    "c:/Users/Alex/Documents/GitHub/Gymio/Frontend/src/app/core/exercisedb-name-manual-es.ts"
)

TARGET_ES = {
    "abductors": "abductores",
    "abs": "abdominales",
    "adductors": "aductores",
    "biceps": "biceps",
    "calves": "gemelos",
    "cardiovascular system": "sistema cardiovascular",
    "delts": "deltoides",
    "forearms": "antebrazos",
    "glutes": "gluteos",
    "hamstrings": "isquiotibiales",
    "lats": "dorsales",
    "levator scapulae": "elevador de la escapula",
    "pectorals": "pectorales",
    "quads": "cuadriceps",
    "serratus anterior": "serrato anterior",
    "spine": "columna",
    "traps": "trapecio",
    "triceps": "triceps",
    "upper back": "espalda alta",
}

BODY_PART_ES = {
    "back": "espalda",
    "cardio": "cardio",
    "chest": "pecho",
    "lower arms": "antebrazos",
    "lower legs": "pierna inferior",
    "neck": "cuello",
    "shoulders": "hombros",
    "upper arms": "brazos",
    "upper legs": "piernas",
    "waist": "core",
}

EQUIPMENT_ES = {
    "body weight": "peso corporal",
    "cable": "polea",
    "leverage machine": "maquina de palanca",
    "assisted": "asistido",
    "barbell": "barra",
    "dumbbell": "mancuerna",
    "kettlebell": "kettlebell",
    "smith machine": "multipower",
    "band": "banda",
    "medicine ball": "balon medicinal",
    "roller": "rueda",
    "rope": "cuerda",
    "stability ball": "fitball",
    "wheel": "rueda",
    "weighted": "lastrado",
}


def load_exact_translations() -> dict[str, str]:
    if not TS_TRANSLATIONS_PATH.exists():
        return {}
    content = TS_TRANSLATIONS_PATH.read_text(encoding="utf-8")
    pairs = re.findall(r"^\s*'((?:\\'|[^'])+)':\s*'((?:\\'|[^'])*)',\s*$", content, flags=re.MULTILINE)
    out: dict[str, str] = {}
    for en, es in pairs:
        out[en.replace("\\'", "'")] = es.replace("\\'", "'")
    return out


def load_manual_translations() -> dict[str, str]:
    if not TS_MANUAL_TRANSLATIONS_PATH.exists():
        return {}
    content = TS_MANUAL_TRANSLATIONS_PATH.read_text(encoding="utf-8")
    pairs = re.findall(r"^\s*'((?:\\'|[^'])+)':\s*'((?:\\'|[^'])*)',\s*$", content, flags=re.MULTILINE)
    out: dict[str, str] = {}
    for en, es in pairs:
        out[en.replace("\\'", "'")] = es.replace("\\'", "'")
    return out


def capitalize_words(value: str) -> str:
    return " ".join(word[:1].upper() + word[1:] if word else word for word in value.split())


def contextual_fallback(row: dict) -> str:
    target = TARGET_ES.get((row.get("target") or "").strip().lower(), "")
    body = BODY_PART_ES.get((row.get("bodyPart") or "").strip().lower(), "")
    equipment = EQUIPMENT_ES.get((row.get("equipment") or "").strip().lower(), "")

    pieces: list[str] = ["Ejercicio"]
    if target:
        pieces.append(f"de {target}")
    elif body:
        pieces.append(f"de {body}")
    if equipment:
        pieces.append(f"con {equipment}")
    return capitalize_words(" ".join(pieces))


def main() -> None:
    rows = json.loads(MAP_PATH.read_text(encoding="utf-8"))
    manual = load_manual_translations()
    exact = load_exact_translations()
    updated = 0
    for row in rows:
        en = (row.get("name_en") or "").strip()
        if not en:
            continue
        es = manual.get(en) or exact.get(en)
        if not es:
            es = contextual_fallback(row)
        row["name_es"] = es
        updated += 1

    MAP_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Updated {updated} rows with name_es in {MAP_PATH}")


if __name__ == "__main__":
    main()

