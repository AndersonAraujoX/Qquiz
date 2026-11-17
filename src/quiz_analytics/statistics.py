"""Pure statistical calculations and ranking engine for quiz analytics."""

from __future__ import annotations

import math
from collections import Counter

from quiz_analytics.models import (
    DescriptiveStats,
    DeviceBreakdown,
    DistributionBucket,
    ParticipantAttempt,
    QuestionStat,
    QuizAnalyticsReport,
    QuizDataset,
)

VALID_SORT_MODES = frozenset({"score", "sheet_rank"})


def _quantile(sorted_values: list[float], q: float) -> float:
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return float(sorted_values[0])
    pos = (len(sorted_values) - 1) * q
    low = math.floor(pos)
    high = math.ceil(pos)
    if low == high:
        return float(sorted_values[low])
    weight = pos - low
    return sorted_values[low] * (1.0 - weight) + sorted_values[high] * weight


def compute_descriptive_stats(values: list[float]) -> DescriptiveStats:
    """Compute descriptive statistics (mean, median, std_dev, min, max, Q1, Q3)."""
    if not values:
        return DescriptiveStats(
            count=0,
            mean=0.0,
            median=0.0,
            std_dev=0.0,
            min_value=0.0,
            max_value=0.0,
            q1=0.0,
            q3=0.0,
        )

    sorted_vals = sorted(float(v) for v in values)
    n = len(sorted_vals)
    mean = sum(sorted_vals) / n
    median = _quantile(sorted_vals, 0.5)
    q1 = _quantile(sorted_vals, 0.25)
    q3 = _quantile(sorted_vals, 0.75)

    # Sample standard deviation when n >= 2, else 0.0
    if n >= 2:
        variance = sum((x - mean) ** 2 for x in sorted_vals) / (n - 1)
        std_dev = math.sqrt(variance)
    else:
        std_dev = 0.0

    return DescriptiveStats(
        count=n,
        mean=round(mean, 2),
        median=round(median, 2),
        std_dev=round(std_dev, 2),
        min_value=round(sorted_vals[0], 2),
        max_value=round(sorted_vals[-1], 2),
        q1=round(q1, 2),
        q3=round(q3, 2),
    )


def compute_pearson_correlation(xs: list[float], ys: list[float]) -> float | None:
    """Compute Pearson correlation coefficient r between two equal-length series."""
    if len(xs) != len(ys) or len(xs) < 2:
        return None
    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    den_x = math.sqrt(sum((x - mean_x) ** 2 for x in xs))
    den_y = math.sqrt(sum((y - mean_y) ** 2 for y in ys))
    if den_x == 0.0 or den_y == 0.0:
        return None
    return round(num / (den_x * den_y), 4)


def _rank_participants(
    participants: list[ParticipantAttempt], sort_by: str
) -> list[ParticipantAttempt]:
    if sort_by == "sheet_rank":
        return sorted(
            participants,
            key=lambda p: (
                p.sheet_rank,
                -p.correct,
                p.total_time_seconds,
                -p.score,
                p.display_name.lower(),
            ),
        )
    return sorted(
        participants,
        key=lambda p: (
            -p.score,
            -p.accuracy_percent,
            p.total_time_seconds if p.attempted_questions > 0 else float("inf"),
            p.sheet_rank,
            p.display_name.lower(),
        ),
    )


def _build_accuracy_distribution(
    participants: list[ParticipantAttempt],
) -> tuple[DistributionBucket, ...]:
    ranges = [
        ("0–24%", 0.0, 24.99),
        ("25–49%", 25.0, 49.99),
        ("50–74%", 50.0, 74.99),
        ("75–99%", 75.0, 99.99),
        ("100%", 100.0, 100.01),
    ]
    total = len(participants)
    buckets: list[DistributionBucket] = []
    for label, low, high in ranges:
        count = sum(1 for p in participants if low <= p.accuracy_percent <= high)
        pct = round((count / total) * 100.0, 1) if total > 0 else 0.0
        buckets.append(DistributionBucket(label=label, count=count, percentage=pct))
    return tuple(buckets)


