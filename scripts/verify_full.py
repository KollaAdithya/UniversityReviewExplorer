#!/usr/bin/env python3
"""Deep verification of multi-university Campus Course Review Explorer."""

import json
import subprocess
import sys
import urllib.request
from pathlib import Path

BASE = "http://localhost:8080"
FRONTEND = "http://127.0.0.1:5174"


def get(path: str):
    with urllib.request.urlopen(BASE + path) as response:
        return json.loads(response.read())


def post(path: str, data: dict):
    request = urllib.request.Request(
        BASE + path,
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read())


def main() -> int:
    checks: list[tuple[str, bool]] = []

    health = get("/health")
    checks.append(("Health status ok", health.get("status") == "ok"))
    checks.append(("Multi-university enabled", health.get("multi_university") is True))

    universities = get("/api/v1/universities")
    checks.append(("Has at least 8 universities", len(universities) >= 8))

    mit = next((u for u in universities if "Massachusetts" in u["name"]), None)
    stanford = next((u for u in universities if "Stanford" in u["name"]), None)
    checks.append(("MIT present", mit is not None))
    checks.append(("Stanford present", stanford is not None))

    if mit:
        mit_courses = get(f"/api/v1/universities/{mit['university_id']}/courses?q=CS501")
        checks.append(("MIT CS501 search works", len(mit_courses) >= 1))
        mit_cs501 = mit_courses[0]
        analytics = get(f"/api/v1/universities/{mit['university_id']}/courses/{mit_cs501['course_id']}/analytics")
        checks.append(("MIT CS501 analytics sum to 100%", analytics["positive"] + analytics["neutral"] + analytics["negative"] == 100))

    if mit and stanford:
        mit_cs = get(f"/api/v1/universities/{mit['university_id']}/courses?q=CS501")[0]
        stanford_cs = get(f"/api/v1/universities/{stanford['university_id']}/courses?q=CS501")[0]
        checks.append(("CS501 differs across universities", mit_cs["course_id"] != stanford_cs["course_id"]))

    if mit:
        topics = get(f"/api/v1/universities/{mit['university_id']}/analytics/top-topics?limit=3")
        checks.append(("University top topics endpoint", len(topics.get("topics", [])) > 0))

    cross_topics = get("/api/v1/analytics/top-topics?limit=3")
    checks.append(("Cross-university analytics endpoint", len(cross_topics) >= 2))

    if mit:
        offerings = get(f"/api/v1/universities/{mit['university_id']}/courses/{mit_cs501['course_id']}/offerings")
        before = len(get(f"/api/v1/universities/{mit['university_id']}/courses/{mit_cs501['course_id']}/reviews"))
        post(
            "/api/v1/reviews",
            {
                "offering_id": offerings[0]["offering_id"],
                "rating": 5,
                "review_text": "Verification: excellent projects with challenging exams.",
            },
        )
        after = len(get(f"/api/v1/universities/{mit['university_id']}/courses/{mit_cs501['course_id']}/reviews"))
        checks.append(("Review submission works", after == before + 1))

    cors = subprocess.run(
        [
            "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
            "-H", "Origin: http://127.0.0.1:5174",
            "-H", "Access-Control-Request-Method: GET",
            "-X", "OPTIONS", f"{BASE}/api/v1/universities",
        ],
        capture_output=True, text=True,
    )
    checks.append(("CORS preflight ok", cors.stdout.strip() in ("200", "204")))

    frontend_status = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", f"{FRONTEND}/"],
        capture_output=True, text=True,
    )
    checks.append(("Frontend serves UI", frontend_status.stdout.strip() == "200"))

    print("=" * 52)
    print("MULTI-UNIVERSITY VERIFICATION REPORT")
    print("=" * 52)
    failed = 0
    for name, ok in checks:
        print(f"[{'PASS' if ok else 'FAIL'}] {name}")
        if not ok:
            failed += 1
    print("=" * 52)
    print(f"Results: {len(checks) - failed} passed, {failed} failed out of {len(checks)} checks")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
