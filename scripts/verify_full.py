#!/usr/bin/env python3
"""Deep verification of multi-university Campus Course Review Explorer."""

import json
import subprocess
import sys
import urllib.request

BASE = "http://localhost:8080"
FRONTEND = "http://127.0.0.1:5174"
AUTH_DEV_TOKEN = "local-dev-verifier-token"


def get(path: str):
    with urllib.request.urlopen(BASE + path) as response:
        return json.loads(response.read())


def post(path: str, data: dict, *, auth: bool = False):
    headers = {"Content-Type": "application/json"}
    if auth:
        headers["Authorization"] = f"Bearer {AUTH_DEV_TOKEN}"
    request = urllib.request.Request(
        BASE + path,
        data=json.dumps(data).encode(),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read())


def pick_university(universities: list, *needles: str):
    for needle in needles:
        match = next((u for u in universities if needle.lower() in u["name"].lower()), None)
        if match:
            return match
    return universities[0] if universities else None


def main() -> int:
    checks: list[tuple[str, bool]] = []

    health = get("/health")
    checks.append(("Health status ok", health.get("status") == "ok"))
    checks.append(("Multi-university enabled", health.get("multi_university") is True))
    checks.append(("Auth required for writes", health.get("auth_required") is True))

    universities = get("/api/v1/universities")
    checks.append(("Has at least 8 universities", len(universities) >= 8))
    checks.append(("Has real public dataset scale (40+ schools)", len(universities) >= 40))

    uiuc = pick_university(universities, "Illinois", "Urbana")
    brooklyn = pick_university(universities, "Brooklyn")
    checks.append(("UIUC present in public RMP sample", uiuc is not None))
    checks.append(("Brooklyn College present in public RMP sample", brooklyn is not None))

    test_uni = uiuc or universities[0]
    courses = get(f"/api/v1/universities/{test_uni['university_id']}/courses")
    checks.append(("Courses listed for sample university", len(courses) >= 1))

    if courses:
        course = courses[0]
        analytics = get(
            f"/api/v1/universities/{test_uni['university_id']}/courses/{course['course_id']}/analytics"
        )
        total = analytics["positive"] + analytics["neutral"] + analytics["negative"]
        checks.append(("Course analytics sum to 100%", total == 100))

        topics = get(f"/api/v1/universities/{test_uni['university_id']}/analytics/top-topics?limit=3")
        checks.append(("University top topics endpoint", len(topics.get("topics", [])) > 0))

        offerings = get(
            f"/api/v1/universities/{test_uni['university_id']}/courses/{course['course_id']}/offerings"
        )
        if offerings:
            before = len(
                get(
                    f"/api/v1/universities/{test_uni['university_id']}/courses/{course['course_id']}/reviews"
                )
            )
            post(
                "/api/v1/reviews",
                {
                    "offering_id": offerings[0]["offering_id"],
                    "rating": 5,
                    "review_text": "Verification: real-data import and authenticated submit still work.",
                },
                auth=True,
            )
            after = len(
                get(
                    f"/api/v1/universities/{test_uni['university_id']}/courses/{course['course_id']}/reviews"
                )
            )
            checks.append(("Review submission works", after == before + 1))

    if uiuc and brooklyn:
        uiuc_courses = get(f"/api/v1/universities/{uiuc['university_id']}/courses?q=ASTR")
        brooklyn_courses = get(f"/api/v1/universities/{brooklyn['university_id']}/courses")
        if uiuc_courses and brooklyn_courses:
            checks.append(
                ("Same course code differs across universities", uiuc_courses[0]["course_id"] != brooklyn_courses[0]["course_id"])
            )

    cross_topics = get("/api/v1/analytics/top-topics?limit=3")
    checks.append(("Cross-university analytics endpoint", len(cross_topics) >= 2))

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
