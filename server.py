"""Entrypoint for the Quiz Analytics web application."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
SRC_DIR = ROOT_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from quiz_analytics import (  # noqa: E402
    LocalDataFileRepository,
    QuizDashboardService,
    QuizStatisticsService,
    SecureXlsxQuizParser,
)
from quiz_analytics.web import create_app_server  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    """Parse CLI options, wire dependencies, and run the HTTP server on 127.0.0.1."""
    parser = argparse.ArgumentParser(
        description="Quiz Analytics Dashboard (Top 10 & Statistics)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8080,
        help="Port to listen on 127.0.0.1 (default: 8080)",
    )
    parser.add_argument(
        "--dados-dir",
        type=Path,
        default=ROOT_DIR / "dados",
        help="Path to folder containing .xlsx quiz files",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    repository = LocalDataFileRepository(args.dados_dir)
    xlsx_parser = SecureXlsxQuizParser()
    stats_calculator = QuizStatisticsService()
    service = QuizDashboardService(repository, xlsx_parser, stats_calculator)

    server = create_app_server(
        service=service,
        static_dir=ROOT_DIR / "docs",
        host="127.0.0.1",
        port=args.port,
    )
    actual_host, actual_port = server.server_address[:2]
    print(f"Quiz Analytics rodando em http://{actual_host}:{actual_port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando servidor...")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
