"""Application service orchestrating repository, parser, and statistics calculator."""

from __future__ import annotations

from quiz_analytics.models import QuizAnalyticsReport
from quiz_analytics.ports import (
    DataFileRepository,
    SpreadsheetParser,
    StatisticsCalculator,
)


class NoDatasetsAvailableError(Exception):
    """Raised when the data directory has no valid .xlsx files."""


class QuizDashboardService:
    """Coordinates reading datasets and generating analytics reports via DI."""

    def __init__(
        self,
        repository: DataFileRepository,
        parser: SpreadsheetParser,
        calculator: StatisticsCalculator,
    ) -> None:
        self._repository = repository
        self._parser = parser
        self._calculator = calculator

    def list_datasets(self) -> list[str]:
        """Return available .xlsx dataset filenames."""
        return self._repository.list_xlsx_files()

    def get_report(
        self,
        filename: str | None = None,
        *,
        sort_by: str = "score",
        include_zero_attempts: bool = False,
    ) -> QuizAnalyticsReport:
        """Load the requested dataset (or first available) and compute its analytics report."""
        target_file = filename
        if not target_file:
            available = self._repository.list_xlsx_files()
            if not available:
                raise NoDatasetsAvailableError("No .xlsx files found in data directory.")
            target_file = available[0]

        raw_bytes = self._repository.read_xlsx_bytes(target_file)
        dataset = self._parser.parse(raw_bytes, target_file)
        return self._calculator.build_report(
            dataset,
            sort_by=sort_by,
            include_zero_attempts=include_zero_attempts,
        )
