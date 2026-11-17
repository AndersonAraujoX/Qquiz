"""Unit tests for QuizDashboardService and QuizRequestHandler HTTP server."""

from __future__ import annotations

import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import MagicMock
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT_DIR / "src"))

from quiz_analytics.models import (  # noqa: E402
    ParticipantAttempt,
    QuizDataset,
    QuizDetails,
)
from quiz_analytics.repository import InvalidFilenameError  # noqa: E402
from quiz_analytics.service import (  # noqa: E402
    NoDatasetsAvailableError,
    QuizDashboardService,
)
from quiz_analytics.statistics import QuizStatisticsService  # noqa: E402
from quiz_analytics.web import create_app_server  # noqa: E402


def _sample_dataset() -> QuizDataset:
    return QuizDataset(
        filename="quiz.xlsx",
        details=QuizDetails("Mon", "Mon", "Quiz", 1, 1, 100.0),
        participants=(
            ParticipantAttempt(
                sheet_rank=1,
                first_name="Maria",
                last_name="Souza",
                player_name="msouza",
                attempted_questions=8,
                accuracy_percent=100.0,
                score=6000,
                correct=8,
                yet_to_be_graded=0,
                partially_correct=0,
                incorrect=0,
                ungraded=0,
                unattempted=0,
                total_time_seconds=120.0,
                started_at="Mon",
                device_info="Chrome on Linux",
                points=8,
                total_points=8,
            ),
        ),
        questions=(),
    )


class TestQuizDashboardService(unittest.TestCase):
    """Tests for QuizDashboardService with mocked repository and parser."""

    def test_get_report_uses_first_dataset_when_filename_omitted(self) -> None:
        # Arrange
        mock_repo = MagicMock()
        mock_repo.list_xlsx_files.return_value = ["first.xlsx", "second.xlsx"]
        mock_repo.read_xlsx_bytes.return_value = b"PK\x03\x04mock"

        mock_parser = MagicMock()
        mock_parser.parse.return_value = _sample_dataset()

        service = QuizDashboardService(mock_repo, mock_parser, QuizStatisticsService())

        # Act
        report = service.get_report()

        # Assert
        mock_repo.read_xlsx_bytes.assert_called_once_with("first.xlsx")
        mock_parser.parse.assert_called_once_with(b"PK\x03\x04mock", "first.xlsx")
        self.assertEqual(len(report.top_10), 1)
        self.assertEqual(report.top_10[0].display_name, "Maria Souza")

    def test_get_report_raises_when_no_datasets_exist(self) -> None:
        # Arrange
        mock_repo = MagicMock()
        mock_repo.list_xlsx_files.return_value = []
        mock_parser = MagicMock()
        service = QuizDashboardService(mock_repo, mock_parser, QuizStatisticsService())

        # Act & Assert
        with self.assertRaises(NoDatasetsAvailableError):
            service.get_report()


class TestQuizWebServer(unittest.TestCase):
    """Integration-style tests against local HTTP server with mocked service."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        static_dir = Path(self._tmp.name)
        (static_dir / "index.html").write_text("<html><body>Quiz</body></html>", encoding="utf-8")
        (static_dir / "assets").mkdir()
        (static_dir / "assets" / "icon.png").write_bytes(b"\x89PNG\r\n\x1a\nmockpng")
        (static_dir / "secret.env").write_text("SECRET=123", encoding="utf-8")

        self.mock_service = MagicMock(spec=QuizDashboardService)
        self.mock_service.list_datasets.return_value = ["quiz.xlsx"]
        self.mock_service.get_report.return_value = QuizStatisticsService().build_report(
            _sample_dataset()
        )

        self.server = create_app_server(
            service=self.mock_service,
            static_dir=static_dir,
            host="127.0.0.1",
            port=0,
        )
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self._tmp.cleanup()

    def test_get_datasets_returns_json_and_security_headers(self) -> None:
        # Arrange
        url = f"http://127.0.0.1:{self.port}/api/datasets"

        # Act
        with urlopen(url) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            headers = resp.headers

        # Assert
        self.assertEqual(body, {"datasets": ["quiz.xlsx"]})
        self.assertEqual(headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(headers.get("X-Frame-Options"), "DENY")
        self.assertEqual(headers.get("Cache-Control"), "no-store")
        self.assertIn("default-src 'self'", headers.get("Content-Security-Policy", ""))

    def test_get_report_rejects_invalid_sort_and_traversal_filename(self) -> None:
        # Arrange
        bad_sort_url = f"http://127.0.0.1:{self.port}/api/report?sort_by=drop_table"
        self.mock_service.get_report.side_effect = InvalidFilenameError("bad")
        bad_file_url = f"http://127.0.0.1:{self.port}/api/report?file=../etc/passwd"

        # Act & Assert
        with self.assertRaises(HTTPError) as ctx1:
            urlopen(bad_sort_url)
        self.assertEqual(ctx1.exception.code, 400)

        with self.assertRaises(HTTPError) as ctx2:
            urlopen(bad_file_url)
        self.assertEqual(ctx2.exception.code, 400)

    def test_post_method_is_rejected_with_405(self) -> None:
        # Arrange
        req = Request(
            f"http://127.0.0.1:{self.port}/api/datasets",
            method="POST",
            data=b"{}",
        )

        # Act & Assert
        with self.assertRaises(HTTPError) as ctx:
            urlopen(req)
        self.assertEqual(ctx.exception.code, 405)

    def test_static_server_serves_allowlisted_png_icon_with_security_headers(self) -> None:
        # Arrange
        url = f"http://127.0.0.1:{self.port}/assets/icon.png"

        # Act
        with urlopen(url) as resp:
            status = resp.status
            content_type = resp.headers.get("Content-Type")
            nosniff = resp.headers.get("X-Content-Type-Options")
            body = resp.read()

        # Assert
        self.assertEqual(status, 200)
        self.assertEqual(content_type, "image/png")
        self.assertEqual(nosniff, "nosniff")
        self.assertTrue(body.startswith(b"\x89PNG"))

    def test_static_server_blocks_non_allowlisted_extension_and_traversal(self) -> None:
        # Arrange / Act / Assert
        with self.assertRaises(HTTPError) as ctx_env:
            urlopen(f"http://127.0.0.1:{self.port}/secret.env")
        self.assertEqual(ctx_env.exception.code, 403)

        with self.assertRaises(HTTPError) as ctx_trav:
            urlopen(f"http://127.0.0.1:{self.port}/../server.py")
        self.assertEqual(ctx_trav.exception.code, 403)

    def test_create_app_server_refuses_wildcard_bind_host(self) -> None:
        # Arrange / Act / Assert
        with self.assertRaises(ValueError):
            create_app_server(self.mock_service, Path("."), host="0.0.0.0", port=0)


if __name__ == "__main__":
    unittest.main()
