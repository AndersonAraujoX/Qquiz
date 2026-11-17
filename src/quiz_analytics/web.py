"""Hardened HTTP server and request router for the Quiz Analytics dashboard."""

from __future__ import annotations

import json
import logging
import os
from functools import partial
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from quiz_analytics.repository import (
    DatasetNotFoundError,
    InvalidFileFormatError,
    InvalidFilenameError,
)
from quiz_analytics.serializers import serialize_report
from quiz_analytics.service import NoDatasetsAvailableError, QuizDashboardService
from quiz_analytics.statistics import VALID_SORT_MODES
from quiz_analytics.xlsx_parser import SpreadsheetParseError

logger = logging.getLogger(__name__)

ALLOWED_STATIC_MIME: dict[str, str] = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
}

CSP_POLICY = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self'; "
    "img-src 'self' data:; "
    "object-src 'none'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'none'"
)


def build_security_headers(*, is_api: bool = False) -> dict[str, str]:
    """Return mandatory HTTP security headers for every response."""
    headers = {
        "Content-Security-Policy": CSP_POLICY,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Referrer-Policy": "no-referrer",
    }
    if is_api:
        headers["Cache-Control"] = "no-store"
    return headers


class QuizRequestHandler(BaseHTTPRequestHandler):
    """HTTP handler serving static assets and read-only quiz analytics APIs."""

    # TODO(security): Local read-only dashboard bound to 127.0.0.1; add OAuth/OIDC
    # authentication, RBAC, and rate limiting before exposing on any shared network.
    server_version = "QuizAnalytics/1.0"
    sys_version = ""

    def __init__(
        self,
        *args: Any,
        service: QuizDashboardService,
        static_dir: Path,
        **kwargs: Any,
    ) -> None:
        self._service = service
        self._static_dir = static_dir.resolve()
        super().__init__(*args, **kwargs)

    def log_message(self, format: str, *args: Any) -> None:
        logger.info("%s - %s", self.client_address[0], format % args)

    def do_GET(self) -> None:
        """Handle GET requests for API endpoints and static assets."""
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/datasets":
            self._handle_datasets()
            return

        if path == "/api/report":
            self._handle_report(parse_qs(parsed.query, keep_blank_values=False))
            return

        if path.startswith("/api/"):
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Endpoint not found."})
            return

        self._handle_static(path)

    def _reject_disallowed_method(self) -> None:
        self._send_json(
            HTTPStatus.METHOD_NOT_ALLOWED,
            {"error": "Method not allowed. Only GET is supported."},
            extra_headers={"Allow": "GET"},
        )

    def do_POST(self) -> None:
        self._reject_disallowed_method()

    def do_PUT(self) -> None:
        self._reject_disallowed_method()

    def do_DELETE(self) -> None:
        self._reject_disallowed_method()

    def do_PATCH(self) -> None:
        self._reject_disallowed_method()

    def do_OPTIONS(self) -> None:
        self._reject_disallowed_method()

    def do_TRACE(self) -> None:
        self._reject_disallowed_method()

    def _handle_datasets(self) -> None:
        try:
            files = self._service.list_datasets()
            self._send_json(HTTPStatus.OK, {"datasets": files})
        except Exception:
            logger.exception("Failed to list datasets")
            self._send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "Unable to list available datasets."},
            )

    def _handle_report(self, query: dict[str, list[str]]) -> None:
        filename = query.get("file", [None])[0]
        sort_by = query.get("sort_by", ["score"])[0]
        include_zero_raw = query.get("include_zero", ["false"])[0].lower()

        if sort_by not in VALID_SORT_MODES:
            self._send_json(
                HTTPStatus.BAD_REQUEST,
                {"error": "Invalid sort_by parameter."},
            )
            return

        if include_zero_raw not in {"true", "false"}:
            self._send_json(
                HTTPStatus.BAD_REQUEST,
                {"error": "Invalid include_zero parameter."},
            )
            return

        include_zero = include_zero_raw == "true"

        try:
            report = self._service.get_report(
                filename,
                sort_by=sort_by,
                include_zero_attempts=include_zero,
            )
            self._send_json(HTTPStatus.OK, serialize_report(report))
        except InvalidFilenameError:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Invalid dataset filename."})
        except (DatasetNotFoundError, NoDatasetsAvailableError):
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Dataset not found."})
        except (InvalidFileFormatError, SpreadsheetParseError):
            self._send_json(
                HTTPStatus.UNPROCESSABLE_ENTITY,
                {"error": "The selected dataset could not be parsed safely."},
            )
        except Exception:
            logger.exception("Unexpected error generating quiz report")
            self._send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": "Internal server error while generating report."},
            )

    def _handle_static(self, url_path: str) -> None:
        rel_path = "index.html" if url_path in {"", "/"} else url_path.lstrip("/")
        if "\\" in rel_path or "\x00" in rel_path or ".." in rel_path.split("/"):
            self._send_json(HTTPStatus.FORBIDDEN, {"error": "Access denied."})
            return

        candidate = (self._static_dir / rel_path).resolve()
        static_prefix = str(self._static_dir) + os.sep
        if not str(candidate).startswith(static_prefix) and candidate != self._static_dir:
            self._send_json(HTTPStatus.FORBIDDEN, {"error": "Access denied."})
            return

        if not candidate.is_file() or candidate.is_symlink():
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Resource not found."})
            return

        mime = ALLOWED_STATIC_MIME.get(candidate.suffix.lower())
        if not mime:
            self._send_json(HTTPStatus.FORBIDDEN, {"error": "Unsupported file type."})
            return

        content = candidate.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(content)))
        for k, v in build_security_headers(is_api=False).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(content)

    def _send_json(
        self,
        status: HTTPStatus,
        payload: dict[str, Any],
        *,
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        for k, v in build_security_headers(is_api=True).items():
            self.send_header(k, v)
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)


def create_app_server(
    service: QuizDashboardService,
    static_dir: Path | str,
    *,
    host: str = "127.0.0.1",
    port: int = 8080,
) -> ThreadingHTTPServer:
    """Create a configured ThreadingHTTPServer bound strictly to loopback by default."""
    if host not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("Server must bind only to localhost/127.0.0.1.")
    handler_cls = partial(
        QuizRequestHandler,
        service=service,
        static_dir=Path(static_dir),
    )
    return ThreadingHTTPServer((host, port), handler_cls)
