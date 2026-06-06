#!/usr/bin/env python3
"""E2E test: AI summary dropdown providers (default, groq, ollama)."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("API_BASE", "http://localhost:8080")


def get(path: str) -> dict:
    with urllib.request.urlopen(BASE + path) as response:
        return json.loads(response.read())


def post(path: str) -> dict:
    request = urllib.request.Request(BASE + path, method="POST", data=b"{}")
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read())


def main() -> int:
    health = get("/health")
    providers = health.get("summary_providers", {})
    print("Summary providers:")
    print(json.dumps(providers, indent=2))

    universities = get("/api/v1/universities")
    uni_id = universities[0]["university_id"]
    courses = get(f"/api/v1/universities/{uni_id}/courses")
    course_id = courses[0]["course_id"]
    base = f"/api/v1/universities/{uni_id}/courses/{course_id}/summary/refresh"

    failed = 0
    for provider in ("default", "openai", "groq", "ollama"):
        try:
            result = post(f"{base}?provider={provider}")
            ok = bool(result.get("summary"))
            used = result.get("source")
            requested = result.get("requested_provider")
            print(f"\n[{provider}] requested={requested} source={used} model={result.get('model')}")
            print(f"  summary: {result['summary'][:120]}…")
            if provider == "default" and used != "mock":
                print("  FAIL: default should use mock")
                failed += 1
            elif provider in ("openai", "groq", "ollama"):
                info = providers.get(provider, {})
                if info.get("available") and used != provider:
                    print(f"  FAIL: expected source={provider}, got {used}")
                    failed += 1
                elif not info.get("available") and used != "mock":
                    print(f"  FAIL: unavailable {provider} should fall back to mock")
                    failed += 1
        except urllib.error.HTTPError as exc:
            print(f"\n[{provider}] HTTP {exc.code}: {exc.read().decode()}")
            failed += 1

    print("\n" + ("All provider tests passed." if failed == 0 else f"{failed} test(s) failed."))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
