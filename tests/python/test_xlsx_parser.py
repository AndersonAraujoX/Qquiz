"""Unit tests for SecureXlsxQuizParser."""

from __future__ import annotations

import io
import sys
import unittest
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT_DIR / "src"))

from quiz_analytics.xlsx_parser import (  # noqa: E402
    SecureXlsxQuizParser,
    SpreadsheetParseError,
)


def _build_minimal_xlsx(
    *,
    participant_rows_xml: str,
    overview_rows_xml: str = "",
    details_rows_xml: str = "",
    shared_strings: list[str] | None = None,
    inject_doctype: bool = False,
) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        wb = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            "<sheets>"
            '<sheet name="Overview" sheetId="1" r:id="rId1"/>'
            '<sheet name="Participant Data" sheetId="2" r:id="rId2"/>'
            '<sheet name="Quiz Details" sheetId="3" r:id="rId3"/>'
            "</sheets></workbook>"
        )
        rels = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>'
            "</Relationships>"
        )
        zf.writestr("xl/workbook.xml", wb)
        zf.writestr("xl/_rels/workbook.xml.rels", rels)

        if shared_strings is not None:
            si_items = "".join(f"<si><t>{s}</t></si>" for s in shared_strings)
            ss = (
                '<?xml version="1.0" encoding="UTF-8"?>'
                '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                f"{si_items}</sst>"
            )
            zf.writestr("xl/sharedStrings.xml", ss)

        doctype = "<!DOCTYPE worksheet [<!ENTITY xxe 'boom'>]>" if inject_doctype else ""
        sheet_tpl = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            f"{doctype}"
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            "<sheetData>{rows}</sheetData></worksheet>"
        )
        zf.writestr("xl/worksheets/sheet1.xml", sheet_tpl.format(rows=overview_rows_xml))
        zf.writestr("xl/worksheets/sheet2.xml", sheet_tpl.format(rows=participant_rows_xml))
        zf.writestr("xl/worksheets/sheet3.xml", sheet_tpl.format(rows=details_rows_xml))
    return buf.getvalue()


