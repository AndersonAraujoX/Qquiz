"""Unit tests for LocalDataFileRepository."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT_DIR / "src"))

from quiz_analytics.repository import (  # noqa: E402
    DatasetNotFoundError,
    InvalidFileFormatError,
    InvalidFilenameError,
    LocalDataFileRepository,
    ZIP_MAGIC_HEADER,
)


class TestLocalDataFileRepository(unittest.TestCase):
    """Tests for sandboxed .xlsx file discovery and reading."""

    def test_list_xlsx_files_filters_hidden_temp_and_non_xlsx(self) -> None:
        # Arrange
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            (base / "b_quiz.xlsx").write_bytes(ZIP_MAGIC_HEADER + b"ok")
            (base / "a_quiz.xlsx").write_bytes(ZIP_MAGIC_HEADER + b"ok")
            (base / "~$temp.xlsx").write_bytes(ZIP_MAGIC_HEADER + b"temp")
            (base / ".hidden.xlsx").write_bytes(ZIP_MAGIC_HEADER + b"hidden")
            (base / "notes.txt").write_text("ignore", encoding="utf-8")
            (base / "subdir").mkdir()
            repo = LocalDataFileRepository(base)

            # Act
            files = repo.list_xlsx_files()

            # Assert
            self.assertEqual(files, ["a_quiz.xlsx", "b_quiz.xlsx"])

    def test_list_xlsx_files_returns_empty_when_dir_missing(self) -> None:
        # Arrange
        with tempfile.TemporaryDirectory() as tmp:
            repo = LocalDataFileRepository(Path(tmp) / "missing")

            # Act
            files = repo.list_xlsx_files()

            # Assert
            self.assertEqual(files, [])

    def test_read_xlsx_bytes_happy_path(self) -> None:
        # Arrange
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            payload = ZIP_MAGIC_HEADER + b"valid-zip-content"
            (base / "quiz.xlsx").write_bytes(payload)
            repo = LocalDataFileRepository(base)

            # Act
            result = repo.read_xlsx_bytes("quiz.xlsx")

            # Assert
            self.assertEqual(result, payload)

    def test_read_xlsx_bytes_rejects_traversal_and_invalid_names(self) -> None:
        # Arrange
        with tempfile.TemporaryDirectory() as tmp:
            repo = LocalDataFileRepository(tmp)
            bad_names = [
                "",
                "   ",
                "../secret.xlsx",
                "..\\secret.xlsx",
                "sub/quiz.xlsx",
                "quiz.csv",
                "quiz.xlsx\x00.txt",
            ]

            # Act & Assert
            for name in bad_names:
                with self.subTest(name=name):
                    with self.assertRaises(InvalidFilenameError):
                        repo.read_xlsx_bytes(name)

    def test_read_xlsx_bytes_raises_not_found_for_missing_file(self) -> None:
        # Arrange
        with tempfile.TemporaryDirectory() as tmp:
            repo = LocalDataFileRepository(tmp)

            # Act & Assert
            with self.assertRaises(DatasetNotFoundError):
                repo.read_xlsx_bytes("nonexistent.xlsx")

    def test_read_xlsx_bytes_rejects_invalid_magic_bytes_empty_and_oversized(self) -> None:
        # Arrange
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            (base / "empty.xlsx").write_bytes(b"")
            (base / "badmagic.xlsx").write_bytes(b"NOTAZIP123")
            (base / "big.xlsx").write_bytes(ZIP_MAGIC_HEADER + b"x" * 200)
            repo = LocalDataFileRepository(base, max_file_bytes=64)

            # Act & Assert
            with self.assertRaises(InvalidFileFormatError):
                repo.read_xlsx_bytes("empty.xlsx")
            with self.assertRaises(InvalidFileFormatError):
                repo.read_xlsx_bytes("badmagic.xlsx")
            with self.assertRaises(InvalidFileFormatError):
                repo.read_xlsx_bytes("big.xlsx")

    def test_constructor_rejects_non_positive_max_size(self) -> None:
        # Arrange / Act / Assert
        with self.assertRaises(ValueError):
            LocalDataFileRepository(".", max_file_bytes=0)


if __name__ == "__main__":
    unittest.main()
