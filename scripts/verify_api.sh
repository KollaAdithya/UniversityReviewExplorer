#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
AUTH_DEV_TOKEN="${AUTH_DEV_TOKEN:-local-dev-verifier-token}"

echo "Verifying API at $BASE_URL"

curl -sf "$BASE_URL/health" | python3 -m json.tool >/dev/null
echo "✓ GET /health"

UNIVERSITIES=$(curl -sf "$BASE_URL/api/v1/universities")
echo "$UNIVERSITIES" | python3 -m json.tool >/dev/null
COUNT=$(echo "$UNIVERSITIES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "✓ GET /api/v1/universities ($COUNT universities)"

UNI_ID=$(echo "$UNIVERSITIES" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['university_id'])")
COURSES=$(curl -sf "$BASE_URL/api/v1/universities/$UNI_ID/courses")
COURSE_ID=$(echo "$COURSES" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['course_id'])")
echo "✓ GET /api/v1/universities/{id}/courses"

curl -sf "$BASE_URL/api/v1/universities/$UNI_ID" | python3 -m json.tool >/dev/null
echo "✓ GET /api/v1/universities/{id}"

curl -sf "$BASE_URL/api/v1/universities/$UNI_ID/courses/$COURSE_ID/analytics" | python3 -m json.tool >/dev/null
echo "✓ GET /api/v1/universities/{id}/courses/{courseId}/analytics"

curl -sf "$BASE_URL/api/v1/universities/$UNI_ID/courses/$COURSE_ID/reviews" | python3 -m json.tool >/dev/null
echo "✓ GET /api/v1/universities/{id}/courses/{courseId}/reviews"

curl -sf "$BASE_URL/api/v1/universities/$UNI_ID/courses/$COURSE_ID/trends" | python3 -m json.tool >/dev/null
echo "✓ GET /api/v1/universities/{id}/courses/{courseId}/trends"

curl -sf "$BASE_URL/api/v1/universities/$UNI_ID/analytics/course-comparison" | python3 -m json.tool >/dev/null
echo "✓ GET /api/v1/universities/{id}/analytics/course-comparison"

curl -sf "$BASE_URL/api/v1/analytics/top-topics?limit=3" | python3 -m json.tool >/dev/null
echo "✓ GET /api/v1/analytics/top-topics"

curl -sf "$BASE_URL/api/v1/auth/me" | python3 -m json.tool >/dev/null
echo "✓ GET /api/v1/auth/me (anonymous)"

OFFERING_ID=$(curl -sf "$BASE_URL/api/v1/universities/$UNI_ID/courses/$COURSE_ID/offerings" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['offering_id'])")

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/reviews" \
  -H "Content-Type: application/json" \
  -d "{\"offering_id\":\"$OFFERING_ID\",\"rating\":4,\"review_text\":\"Should be rejected without auth.\"}")
if [ "$STATUS" != "401" ]; then
  echo "✗ POST /api/v1/reviews without auth should return 401 (got $STATUS)"
  exit 1
fi
echo "✓ POST /api/v1/reviews rejects unauthenticated requests"

curl -sf -X POST "$BASE_URL/api/v1/reviews" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_DEV_TOKEN" \
  -d "{\"offering_id\":\"$OFFERING_ID\",\"rating\":4,\"review_text\":\"Solid course with practical projects.\"}" \
  | python3 -m json.tool >/dev/null
echo "✓ POST /api/v1/reviews (authenticated)"

echo
echo "All API checks passed."
