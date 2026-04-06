from pathlib import Path

GIFS_DIR = Path("c:/Users/Alex/Documents/GitHub/Gymio/Frontend/public/exercises/exercisedb/gifs")
OUT_FILE = Path("c:/Users/Alex/Documents/GitHub/Gymio/Frontend/src/app/core/exercisedb-local-media.ts")


def main() -> None:
    ids = sorted(file.stem for file in GIFS_DIR.glob("*.gif"))
    lines = ["export const EXERCISEDB_LOCAL_MEDIA_IDS = new Set<string>(["]
    lines.extend(f"  '{exercise_id}'," for exercise_id in ids)
    lines.append("]);")
    lines.append("")
    OUT_FILE.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {len(ids)} local ids -> {OUT_FILE}")


if __name__ == "__main__":
    main()