def _build_score_distribution(
    participants: list[ParticipantAttempt],
) -> tuple[DistributionBucket, ...]:
    ranges = [
        ("0–1499", 0, 1499),
        ("1500–2999", 1500, 2999),
        ("3000–4499", 3000, 4499),
        ("4500–5999", 4500, 5999),
        ("6000+", 6000, 10**9),
    ]
    total = len(participants)
    buckets: list[DistributionBucket] = []
    for label, low, high in ranges:
        count = sum(1 for p in participants if low <= p.score <= high)
        pct = round((count / total) * 100.0, 1) if total > 0 else 0.0
        buckets.append(DistributionBucket(label=label, count=count, percentage=pct))
    return tuple(buckets)


def _build_device_breakdown(
    participants: list[ParticipantAttempt],
) -> tuple[DeviceBreakdown, ...]:
    if not participants:
        return ()
    total = len(participants)
    counts = Counter(p.device_info or "Desconhecido" for p in participants)
    items = [
        DeviceBreakdown(
            device=device,
            count=count,
            percentage=round((count / total) * 100.0, 1),
        )
        for device, count in counts.most_common()
    ]
    return tuple(items)


class QuizStatisticsService:
    """Computes Top 10 rankings and comprehensive quiz statistics."""

    def build_report(
        self,
        dataset: QuizDataset,
        *,
        sort_by: str = "score",
        include_zero_attempts: bool = False,
    ) -> QuizAnalyticsReport:
        """Build a full QuizAnalyticsReport from a parsed QuizDataset."""
        if sort_by not in VALID_SORT_MODES:
            raise ValueError(f"Unsupported sort_by '{sort_by}'. Expected one of {sorted(VALID_SORT_MODES)}.")

        all_participants = list(dataset.participants)
        active_participants = [p for p in all_participants if p.is_active]
        target = all_participants if include_zero_attempts else active_participants

        ranked = _rank_participants(target, sort_by)
        top_10 = tuple(ranked[:10])

        score_stats = compute_descriptive_stats([float(p.score) for p in target])
        accuracy_stats = compute_descriptive_stats([p.accuracy_percent for p in target])
        time_stats = compute_descriptive_stats(
            [p.total_time_seconds for p in target if p.total_time_seconds > 0]
        )

        timed = [p for p in target if p.is_active and p.total_time_seconds > 0]
        corr = compute_pearson_correlation(
            [p.total_time_seconds for p in timed],
            [float(p.score) for p in timed],
        )

        questions = dataset.questions
        easiest: QuestionStat | None = None
        hardest: QuestionStat | None = None
        if questions:
            easiest = max(questions, key=lambda q: (q.accuracy_percent, -q.average_time_seconds))
            hardest = min(questions, key=lambda q: (q.accuracy_percent, q.average_time_seconds))

        highlights: dict[str, str | float | int] = {}
        if ranked:
            leader = ranked[0]
            highlights["leader_name"] = leader.display_name
            highlights["leader_score"] = leader.score
            highlights["leader_accuracy"] = leader.accuracy_percent

            fastest_active = min(
                (p for p in target if p.is_active and p.total_time_seconds > 0),
                key=lambda p: p.total_time_seconds,
                default=None,
            )
            if fastest_active:
                highlights["fastest_name"] = fastest_active.display_name
                highlights["fastest_seconds"] = fastest_active.total_time_seconds
                highlights["fastest_accuracy"] = fastest_active.accuracy_percent

            perfect_count = sum(1 for p in target if p.accuracy_percent >= 100.0)
            highlights["perfect_scores_count"] = perfect_count
            above_70_count = sum(1 for p in target if p.accuracy_percent >= 70.0)
            highlights["above_70_percent_count"] = above_70_count

        return QuizAnalyticsReport(
            filename=dataset.filename,
            details=dataset.details,
            sort_by=sort_by,
            include_zero_attempts=include_zero_attempts,
            total_attempts_count=len(all_participants),
            active_participants_count=len(active_participants),
            filtered_count=len(target),
            top_10=top_10,
            all_ranked=tuple(ranked),
            score_stats=score_stats,
            accuracy_stats=accuracy_stats,
            time_stats=time_stats,
            score_distribution=_build_score_distribution(target),
            accuracy_distribution=_build_accuracy_distribution(target),
            questions=questions,
            easiest_question=easiest,
            hardest_question=hardest,
            device_breakdown=_build_device_breakdown(target),
            time_score_correlation=corr,
            highlights=highlights,
        )
