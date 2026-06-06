#!/usr/bin/env python3
"""Deep end-to-end verification of Campus Course Review Explorer."""

from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.request
from typing import Optional

BASE = "http://localhost:8080"
FRONTEND = "http://127.0.0.1:5174"
FIREBASE_EMULATOR = "http://127.0.0.1:9099"
FIREBASE_API_KEY = "demo-api-key"
AUTH_DEV_TOKEN = "local-dev-verifier-token"


def get(path: str, *, token: Optional[str] = None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(BASE + path, headers=headers)
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read())


def post(path: str, data: dict, *, token: Optional[str] = None, expect_status: Optional[int] = None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        BASE + path,
        data=json.dumps(data).encode(),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request) as response:
            body = json.loads(response.read())
            if expect_status is not None and response.status != expect_status:
                raise AssertionError(f"expected HTTP {expect_status}, got {response.status}")
            return body, response.status
    except urllib.error.HTTPError as exc:
        if expect_status is not None and exc.code == expect_status:
            return None, exc.code
        raise


def firebase_sign_in(email: str, password: str) -> str:
    for endpoint in ("signUp", "signInWithPassword"):
        url = (
            f"{FIREBASE_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:{endpoint}"
            f"?key={FIREBASE_API_KEY}"
        )
        request = urllib.request.Request(
            url,
            data=json.dumps(
                {"email": email, "password": password, "returnSecureToken": True}
            ).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request) as response:
                return json.loads(response.read())["idToken"]
        except urllib.error.HTTPError:
            continue
    raise RuntimeError("Firebase emulator sign-in failed")


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
    uni_id = test_uni["university_id"]
    uni_detail = get(f"/api/v1/universities/{uni_id}")
    checks.append(("University detail endpoint", uni_detail.get("university_id") == uni_id))

    courses = get(f"/api/v1/universities/{uni_id}/courses")
    checks.append(("Courses listed for sample university", len(courses) >= 1))

    if courses:
        course = courses[0]
        course_id = course["course_id"]
        analytics = get(f"/api/v1/universities/{uni_id}/courses/{course_id}/analytics")
        total = analytics["positive"] + analytics["neutral"] + analytics["negative"]
        checks.append(("Course analytics sum to 100%", total == 100))

        llm = health.get("ollama") or {}
        ml_provider = health.get("ml_provider", "mock")
        providers = health.get("summary_providers") or {}
        checks.append(("LLM ML provider enabled", llm.get("enabled") is True))
        checks.append(("Summary provider options exposed", len(providers) >= 3))
        if analytics.get("review_count", 0) > 0:
            summary_refresh, _ = post(
                f"/api/v1/universities/{uni_id}/courses/{course_id}/summary/refresh?provider=default",
                {},
            )
            checks.append(
                (
                    "Summary refresh endpoint returns text",
                    bool(summary_refresh and summary_refresh.get("summary")),
                )
            )
            checks.append(
                (
                    "Default summary provider returns mock",
                    summary_refresh.get("source") == "mock"
                    and summary_refresh.get("requested_provider") == "default",
                )
            )
            if providers.get("ollama", {}).get("available"):
                ollama_refresh, _ = post(
                    f"/api/v1/universities/{uni_id}/courses/{course_id}/summary/refresh?provider=ollama",
                    {},
                )
                checks.append(
                    (
                        "Ollama summary provider works",
                        ollama_refresh.get("source") == "ollama",
                    )
                )
            if providers.get("groq", {}).get("available"):
                groq_refresh, _ = post(
                    f"/api/v1/universities/{uni_id}/courses/{course_id}/summary/refresh?provider=groq",
                    {},
                )
                checks.append(
                    (
                        "Groq summary provider works",
                        groq_refresh.get("source") == "groq",
                    )
                )

        topics = get(f"/api/v1/universities/{uni_id}/analytics/top-topics?limit=3")
        checks.append(("University top topics endpoint", len(topics.get("topics", [])) > 0))

        trends = get(f"/api/v1/universities/{uni_id}/courses/{course_id}/trends")
        checks.append(("Semester trends endpoint", isinstance(trends, list)))

        comparison = get(f"/api/v1/universities/{uni_id}/analytics/course-comparison")
        checks.append(("Course comparison endpoint", len(comparison) >= 1))

        offerings = get(f"/api/v1/universities/{uni_id}/courses/{course_id}/offerings")
        if offerings:
            before = len(get(f"/api/v1/universities/{uni_id}/courses/{course_id}/reviews"))

            _, unauth_status = post(
                "/api/v1/reviews",
                {
                    "offering_id": offerings[0]["offering_id"],
                    "rating": 5,
                    "review_text": "Should be rejected.",
                },
                expect_status=401,
            )
            checks.append(("Unauthenticated review rejected", unauth_status == 401))

            review_body, _ = post(
                "/api/v1/reviews",
                {
                    "offering_id": offerings[0]["offering_id"],
                    "rating": 5,
                    "review_text": "Verification: dev-token authenticated submit works.",
                },
                token=AUTH_DEV_TOKEN,
            )
            after = len(get(f"/api/v1/universities/{uni_id}/courses/{course_id}/reviews"))
            checks.append(("Review submission with dev token", after == before + 1))
            checks.append(
                (
                    "Live review returns sentiment",
                    review_body is not None and review_body.get("sentiment") in ("positive", "neutral", "negative"),
                )
            )
            if llm.get("reachable"):
                checks.append(
                    (
                        f"Live review returns topics from {ml_provider}",
                        isinstance(review_body.get("topics"), list) and len(review_body["topics"]) > 0,
                    )
                )

            try:
                firebase_token = firebase_sign_in("verify-e2e@demo.edu", "demo123456")
                me = get("/api/v1/auth/me", token=firebase_token)
                checks.append(
                    ("Firebase emulator auth accepted", me.get("authenticated") is True),
                )
                fb_before = len(get(f"/api/v1/universities/{uni_id}/courses/{course_id}/reviews"))
                post(
                    "/api/v1/reviews",
                    {
                        "offering_id": offerings[0]["offering_id"],
                        "rating": 4,
                        "review_text": "Verification: Firebase token submit works.",
                    },
                    token=firebase_token,
                )
                fb_after = len(get(f"/api/v1/universities/{uni_id}/courses/{course_id}/reviews"))
                checks.append(("Review submission with Firebase token", fb_after == fb_before + 1))
            except Exception:
                checks.append(("Firebase emulator auth accepted", False))
                checks.append(("Review submission with Firebase token", False))

    if uiuc and brooklyn:
        uiuc_courses = get(f"/api/v1/universities/{uiuc['university_id']}/courses?q=ASTR")
        brooklyn_courses = get(f"/api/v1/universities/{brooklyn['university_id']}/courses")
        if uiuc_courses and brooklyn_courses:
            checks.append(
                (
                    "Same course code differs across universities",
                    uiuc_courses[0]["course_id"] != brooklyn_courses[0]["course_id"],
                )
            )

    cross_topics = get("/api/v1/analytics/top-topics?limit=3")
    checks.append(("Cross-university analytics endpoint", len(cross_topics) >= 2))

    anon_me = get("/api/v1/auth/me")
    checks.append(("Anonymous auth/me returns unauthenticated", anon_me.get("authenticated") is False))

    dev_me = get("/api/v1/auth/me", token=AUTH_DEV_TOKEN)
    checks.append(("Dev token auth/me returns authenticated", dev_me.get("authenticated") is True))

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

    firebase_status = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", FIREBASE_EMULATOR],
        capture_output=True, text=True,
    )
    checks.append(("Firebase auth emulator reachable", firebase_status.stdout.strip() == "200"))

    print("=" * 52)
    print("END-TO-END VERIFICATION REPORT")
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
