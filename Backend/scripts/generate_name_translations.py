from __future__ import annotations

import json
import re
from pathlib import Path

BACKEND_JSON = Path("c:/Users/Alex/Documents/GitHub/Gymio/Backend/data/exercisedb/exercises.json")
FRONTEND_CORE = Path("c:/Users/Alex/Documents/GitHub/Gymio/Frontend/src/app/core")
OUT_TS = FRONTEND_CORE / "exercisedb-name-translations.ts"
OUT_TXT = Path("c:/Users/Alex/Documents/GitHub/Gymio/Backend/data/exercisedb/exercise_names_en.txt")

EQUIPMENT = {
    "body weight": "peso corporal",
    "barbell": "barra",
    "dumbbell": "mancuerna",
    "kettlebell": "kettlebell",
    "cable": "polea",
    "smith": "multipower",
    "machine": "maquina",
    "band": "banda",
    "stability ball": "fitball",
    "medicine ball": "balon medicinal",
    "ez barbell": "barra z",
}

PHRASES = [
    ("bench press", "press de banca"),
    ("incline bench", "banco inclinado"),
    ("decline bench", "banco declinado"),
    ("push up", "flexion"),
    ("pull up", "dominada"),
    ("chin up", "dominada supina"),
    ("sit up", "abdominal"),
    ("side bend", "flexion lateral"),
    ("hip thrust", "empuje de cadera"),
    ("deadlift", "peso muerto"),
    ("romanian", "rumano"),
    ("sumo", "sumo"),
    ("squat", "sentadilla"),
    ("split squat", "sentadilla dividida"),
    ("lunge", "zancada"),
    ("step up", "subida al banco"),
    ("calf raise", "elevacion de gemelos"),
    ("leg raise", "elevacion de piernas"),
    ("leg extension", "extension de cuadriceps"),
    ("leg curl", "curl femoral"),
    ("hamstring", "isquiotibial"),
    ("shoulder press", "press de hombro"),
    ("overhead press", "press militar"),
    ("arnold press", "press arnold"),
    ("lateral raise", "elevacion lateral"),
    ("front raise", "elevacion frontal"),
    ("rear delt", "deltoide posterior"),
    ("upright row", "remo al menton"),
    ("shrug", "encogimiento"),
    ("curl", "curl"),
    ("hammer", "martillo"),
    ("concentration", "concentrado"),
    ("preacher", "predicador"),
    ("triceps", "triceps"),
    ("pushdown", "jalon"),
    ("kickback", "patada"),
    ("french press", "press frances"),
    ("dip", "fondo"),
    ("pulldown", "jalon"),
    ("lat pulldown", "jalon al pecho"),
    ("row", "remo"),
    ("t bar", "barra t"),
    ("face pull", "face pull"),
    ("fly", "aperturas"),
    ("crossover", "cruce"),
    ("pullover", "pullover"),
    ("crunch", "crunch"),
    ("plank", "plancha"),
    ("russian twist", "giro ruso"),
    ("mountain climber", "escalador"),
    ("burpee", "burpee"),
    ("jumping jack", "jumping jack"),
    ("jump rope", "saltar cuerda"),
    ("bike", "bicicleta"),
    ("run", "correr"),
    ("walk", "caminar"),
]

TOKENS = {
    "alternate": "alterno",
    "alternating": "alterno",
    "single": "a una mano",
    "one": "una",
    "arm": "brazo",
    "arms": "brazos",
    "leg": "pierna",
    "legs": "piernas",
    "knee": "rodilla",
    "knees": "rodillas",
    "seated": "sentado",
    "standing": "de pie",
    "lying": "tumbado",
    "incline": "inclinado",
    "decline": "declinado",
    "reverse": "inverso",
    "high": "alto",
    "low": "bajo",
    "wide": "abierto",
    "close": "cerrado",
    "narrow": "estrecho",
    "grip": "agarre",
    "twist": "giro",
    "raise": "elevacion",
    "extension": "extension",
    "press": "press",
    "pulldown": "jalon",
    "pull": "tiron",
    "push": "empuje",
    "up": "arriba",
    "down": "abajo",
    "rotation": "rotacion",
    "rotational": "rotacional",
    "wheel": "rueda",
    "assisted": "asistido",
    "weighted": "lastrado",
    "suspended": "suspendido",
    "hanging": "colgado",
    "bent": "flexionado",
    "straight": "recto",
    "to": "a",
    "and": "y",
}


def capitalize_words(value: str) -> str:
    return " ".join(word[:1].upper() + word[1:] if word else word for word in value.split())


def normalize(value: str) -> str:
    value = value.replace("�", " grados")
    value = value.replace("/", " ")
    value = value.replace("-", " ")
    value = value.replace("(", " ").replace(")", " ")
    value = re.sub(r"\s+", " ", value).strip().lower()
    return value


def translate_name(name: str) -> str:
    source = normalize(name)
    equipment = None

    for key in sorted(EQUIPMENT.keys(), key=len, reverse=True):
        if source.startswith(f"{key} "):
            equipment = EQUIPMENT[key]
            source = source[len(key) :].strip()
            break

    result = source
    for english, spanish in PHRASES:
        result = re.sub(rf"\b{re.escape(english)}\b", spanish, result)

    words = result.split()
    words = [TOKENS.get(word, word) for word in words]
    result = " ".join(words)

    result = re.sub(r"\ba una mano brazo\b", "a un brazo", result)
    result = re.sub(r"\buna piernas\b", "una pierna", result)
    result = re.sub(r"\s+", " ", result).strip()

    if equipment:
        result = f"{result} con {equipment}" if result else f"con {equipment}"

    return capitalize_words(result) if result else capitalize_words(name)


def main() -> None:
    data = json.loads(BACKEND_JSON.read_text(encoding="utf-8"))
    names = sorted({(item.get("name") or "").strip() for item in data if (item.get("name") or "").strip()})

    OUT_TXT.write_text("\n".join(names), encoding="utf-8")
    translations = {name: translate_name(name) for name in names}

    lines: list[str] = [
        "/**",
        " * Diccionario completo de nombres ExerciseDB (EN -> ES).",
        " * Generado automaticamente desde Backend/data/exercisedb/exercises.json.",
        " */",
        "export const EXERCISE_NAME_ES: Record<string, string> = {",
    ]

    for key in names:
        value = translations[key]
        key_safe = key.replace("\\", "\\\\").replace("'", "\\'")
        value_safe = value.replace("\\", "\\\\").replace("'", "\\'")
        lines.append(f"  '{key_safe}': '{value_safe}',")

    lines.append("};")
    lines.append("")
    OUT_TS.write_text("\n".join(lines), encoding="utf-8")
    print(f"Generated {len(names)} translations at {OUT_TS}")


if __name__ == "__main__":
    main()

