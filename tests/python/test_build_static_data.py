"""Unit tests for StaticDataBuilder in scripts/build_static_data.py."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock

ROOT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT_DIR / "src"))
sys.path.insert(0, str(ROOT_DIR / "scripts"))

from build_static_data import StaticDataBuilder, make_safe_json_filename  # noqa: E402
from quiz_analytics.models import (  # noqa: E402
    ParticipantAttempt,
    QuizDataset,
    QuizDetails,
)


class TestStaticDataBuilder(unittest.TestCase):
    """Tests static JSON manifest and dataset emission for GitHub Pages."""

    def test_make_safe_json_filename_sanitizes_characters(self) -> None:
        # Arrange / Act / Assert
        self.assertEqual(
            make_safe_json_filename("Quantum School 2026!.xlsx"),
            "Quantum_School_2026.json",
        )
        self.assertEqual(make_safe_json_filename("...xlsx"), "dataset.json")

    def test_build_writes_manifest_dataset_and_removes_stale_json(self) -> None:
        # Arrange
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp)
            stale = out_dir / "old_deleted_quiz.json"
            stale.write_text("{}", encoding="utf-8")

            mock_repo = MagicMock()
            mock_repo.list_xlsx_files.return_value = ["Turma A.xlsx"]
            mock_repo.read_xlsx_bytes.return_value = b"PK\x03\x04dummy"

            mock_parser = MagicMock()
            mock_parser.parse.return_value = QuizDataset(
                filename="Turma A.xlsx",
                details=QuizDetails("Mon", "Mon", "Quiz", 1, 2, 75.0),
                participants=(
                    ParticipantAttempt(
                        1, "Joao", "Pedro", "jp", 8, 100.0, 6000, 8,
                        0, 0, 0, 0, 0, 120.0, "Mon", "Chrome", 8, 8,
                    ),
                    ParticipantAttempt(
                        2, "Zero", "User", "zu", 0, 0.0, 0, 0,
                        0, 0, 0, 0, 8, 0.0, "Mon", "Chrome", 0, 8,
                    ),
                ),
                questions=(),
            )

            builder = StaticDataBuilder(mock_repo, mock_parser, out_dir)

            # Act
            manifest = builder.build()

            # Assert
            self.assertFalse(stale.exists())
            self.assertEqual(len(manifest["datasets"]), 1)
            entry = manifest["datasets"][0]
            self.assertEqual(entry["data_file"], "Turma_A.json")
            self.assertEqual(entry["total_attempts"], 2)
            self.assertEqual(entry["active_participants"], 1)

            saved_manifest = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(saved_manifest["datasets"][0]["filename"], "Turma A.xlsx")

            saved_data = json.loads((out_dir / "Turma_A.json").read_text(encoding="utf-8"))
            self.assertEqual(saved_data["participants"][0]["display_name"], "Joao Pedro")


if __name__ == "__main__":
    unittest.main()
