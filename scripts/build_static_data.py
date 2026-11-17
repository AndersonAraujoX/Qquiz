"""Build static JSON datasets in docs/data/ from dados/*.xlsx for GitHub Pages."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from quiz_analytics.ports import DataFileRepository, SpreadsheetParser  # noqa: E402
from quiz_analytics.repository import LocalDataFileRepository  # noqa: E402
from quiz_analytics.xlsx_parser import SecureXlsxQuizParser  # noqa: E402

SAFE_SLUG_RE = re.compile(r"[^A-Za-z0-9._-]+")


def make_safe_json_filename(xlsx_filename: str) -> str:
    """Convert an .xlsx filename into a safe single-segment .json filename."""
    stem = Path(os.path.basename(xlsx_filename)).stem
    slug = SAFE_SLUG_RE.sub("_", stem).strip("._-") or "dataset"
    return f"{slug}.json"


class StaticDataBuilder:
    """Converts .xlsx datasets into static JSON files for client-side hosting."""

    def __init__(
        self,
        repository: DataFileRepository,
        parser: SpreadsheetParser,
        output_dir: Path,
    ) -> None:
        self._repository = repository
        self._parser = parser
        self._output_dir = output_dir.resolve()

    def build(self) -> dict[str, object]:
        """Parse all .xlsx files from repository and write JSON files into output_dir."""
        self._output_dir.mkdir(parents=True, exist_ok=True)
        xlsx_files = self._repository.list_xlsx_files()

        manifest_entries: list[dict[str, object]] = []
        expected_json_names: set[str] = {"manifest.json"}

        for filename in xlsx_files:
            raw_bytes = self._repository.read_xlsx_bytes(filename)
            dataset = self._parser.parse(raw_bytes, filename)

            json_name = make_safe_json_filename(filename)
            expected_json_names.add(json_name)
            target_path = self._safe_output_path(json_name)

            payload = {
                "filename": dataset.filename,
                "details": asdict(dataset.details),
                "participants": [
                    {
                        **asdict(p),
                        "display_name": p.display_name,
                        "is_active": p.is_active,
                    }
                    for p in dataset.participants
                ],
                "questions": [asdict(q) for q in dataset.questions],
            }
            target_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            active_count = sum(1 for p in dataset.participants if p.is_active)
            manifest_entries.append(
                {
                    "filename": dataset.filename,
                    "data_file": json_name,
                    "title": Path(dataset.filename).stem,
                    "total_attempts": len(dataset.participants),
                    "active_participants": active_count,
                }
            )

        # Clean stale dataset JSON files no longer present in dados/
        for existing in self._output_dir.iterdir():
            if (
                existing.is_file()
                and existing.suffix.lower() == ".json"
                and existing.name not in expected_json_names
            ):
                existing.unlink()

        manifest = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "datasets": manifest_entries,
        }
        manifest_path = self._safe_output_path("manifest.json")
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return manifest

    def _safe_output_path(self, filename: str) -> Path:
        clean_name = os.path.basename(filename)
        candidate = (self._output_dir / clean_name).resolve()
        prefix = str(self._output_dir) + os.sep
        if not str(candidate).startswith(prefix):
            raise ValueError("Output path escapes target directory.")
        return candidate


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate static JSON files in docs/data from dados/*.xlsx"
    )
    parser.add_argument("--dados-dir", type=Path, default=ROOT_DIR / "dados")
    parser.add_argument("--output-dir", type=Path, default=ROOT_DIR / "docs" / "data")
    args = parser.parse_args(argv)

    builder = StaticDataBuilder(
        repository=LocalDataFileRepository(args.dados_dir),
        parser=SecureXlsxQuizParser(),
        output_dir=args.output_dir,
    )
    manifest = builder.build()
    print(f"Gerados {len(manifest['datasets'])} dataset(s) em {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
