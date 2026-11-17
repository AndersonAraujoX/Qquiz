"""Interfaces (Protocols) for dependency inversion across quiz analytics layers."""

from __future__ import annotations

from typing import Protocol

from quiz_analytics.models import QuizAnalyticsReport, QuizDataset


class DataFileRepository(Protocol):
    """Abstraction for discovering and reading quiz data files."""

    def list_xlsx_files(self) -> list[str]:
        """Return sorted list of valid .xlsx filenames available."""
        ...

    def read_xlsx_bytes(self, filename: str) -> bytes:
        """Read and validate raw bytes for a given filename."""
        ...


class SpreadsheetParser(Protocol):
    """Abstraction for parsing raw spreadsheet bytes into a QuizDataset."""

    def parse(self, raw_bytes: bytes, filename: str) -> QuizDataset:
        """Parse raw bytes into domain QuizDataset."""
        ...


class StatisticsCalculator(Protocol):
    """Abstraction for computing rankings and statistical metrics."""

    def build_report(
        self,
        dataset: QuizDataset,
        *,
        sort_by: str = "score",
        include_zero_attempts: bool = False,
    ) -> QuizAnalyticsReport:
        """Compute Top 10, full ranking, and statistical indicators."""
        ...
