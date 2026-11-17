"""Secure filesystem repository for reading quiz files from the dados directory."""

from __future__ import annotations

import os
from pathlib import Path

ZIP_MAGIC_HEADER = b"PK\x03\x04"
DEFAULT_MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB


class RepositoryError(Exception):
    """Base error raised by the data file repository."""


class InvalidFilenameError(RepositoryError):
    """Raised when a requested filename violates allowlist or boundary rules."""


class DatasetNotFoundError(RepositoryError):
    """Raised when a requested dataset file does not exist."""


class InvalidFileFormatError(RepositoryError):
    """Raised when a file fails size or magic-byte validation."""


class LocalDataFileRepository:
    """Reads validated .xlsx files strictly within a sandboxed base directory."""

    def __init__(
        self,
        base_dir: Path | str,
        *,
        max_file_bytes: int = DEFAULT_MAX_FILE_BYTES,
    ) -> None:
        if max_file_bytes <= 0:
            raise ValueError("max_file_bytes must be positive")
        self._base_dir = Path(base_dir).resolve()
        self._max_file_bytes = max_file_bytes

    @property
    def base_dir(self) -> Path:
        """Return the resolved sandbox directory path."""
        return self._base_dir

    def list_xlsx_files(self) -> list[str]:
        """List valid .xlsx files directly inside base_dir, sorted newest/alphabetically."""
        if not self._base_dir.is_dir():
            return []

        files: list[str] = []
        for entry in self._base_dir.iterdir():
            if not entry.is_file():
                continue
            if entry.is_symlink():
                continue
            if entry.name.startswith(".") or entry.name.startswith("~$"):
                continue
            if entry.suffix.lower() != ".xlsx":
                continue
            files.append(entry.name)

        return sorted(files)

    def read_xlsx_bytes(self, filename: str) -> bytes:
        """Validate filename, boundary, size, and magic bytes, then return file bytes."""
        resolved = self._resolve_safe_path(filename)
        if not resolved.is_file():
            raise DatasetNotFoundError("Dataset file not found.")

        file_size = resolved.stat().st_size
        if file_size <= 0:
            raise InvalidFileFormatError("Dataset file is empty.")
        if file_size > self._max_file_bytes:
            raise InvalidFileFormatError("Dataset file exceeds maximum allowed size.")

        raw = resolved.read_bytes()
        if not raw.startswith(ZIP_MAGIC_HEADER):
            raise InvalidFileFormatError("File signature does not match XLSX archive.")
        return raw

    def _resolve_safe_path(self, filename: str) -> Path:
        if not isinstance(filename, str) or not filename.strip():
            raise InvalidFilenameError("Filename must be a non-empty string.")

        # Reject path separators or traversal patterns explicitly before basename normalization.
        if "/" in filename or "\\" in filename or "\x00" in filename:
            raise InvalidFilenameError("Invalid characters in filename.")

        clean_name = os.path.basename(filename)
        if clean_name != filename or clean_name in {".", ".."}:
            raise InvalidFilenameError("Invalid filename.")

        if not clean_name.lower().endswith(".xlsx"):
            raise InvalidFilenameError("Only .xlsx files are allowed.")

        candidate = (self._base_dir / clean_name).resolve()
        base_prefix = str(self._base_dir) + os.sep
        if not str(candidate).startswith(base_prefix):
            raise InvalidFilenameError("Path escapes data directory boundary.")

        if candidate.is_symlink():
            raise InvalidFilenameError("Symlinks are not permitted.")

        return candidate
