import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("normalized user-state migration", () => {
  it("archives legacy lab and quiz JSON before dropping source columns", () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), "prisma/migrations/20260718160000_normalize_user_state/migration.sql"),
      "utf8",
    );

    expect(migration.indexOf("jsonb_build_object(\n  'initialFiles'"))
      .toBeLessThan(migration.indexOf('DROP COLUMN "initialFiles"'));
    expect(migration.indexOf("jsonb_build_object('questions'"))
      .toBeLessThan(migration.indexOf('DROP COLUMN "questions"'));
    expect(migration).toContain('ADD COLUMN "legacyContent" JSONB');
  });
});
