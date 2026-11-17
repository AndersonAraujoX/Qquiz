"""Domain models for the Quiz Analytics application."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class QuizDetails:
    """Metadata describing a quiz session."""

    game_started_on: str
    game_ended_on: str
    game_type: str
    reported_participants: int
    total_attempts: int
    class_accuracy_percent: float


@dataclass(frozen=True)
class ParticipantAttempt:
    """Represents a single student/participant attempt in the quiz."""

    sheet_rank: int
    first_name: str
    last_name: str
    player_name: str
    attempted_questions: int
    accuracy_percent: float
    score: int
    correct: int
    yet_to_be_graded: int
    partially_correct: int
    incorrect: int
    ungraded: int
    unattempted: int
    total_time_seconds: float
    started_at: str
    device_info: str
    points: int
    total_points: int

    @property
    def display_name(self) -> str:
        """Return the cleanest student name for display."""
        full = f"{self.first_name} {self.last_name}".strip()
        return full if full else self.player_name.strip()

    @property
    def is_active(self) -> bool:
        """Return True when at least one question was attempted."""
        return self.attempted_questions > 0


@dataclass(frozen=True)
class QuestionStat:
    """Aggregated performance data for a single quiz question."""

    number: int
    question_text: str
    question_type: str
    accuracy_percent: float
    average_time_seconds: float
    correct_count: int
    incorrect_count: int
    unattempted_count: int


@dataclass(frozen=True)
class DescriptiveStats:
    """Summary statistical indicators for a numeric metric."""

    count: int
    mean: float
    median: float
    std_dev: float
    min_value: float
    max_value: float
    q1: float
    q3: float


@dataclass(frozen=True)
class DistributionBucket:
    """Histogram bucket for score or accuracy ranges."""

    label: str
    count: int
    percentage: float


@dataclass(frozen=True)
class DeviceBreakdown:
    """Count and share of attempts by client platform/browser."""

    device: str
    count: int
    percentage: float


@dataclass(frozen=True)
class QuizDataset:
    """Raw parsed quiz dataset from an XLSX file."""

    filename: str
    details: QuizDetails
    participants: tuple[ParticipantAttempt, ...]
    questions: tuple[QuestionStat, ...]


@dataclass(frozen=True)
class QuizAnalyticsReport:
    """Complete computed report returned to the presentation layer."""

    filename: str
    details: QuizDetails
    sort_by: str
    include_zero_attempts: bool
    total_attempts_count: int
    active_participants_count: int
    filtered_count: int
    top_10: tuple[ParticipantAttempt, ...]
    all_ranked: tuple[ParticipantAttempt, ...]
    score_stats: DescriptiveStats
    accuracy_stats: DescriptiveStats
    time_stats: DescriptiveStats
    score_distribution: tuple[DistributionBucket, ...]
    accuracy_distribution: tuple[DistributionBucket, ...]
    questions: tuple[QuestionStat, ...]
    easiest_question: QuestionStat | None
    hardest_question: QuestionStat | None
    device_breakdown: tuple[DeviceBreakdown, ...]
    time_score_correlation: float | None
    highlights: dict[str, str | float | int] = field(default_factory=dict)
