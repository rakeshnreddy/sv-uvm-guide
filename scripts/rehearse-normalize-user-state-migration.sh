#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable PostgreSQL database}"

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f prisma/migrations/20250717061629_init/migration.sql
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f prisma/migrations/20250717192019_init/migration.sql
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO "Lab" ("id", "title", "description", "initialFiles", "testCases")
VALUES (
  'legacy-lab',
  'Legacy lab',
  'Migration rehearsal fixture',
  '{"top.sv":"module top; endmodule"}'::jsonb,
  '[{"name":"smoke","expected":"PASS"}]'::jsonb
);
INSERT INTO "Quiz" ("id", "title", "description", "questions")
VALUES (
  'legacy-quiz',
  'Legacy quiz',
  'Migration rehearsal fixture',
  '[{"id":"q1","answer":"logic"}]'::jsonb
);
SQL

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f prisma/migrations/20260718160000_normalize_user_state/migration.sql

preserved="$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -tA <<'SQL'
SELECT
  (SELECT "legacyContent" = jsonb_build_object(
    'initialFiles', '{"top.sv":"module top; endmodule"}'::jsonb,
    'testCases', '[{"name":"smoke","expected":"PASS"}]'::jsonb
  ) FROM "Lab" WHERE "id" = 'legacy-lab')
  AND
  (SELECT "legacyContent" = jsonb_build_object(
    'questions', '[{"id":"q1","answer":"logic"}]'::jsonb
  ) FROM "Quiz" WHERE "id" = 'legacy-quiz');
SQL
)"

if [[ "${preserved}" != "t" ]]; then
  echo "Legacy lab or quiz content was not preserved by the migration." >&2
  exit 1
fi

echo "Migration rehearsal preserved legacy Lab and Quiz JSON."
