#!/usr/bin/env bash
# End-to-end smoke test. Usage: ./scripts/smoke.sh [base-url]
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

EMAIL="smoke.$(date +%s)@example.com"
PASSWORD="password123"
JSON="Content-Type: application/json"

step() { printf '  -> %s\n' "$1"; }
fail() { printf '  FAIL: %s\n' "$1" >&2; exit 1; }
expect() { # expect <description> <actual> <expected>
  [ "$2" = "$3" ] || fail "$1 (expected '$3', got '$2')"
  step "$1"
}

echo "Smoke test against $BASE_URL"

expect "health check" \
  "$(curl -fsS "$BASE_URL/api/health" | jq -r '.status')" "ok"

expect "anonymous access is rejected" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/teams")" "401"

expect "registration" \
  "$(curl -s -o /dev/null -w '%{http_code}' -c "$COOKIE_JAR" -H "$JSON" \
      -d "{\"name\":\"Smoke Test\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
      "$BASE_URL/api/auth/register")" "201"

expect "session works (/auth/me)" \
  "$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/auth/me" | jq -r '.user.email')" "$EMAIL"

USER_ID="$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/auth/me" | jq -r '.user.id')"

expect "unprefixed /auth alias works" \
  "$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/auth/me" | jq -r '.user.email')" "$EMAIL"

TEAM_ID="$(curl -fsS -b "$COOKIE_JAR" -H "$JSON" \
  -d '{"name":"Smoke Team","description":"created by smoke test"}' \
  "$BASE_URL/api/teams" | jq -r '.team.id')"
expect "team created" "$([ -n "$TEAM_ID" ] && echo yes)" "yes"

expect "unprefixed /teams alias works" \
  "$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/teams" | jq '.teams | length')" "1"

TASK_ID="$(curl -fsS -b "$COOKIE_JAR" -H "$JSON" \
  -d "{\"teamId\":$TEAM_ID,\"title\":\"Smoke task\",\"dueDate\":\"2026-11-15\"}" \
  "$BASE_URL/api/tasks" | jq -r '.task.id')"
expect "task created" "$([ -n "$TASK_ID" ] && echo yes)" "yes"

expect "task filtered by team" \
  "$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/tasks?teamId=$TEAM_ID" | jq '.tasks | length')" "1"

expect "task search" \
  "$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/tasks?q=smoke" | jq '.tasks | length')" "1"

expect "task updated" \
  "$(curl -fsS -b "$COOKIE_JAR" -H "$JSON" -X PATCH -d '{"status":"done"}' \
      "$BASE_URL/api/tasks/$TASK_ID" | jq -r '.task.status')" "done"

OVERDUE_DATE="$(date -u -d 'yesterday' +%F)"
REMINDER_ID="$(curl -fsS -b "$COOKIE_JAR" -H "$JSON" \
  -d "{\"teamId\":$TEAM_ID,\"title\":\"Overdue smoke task\",\"assignedTo\":$USER_ID,\"dueDate\":\"$OVERDUE_DATE\"}" \
  "$BASE_URL/api/tasks" | jq -r '.task.id')"
expect "overdue task created for reminders" "$([ -n "$REMINDER_ID" ] && echo yes)" "yes"

expect "reminder surfaces the overdue task" \
  "$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/tasks/reminders" | jq -r '.overdue[0].title')" \
  "Overdue smoke task"

expect "unprefixed /tasks/reminders alias works" \
  "$(curl -fsS -b "$COOKIE_JAR" "$BASE_URL/tasks/reminders" | jq '.count')" "1"

expect "cross-origin write blocked" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" -H "$JSON" -H 'Origin: https://evil.example' \
      -d '{"name":"CSRF Team"}' "$BASE_URL/api/teams")" "403"

expect "task deleted" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" -X DELETE "$BASE_URL/api/tasks/$TASK_ID")" "204"

expect "reminder task deleted" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" -X DELETE "$BASE_URL/api/tasks/$REMINDER_ID")" "204"

expect "deleted task is gone" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" "$BASE_URL/api/tasks/$TASK_ID")" "404"

expect "logout" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
      -X POST "$BASE_URL/api/auth/logout")" "204"

expect "session destroyed after logout" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" "$BASE_URL/api/auth/me")" "401"

echo "All smoke checks passed."
