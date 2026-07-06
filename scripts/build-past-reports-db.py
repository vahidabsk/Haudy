import hashlib
import json
import re
from collections import Counter
from pathlib import Path

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("/Users/vahidabbasi/Downloads/Past Reports.xlsx")
OUTPUT = ROOT / "src" / "data" / "auditor-report-findings.json"


def clean(value):
    if value is None:
        return ""
    text = str(value).replace("\r", " ").replace("\n", " ")
    return re.sub(r"\s+", " ", text).strip()


def edition(value):
    text = clean(value)
    match = re.search(r"(\d{4}|\d+(?:st|nd|rd|th))", text, re.I)
    if match:
        return match.group(1)
    return text.replace("Edition", "").strip()


def infer_category(text):
    lowered = text.lower()
    rules = [
        ("Signal History / Processing", ["signal history", "90-day", "90 day", "signal event", "signal process", "handled correctly", "operator response", "dispatch"]),
        ("Record Drawings (As Builts)", ["record drawing", "as built", "as-built", "riser diagram"]),
        ("Battery Calculations", ["battery calculation", "battery calculations", "standby", "alarm power", "battery capacity"]),
        ("Initial Acceptance Test (IAT)", ["initial acceptance", "acceptance test", "iat"]),
        ("Record of Completion (ROC)", ["record of completion", "roc"]),
        ("Contracts", ["service contract", "written agreement", "runner service", "maintenance agreement", "monitoring agreement", "subcontractor"]),
        ("Certificate", ["certificate", "certification", "listed certificate", "posted", "posting"]),
        ("Compatible / Listed Equipment", ["listed equipment", "compatible", "compatibility", "not listed", "listed for"]),
        ("Control & Sub Control(s)", ["control unit", "panel", "module", "annunciator", "enclosure", "cabinet", "communicator", "transmitter", "radio communicator"]),
        ("Secondary Power Requirements", ["secondary power", "battery", "batteries", "manufacturing month", "date code"]),
        ("Power Supply / Circuit", ["power circuit", "circuit breaker", "ac fail", "primary power", "dedicated circuit"]),
        ("Wiring / Workmanship", ["wiring", "wire", "conduit", "junction box", "clearance", "workmanship", "splice", "cable"]),
        ("Sprinkler Supervisory (SS)", ["piv", "os&y", "os and y", "tamper", "waterflow", "water flow", "sprinkler", "valve"]),
        ("Line Security", ["line security", "encrypted line", "standard line", "communication path", "signal line"]),
        ("Guard Service Test", ["guard", "response time", "patrol", "signal received", "central station runner"]),
        ("Device Testing", ["device test", "tested", "functioning", "functional", "alarm signal", "trouble signal", "supervisory signal"]),
    ]
    for category, terms in rules:
        if any(term in lowered for term in terms):
            return category
    return "Past Report Finding"


def infer_review(category, text):
    lowered = text.lower()
    if category == "Signal History / Processing":
        return "Signal Processing Review"
    if category in {"Record Drawings (As Builts)", "Battery Calculations", "Initial Acceptance Test (IAT)", "Record of Completion (ROC)", "Contracts"}:
        return "Documentation Review"
    if category == "Guard Service Test":
        return "Guard Service Test"
    if "service center" in lowered or ("central station" in lowered and "comments" in lowered):
        return "Service Center Comments"
    return "Installation Review"


def keywords(values):
    seen = []
    for token in re.split(r"\s+", " ".join(values)):
        token = re.sub(r"[^A-Za-z0-9.]+", "", token).strip().lower()
        if len(token) > 2 and token not in seen:
            seen.append(token)
    return "; ".join(seen[:80])


def main():
    workbook = openpyxl.load_workbook(SOURCE, data_only=True)
    worksheet = workbook["Past Reports"]
    headers = [clean(cell.value) for cell in worksheet[1]]
    indexes = {header: index for index, header in enumerate(headers)}
    rows = []
    fingerprints = set()

    for row in worksheet.iter_rows(min_row=2, values_only=True):
        standard = clean(row[indexes["Standard"]]).upper()
        year = edition(row[indexes["Edition"]])
        section = clean(row[indexes["Reference Section"]])
        finding = clean(row[indexes["Finding"]])
        required_action = clean(row[indexes["Required Action"]])
        if not finding or not required_action:
            continue
        fingerprint = "|".join([standard, year, section, finding.lower(), required_action.lower()])
        digest = hashlib.sha1(fingerprint.encode("utf-8")).hexdigest()[:12]
        if digest in fingerprints:
            continue
        fingerprints.add(digest)
        category = infer_category(f"{finding} {required_action}")
        review_type = infer_review(category, f"{finding} {required_action}")
        rows.append(
            {
                "id": f"PRX-{len(rows) + 1:04d}-{digest}",
                "standard": standard,
                "year": year,
                "reviewType": review_type,
                "category": category,
                "findingType": category,
                "section": section,
                "finding": finding,
                "requiredAction": required_action,
                "keywords": keywords([standard, year, section, review_type, category, finding, required_action]),
                "examples": "Curated from Past Reports.xlsx",
            }
        )

    OUTPUT.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(rows)} rows written to {OUTPUT}")
    print("Reviews:", Counter(row["reviewType"] for row in rows).most_common())
    print("Categories:", Counter(row["category"] for row in rows).most_common(20))


if __name__ == "__main__":
    main()
