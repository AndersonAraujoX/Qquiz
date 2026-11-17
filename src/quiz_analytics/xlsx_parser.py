"""Hardened XLSX parser for Quizizz / Wayground quiz exports."""

from __future__ import annotations

import io
import re
import xml.etree.ElementTree as ET
import zipfile
from typing import Any

from quiz_analytics.models import (
    ParticipantAttempt,
    QuestionStat,
    QuizDataset,
    QuizDetails,
)

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"main": MAIN_NS, "r": REL_NS}

MAX_XML_UNCOMPRESSED_BYTES = 10 * 1024 * 1024  # 10 MB per XML entry
DISALLOWED_XML_PATTERN = re.compile(rb"<!\s*(DOCTYPE|ENTITY)", re.IGNORECASE)
WHITESPACE_RE = re.compile(r"\s+")


class SpreadsheetParseError(Exception):
    """Raised when an XLSX archive cannot be parsed safely or lacks required data."""


def _parse_xml_safely(raw_xml: bytes, entry_name: str) -> ET.Element:
    if len(raw_xml) > MAX_XML_UNCOMPRESSED_BYTES:
        raise SpreadsheetParseError(f"XML entry '{entry_name}' exceeds safe size limit.")
    if DISALLOWED_XML_PATTERN.search(raw_xml):
        raise SpreadsheetParseError(
            f"XML entry '{entry_name}' contains forbidden DTD/ENTITY declarations."
        )
    try:
        return ET.fromstring(raw_xml)
    except ET.ParseError as exc:
        raise SpreadsheetParseError(f"Malformed XML in '{entry_name}'.") from exc


def _read_zip_entry_safely(zf: zipfile.ZipFile, member_path: str) -> bytes:
    try:
        info = zf.getinfo(member_path)
    except KeyError as exc:
        raise SpreadsheetParseError(f"Missing required workbook entry '{member_path}'.") from exc

    if info.file_size > MAX_XML_UNCOMPRESSED_BYTES:
        raise SpreadsheetParseError(f"Entry '{member_path}' exceeds safe uncompressed size.")

    with zf.open(info, "r") as stream:
        data = stream.read(MAX_XML_UNCOMPRESSED_BYTES + 1)
    if len(data) > MAX_XML_UNCOMPRESSED_BYTES:
        raise SpreadsheetParseError(f"Entry '{member_path}' exceeded decompression limit.")
    return data


def _column_from_ref(cell_ref: str) -> str:
    return "".join(ch for ch in cell_ref if ch.isalpha())


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return WHITESPACE_RE.sub(" ", str(value)).strip()


def _parse_int(value: Any, default: int = 0) -> int:
    if value is None or value == "" or value == "-":
        return default
    try:
        return int(round(float(str(value).strip())))
    except ValueError:
        return default


def _parse_percent(value: Any, default: float = 0.0) -> float:
    if value is None or value == "" or value == "-":
        return default
    text = str(value).strip()
    if text.endswith("%"):
        try:
            return round(float(text[:-1].strip()), 2)
        except ValueError:
            return default
    try:
        numeric = float(text)
        # Excel percentage cells stored as decimals (0.0 .. 1.0)
        if 0.0 <= numeric <= 1.0:
            return round(numeric * 100.0, 2)
        return round(numeric, 2)
    except ValueError:
        return default


def _parse_duration_seconds(value: Any) -> float:
    if value is None or value == "" or value == "-":
        return 0.0
    text = str(value).strip()
    if ":" in text:
        parts = text.split(":")
        try:
            if len(parts) == 3:
                h, m, s = (float(p) for p in parts)
                return max(0.0, h * 3600.0 + m * 60.0 + s)
            if len(parts) == 2:
                m, s = (float(p) for p in parts)
                return max(0.0, m * 60.0 + s)
        except ValueError:
            return 0.0
    try:
        numeric = float(text)
    except ValueError:
        return 0.0
    if numeric < 0:
        return 0.0
    # Excel stores time-of-day/durations as fraction of a 24h day (86400s).
    return round(numeric * 86400.0, 2)


