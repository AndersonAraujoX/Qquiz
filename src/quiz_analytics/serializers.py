"""JSON serialization helpers for quiz analytics domain objects."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from quiz_analytics.models import ParticipantAttempt, QuizAnalyticsReport


def serialize_participant(p: ParticipantAttempt, display_rank: int) -> dict[str, Any]:
    """Serialize a participant attempt with its computed display rank."""
    return {
        "rank": display_rank,
        "sheet_rank": p.sheet_rank,
        "display_name": p.display_name,
        "first_name": p.first_name,
        "last_name": p.last_name,
        "player_name": p.player_name,
        "attempted_questions": p.attempted_questions,
        "accuracy_percent": p.accuracy_percent,
        "score": p.score,
        "correct": p.correct,
        "incorrect": p.incorrect,
        "unattempted": p.unattempted,
        "total_time_seconds": p.total_time_seconds,
        "started_at": p.started_at,
        "device_info": p.device_info,
        "points": p.points,
        "total_points": p.total_points,
        "is_active": p.is_active,
        "question_answers": [asdict(qa) for qa in p.question_answers],
    }


def serialize_report(report: QuizAnalyticsReport) -> dict[str, Any]:
    """Convert QuizAnalyticsReport into a JSON-serializable dictionary."""
    return {
        "filename": report.filename,
        "details": asdict(report.details),
        "sort_by": report.sort_by,
        "include_zero_attempts": report.include_zero_attempts,
        "total_attempts_count": report.total_attempts_count,
        "active_participants_count": report.active_participants_count,
        "filtered_count": report.filtered_count,
        "top_10": [
            serialize_participant(p, idx) for idx, p in enumerate(report.top_10, start=1)
        ],
        "all_ranked": [
            serialize_participant(p, idx) for idx, p in enumerate(report.all_ranked, start=1)
        ],
        "score_stats": asdict(report.score_stats),
        "accuracy_stats": asdict(report.accuracy_stats),
        "time_stats": asdict(report.time_stats),
        "score_distribution": [asdict(b) for b in report.score_distribution],
        "accuracy_distribution": [asdict(b) for b in report.accuracy_distribution],
        "questions": [asdict(q) for q in report.questions],
        "easiest_question": asdict(report.easiest_question) if report.easiest_question else None,
        "hardest_question": asdict(report.hardest_question) if report.hardest_question else None,
        "device_breakdown": [asdict(d) for d in report.device_breakdown],
        "time_score_correlation": report.time_score_correlation,
        "highlights": dict(report.highlights),
    }