class TestSecureXlsxQuizParser(unittest.TestCase):
    """Tests for XLSX parsing, edge cases, and XML hardening."""

    def setUp(self) -> None:
        self.parser = SecureXlsxQuizParser()

    def test_parse_valid_xlsx_extracts_participants_questions_and_details(self) -> None:
        # Arrange
        shared = [
            "Rank",
            "First Name",
            "Last Name",
            "Player Name",
            "Total Questions Attempted",
            "Accuracy",
            "Score",
            "Correct",
            "Incorrect",
            "Unattempted",
            "Total Time Taken",
            "Info",
            "Ana",
            "Silva",
            "ana_s",
            "100%",
            "Chrome on Linux",
            "#",
            "Question",
            "Question Type",
            "Question Accuracy",
            "Average Time per Question (hh:mm:ss)",
            "What is a qubit?",
            "Multiple Choice",
            "85%",
            "00:00:25",
            "Name",
            "Value",
            "Game Type",
            "Instructor-paced quiz",
            "Class Accuracy",
        ]
        p_rows = (
            '<row r="1">'
            '<c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c>'
            '<c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c>'
            '<c r="E1" t="s"><v>4</v></c><c r="F1" t="s"><v>5</v></c>'
            '<c r="G1" t="s"><v>6</v></c><c r="H1" t="s"><v>7</v></c>'
            '<c r="I1" t="s"><v>8</v></c><c r="J1" t="s"><v>9</v></c>'
            '<c r="K1" t="s"><v>10</v></c><c r="L1" t="s"><v>11</v></c>'
            "</row>"
            '<row r="2">'
            '<c r="A2"><v>1</v></c><c r="B2" t="s"><v>12</v></c>'
            '<c r="C2" t="s"><v>13</v></c><c r="D2" t="s"><v>14</v></c>'
            '<c r="E2"><v>5</v></c><c r="F2" t="s"><v>15</v></c>'
            '<c r="G2"><v>4200</v></c><c r="H2"><v>5</v></c>'
            '<c r="I2"><v>0</v></c><c r="J2"><v>0</v></c>'
            '<c r="K2"><v>0.001</v></c><c r="L2" t="s"><v>16</v></c>'
            "</row>"
        )
        o_rows = (
            '<row r="1">'
            '<c r="A1" t="s"><v>17</v></c><c r="B1" t="s"><v>18</v></c>'
            '<c r="C1" t="s"><v>19</v></c><c r="D1" t="s"><v>20</v></c>'
            '<c r="E1" t="s"><v>21</v></c><c r="F1" t="s"><v>7</v></c>'
            '<c r="G1" t="s"><v>8</v></c><c r="H1" t="s"><v>9</v></c>'
            "</row>"
            '<row r="2">'
            '<c r="A2"><v>1</v></c><c r="B2" t="s"><v>22</v></c>'
            '<c r="C2" t="s"><v>23</v></c><c r="D2" t="s"><v>24</v></c>'
            '<c r="E2" t="s"><v>25</v></c><c r="F2"><v>10</v></c>'
            '<c r="G2"><v>2</v></c><c r="H2"><v>0</v></c>'
            "</row>"
        )
        d_rows = (
            '<row r="1"><c r="A1" t="s"><v>26</v></c><c r="B1" t="s"><v>27</v></c></row>'
            '<row r="2"><c r="A2" t="s"><v>28</v></c><c r="B2" t="s"><v>29</v></c></row>'
            '<row r="3"><c r="A3" t="s"><v>30</v></c><c r="B3" t="s"><v>24</v></c></row>'
        )
        raw = _build_minimal_xlsx(
            participant_rows_xml=p_rows,
            overview_rows_xml=o_rows,
            details_rows_xml=d_rows,
            shared_strings=shared,
        )

        # Act
        dataset = self.parser.parse(raw, "sample.xlsx")

        # Assert
        self.assertEqual(dataset.filename, "sample.xlsx")
        self.assertEqual(len(dataset.participants), 1)
        p = dataset.participants[0]
        self.assertEqual(p.display_name, "Ana Silva")
        self.assertEqual(p.score, 4200)
        self.assertEqual(p.accuracy_percent, 100.0)
        self.assertAlmostEqual(p.total_time_seconds, 86.4, places=2)
        self.assertEqual(len(dataset.questions), 1)
        self.assertEqual(dataset.questions[0].average_time_seconds, 25.0)
        self.assertEqual(dataset.details.class_accuracy_percent, 85.0)

    def test_parse_rejects_doctype_entity_xml_payload(self) -> None:
        # Arrange
        raw = _build_minimal_xlsx(participant_rows_xml="", inject_doctype=True)

        # Act & Assert
        with self.assertRaises(SpreadsheetParseError):
            self.parser.parse(raw, "evil.xlsx")

    def test_parse_rejects_empty_or_non_zip_bytes(self) -> None:
        # Arrange / Act / Assert
        with self.assertRaises(SpreadsheetParseError):
            self.parser.parse(b"", "empty.xlsx")
        with self.assertRaises(SpreadsheetParseError):
            self.parser.parse(b"not-a-zip", "corrupt.xlsx")

    def test_parse_real_workspace_spreadsheet_if_present(self) -> None:
        # Arrange
        real_file = ROOT_DIR / "dados" / "QuantumComputingSchool-2026-11-16.xlsx"
        if not real_file.is_file():
            self.skipTest("Sample spreadsheet not present.")

        # Act
        dataset = self.parser.parse(real_file.read_bytes(), real_file.name)

        # Assert
        self.assertEqual(len(dataset.participants), 73)
        self.assertEqual(len(dataset.questions), 8)
        self.assertEqual(dataset.participants[0].display_name, "Pedro Marques Pontes")
        self.assertEqual(dataset.participants[0].score, 6330)


if __name__ == "__main__":
    unittest.main()