class SecureXlsxQuizParser:
    """Parses Quizizz/Wayground XLSX spreadsheets using hardened XML/ZIP checks."""

    def parse(self, raw_bytes: bytes, filename: str) -> QuizDataset:
        """Parse raw .xlsx bytes into a structured QuizDataset."""
        if not raw_bytes:
            raise SpreadsheetParseError("Empty spreadsheet payload.")

        try:
            with zipfile.ZipFile(io.BytesIO(raw_bytes), "r") as zf:
                sheet_map = self._resolve_sheet_paths(zf)
                shared_strings = self._load_shared_strings(zf)

                participant_path = sheet_map.get("Participant Data")
                if not participant_path:
                    raise SpreadsheetParseError("Sheet 'Participant Data' was not found.")

                participant_rows = self._read_sheet_rows(zf, participant_path, shared_strings)
                participants = self._parse_participants(participant_rows)

                questions: tuple[QuestionStat, ...] = ()
                overview_path = sheet_map.get("Overview")
                if overview_path:
                    overview_rows = self._read_sheet_rows(zf, overview_path, shared_strings)
                    questions = self._parse_questions(overview_rows)

                details = QuizDetails(
                    game_started_on="",
                    game_ended_on="",
                    game_type="",
                    reported_participants=len({p.display_name.lower() for p in participants}),
                    total_attempts=len(participants),
                    class_accuracy_percent=0.0,
                )
                details_path = sheet_map.get("Quiz Details")
                if details_path:
                    details_rows = self._read_sheet_rows(zf, details_path, shared_strings)
                    details = self._parse_quiz_details(details_rows, fallback=details)

                return QuizDataset(
                    filename=filename,
                    details=details,
                    participants=participants,
                    questions=questions,
                )
        except zipfile.BadZipFile as exc:
            raise SpreadsheetParseError("File is not a valid ZIP/XLSX archive.") from exc

    def _resolve_sheet_paths(self, zf: zipfile.ZipFile) -> dict[str, str]:
        wb_xml = _parse_xml_safely(
            _read_zip_entry_safely(zf, "xl/workbook.xml"), "xl/workbook.xml"
        )
        rels_xml = _parse_xml_safely(
            _read_zip_entry_safely(zf, "xl/_rels/workbook.xml.rels"),
            "xl/_rels/workbook.xml.rels",
        )

        rel_targets: dict[str, str] = {}
        for rel in rels_xml.findall(f"{{{PKG_REL_NS}}}Relationship"):
            rel_id = rel.attrib.get("Id", "")
            target = rel.attrib.get("Target", "").lstrip("/")
            if not target.startswith("xl/"):
                target = f"xl/{target}"
            rel_targets[rel_id] = target

        sheet_map: dict[str, str] = {}
        for sheet in wb_xml.findall(".//main:sheet", NS):
            name = sheet.attrib.get("name", "")
            rid = sheet.attrib.get(f"{{{REL_NS}}}id", "")
            if name and rid in rel_targets:
                sheet_map[name] = rel_targets[rid]
        return sheet_map

    def _load_shared_strings(self, zf: zipfile.ZipFile) -> list[str]:
        if "xl/sharedStrings.xml" not in zf.namelist():
            return []
        ss_xml = _parse_xml_safely(
            _read_zip_entry_safely(zf, "xl/sharedStrings.xml"),
            "xl/sharedStrings.xml",
        )
        strings: list[str] = []
        for si in ss_xml.findall(".//main:si", NS):
            parts = [t.text or "" for t in si.findall(".//main:t", NS)]
            strings.append("".join(parts))
        return strings

    def _read_sheet_rows(
        self,
        zf: zipfile.ZipFile,
        sheet_path: str,
        shared_strings: list[str],
    ) -> list[dict[str, str | None]]:
        sheet_xml = _parse_xml_safely(
            _read_zip_entry_safely(zf, sheet_path),
            sheet_path,
        )
        rows: list[dict[str, str | None]] = []
        for row_el in sheet_xml.findall(".//main:row", NS):
            row_dict: dict[str, str | None] = {}
            for cell_el in row_el.findall("main:c", NS):
                ref = cell_el.attrib.get("r", "")
                col = _column_from_ref(ref)
                if not col:
                    continue
                cell_type = cell_el.attrib.get("t", "")
                v_el = cell_el.find("main:v", NS)
                is_el = cell_el.find("main:is", NS)
                val: str | None = None
                if v_el is not None and v_el.text is not None:
                    val = v_el.text
                    if cell_type == "s":
                        idx = int(val)
                        val = shared_strings[idx] if 0 <= idx < len(shared_strings) else ""
                elif is_el is not None:
                    val = "".join(t.text or "" for t in is_el.findall(".//main:t", NS))
                row_dict[col] = val
            if row_dict:
                rows.append(row_dict)
        return rows

    def _parse_participants(
        self, rows: list[dict[str, str | None]]
    ) -> tuple[ParticipantAttempt, ...]:
        if not rows:
            return ()

        header_row = rows[0]
        header_to_col = {
            _clean_text(title): col for col, title in header_row.items() if title is not None
        }

        def get_field(row: dict[str, str | None], header_name: str) -> str | None:
            col = header_to_col.get(header_name)
            return row.get(col) if col else None

        participants: list[ParticipantAttempt] = []
        for idx, row in enumerate(rows[1:], start=1):
            player_name = _clean_text(get_field(row, "Player Name"))
            first_name = _clean_text(get_field(row, "First Name"))
            last_name = _clean_text(get_field(row, "Last Name"))
            if not (player_name or first_name or last_name):
                continue

            participants.append(
                ParticipantAttempt(
                    sheet_rank=_parse_int(get_field(row, "Rank"), default=idx),
                    first_name=first_name,
                    last_name=last_name,
                    player_name=player_name,
                    attempted_questions=_parse_int(
                        get_field(row, "Total Questions Attempted")
                    ),
                    accuracy_percent=_parse_percent(get_field(row, "Accuracy")),
                    score=_parse_int(get_field(row, "Score")),
                    correct=_parse_int(get_field(row, "Correct")),
                    yet_to_be_graded=_parse_int(get_field(row, "Yet to be graded")),
                    partially_correct=_parse_int(get_field(row, "Partially correct")),
                    incorrect=_parse_int(get_field(row, "Incorrect")),
                    ungraded=_parse_int(get_field(row, "Ungraded")),
                    unattempted=_parse_int(get_field(row, "Unattempted")),
                    total_time_seconds=_parse_duration_seconds(
                        get_field(row, "Total Time Taken")
                    ),
                    started_at=_clean_text(get_field(row, "Started At")),
                    device_info=_clean_text(get_field(row, "Info")) or "Desconhecido",
                    points=_parse_int(get_field(row, "Points")),
                    total_points=_parse_int(get_field(row, "Total Points")),
                )
            )
        return tuple(participants)

    def _parse_questions(
        self, rows: list[dict[str, str | None]]
    ) -> tuple[QuestionStat, ...]:
        if not rows:
            return ()

        header_row = rows[0]
        header_to_col = {
            _clean_text(title): col for col, title in header_row.items() if title is not None
        }

        def get_field(row: dict[str, str | None], header_name: str) -> str | None:
            col = header_to_col.get(header_name)
            return row.get(col) if col else None

        questions: list[QuestionStat] = []
        for row in rows[1:]:
            q_num_raw = get_field(row, "#")
            q_text = _clean_text(get_field(row, "Question"))
            if not q_num_raw or not q_text:
                continue
            q_num = _parse_int(q_num_raw, default=0)
            if q_num <= 0:
                continue
            questions.append(
                QuestionStat(
                    number=q_num,
                    question_text=q_text,
                    question_type=_clean_text(get_field(row, "Question Type")) or "Multiple Choice",
                    accuracy_percent=_parse_percent(get_field(row, "Question Accuracy")),
                    average_time_seconds=_parse_duration_seconds(
                        get_field(row, "Average Time per Question (hh:mm:ss)")
                    ),
                    correct_count=_parse_int(get_field(row, "Correct")),
                    incorrect_count=_parse_int(get_field(row, "Incorrect")),
                    unattempted_count=_parse_int(get_field(row, "Unattempted")),
                )
            )
        return tuple(questions)

    def _parse_quiz_details(
        self, rows: list[dict[str, str | None]], fallback: QuizDetails
    ) -> QuizDetails:
        kv: dict[str, str] = {}
        for row in rows[1:]:
            key = _clean_text(row.get("A"))
            val = _clean_text(row.get("B"))
            if key:
                kv[key] = val

        return QuizDetails(
            game_started_on=kv.get("Game Started On", fallback.game_started_on),
            game_ended_on=kv.get("Game Ended On", fallback.game_ended_on),
            game_type=kv.get("Game Type", fallback.game_type),
            reported_participants=_parse_int(
                kv.get("Participants"), default=fallback.reported_participants
            ),
            total_attempts=_parse_int(
                kv.get("Total Attempts"), default=fallback.total_attempts
            ),
            class_accuracy_percent=_parse_percent(
                kv.get("Class Accuracy"), default=fallback.class_accuracy_percent
            ),
        )
