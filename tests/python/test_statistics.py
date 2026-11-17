"""Unit tests for QuizStatisticsService and descriptive helpers."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT_DIR / "src"))

from quiz_analytics.models import (  # noqa: E402
    ParticipantAttempt,
    QuestionStat,
    QuizDataset,
    QuizDetails,
)
from quiz_analytics.statistics import (  # noqa: E402
    QuizStatisticsService,
    compute_descriptive_stats,
    compute_pearson_correlation,
)


def _make_participant(
    *,
    sheet_rank: int,
    name: str,
    score: int,
    accuracy: float,
    attempted: int = 8,
    correct: int = 6,
    time_s: float = 120.0,
    device: str = "Chrome on Windows",
) -> ParticipantAttempt:
    return ParticipantAttempt(
        sheet_rank=sheet_rank,
        first_name=name,
        last_name="",
        player_name=name,
        attempted_questions=attempted,
        accuracy_percent=accuracy,
        score=score,
        correct=correct,
        yet_to_be_graded=0,
        partially_correct=0,
        incorrect=max(0, attempted - correct),
        ungraded=0,
        unattempted=max(0, 8 - attempted),
        total_time_seconds=time_s,
        started_at="Mon",
        device_info=device,
        points=correct,
        total_points=8,
    )


class TestQuizStatisticsService(unittest.TestCase):
    """Tests for ranking, descriptive stats, edge cases, and error handling."""

    def setUp(self) -> None:
        self.service = QuizStatisticsService()

    def test_descriptive_stats_handles_empty_and_single_value(self) -> None:
        # Arrange & Act
        empty = compute_descriptive_stats([])
        single = compute_descriptive_stats([42.0])

        # Assert
        self.assertEqual(empty.count, 0)
        self.assertEqual(empty.mean, 0.0)
        self.assertEqual(single.count, 1)
        self.assertEqual(single.mean, 42.0)
        self.assertEqual(single.median, 42.0)
        self.assertEqual(single.std_dev, 0.0)

    def test_pearson_correlation_handles_constant_and_linear_series(self) -> None:
        # Arrange / Act / Assert
        self.assertIsNone(compute_pearson_correlation([1.0], [2.0]))
        self.assertIsNone(compute_pearson_correlation([5.0, 5.0, 5.0], [1.0, 2.0, 3.0]))
        self.assertEqual(
            compute_pearson_correlation([10.0, 20.0, 30.0], [100.0, 200.0, 300.0]),
            1.0,
        )
        self.assertEqual(
            compute_pearson_correlation([10.0, 20.0, 30.0], [300.0, 200.0, 100.0]),
            -1.0,
        )

    def test_build_report_ranks_top_10_and_filters_zero_attempts_by_default(self) -> None:
        # Arrange
        participants = tuple(
            [
                _make_participant(sheet_rank=1, name="Zero", score=0, accuracy=0.0, attempted=0, correct=0, time_s=0.0),
                *[
                    _make_participant(
                        sheet_rank=i + 1,
                        name=f"Aluno {i:02d}",
                        score=1000 + i * 200,
                        accuracy=50.0 + i * 2,
                        correct=4 + (i % 4),
                        time_s=200.0 - i * 5,
                    )
                    for i in range(1, 13)
                ],
            ]
        )
        questions = (
            QuestionStat(1, "Easy Q", "Multiple Choice", 90.0, 15.0, 10, 1, 0),
            QuestionStat(2, "Hard Q", "Multiple Choice", 20.0, 40.0, 2, 9, 0),
        )
        dataset = QuizDataset(
            filename="test.xlsx",
            details=QuizDetails("start", "end", "Quiz", 12, 13, 60.0),
            participants=participants,
            questions=questions,
        )

        # Act
        report = self.service.build_report(dataset, sort_by="score", include_zero_attempts=False)

        # Assert
        self.assertEqual(report.total_attempts_count, 13)
        self.assertEqual(report.active_participants_count, 12)
        self.assertEqual(report.filtered_count, 12)
        self.assertEqual(len(report.top_10), 10)
        self.assertEqual(report.top_10[0].display_name, "Aluno 12")
        self.assertEqual(report.easiest_question.number, 1)
        self.assertEqual(report.hardest_question.number, 2)
        self.assertEqual(report.highlights["leader_name"], "Aluno 12")

    def test_build_report_supports_sheet_rank_sorting_and_zero_attempts_inclusion(self) -> None:
        # Arrange
        p1 = _make_participant(sheet_rank=2, name="HigherScore", score=5200, accuracy=75.0, time_s=180.0)
        p2 = _make_participant(sheet_rank=1, name="FasterSheetRank", score=5000, accuracy=75.0, time_s=120.0)
        p0 = _make_participant(sheet_rank=3, name="ZeroAttempt", score=0, accuracy=0.0, attempted=0, correct=0, time_s=0.0)
        dataset = QuizDataset(
            filename="t.xlsx",
            details=QuizDetails("", "", "", 3, 3, 50.0),
            participants=(p1, p2, p0),
            questions=(),
        )

        # Act
        report = self.service.build_report(
            dataset, sort_by="sheet_rank", include_zero_attempts=True
        )

        # Assert
        self.assertEqual(report.filtered_count, 3)
        self.assertEqual([p.display_name for p in report.all_ranked], ["FasterSheetRank", "HigherScore", "ZeroAttempt"])

    def test_build_report_rejects_invalid_sort_mode(self) -> None:
        # Arrange
        dataset = QuizDataset(
            filename="t.xlsx",
            details=QuizDetails("", "", "", 0, 0, 0.0),
            participants=(),
            questions=(),
        )

        # Act & Assert
        with self.assertRaises(ValueError):
            self.service.build_report(dataset, sort_by="invalid_mode")


if __name__ == "__main__":
    unittest.main()
