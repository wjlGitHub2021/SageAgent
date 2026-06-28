import { describe, expect, it } from "vitest";
import {
  normalizeCreateSkillRequest,
  parseCommaSeparatedList,
} from "../apps/web/src/lib/skill-api";

describe("skill api helpers", () => {
  it("normalizes create payloads for skill requests", () => {
    const result = normalizeCreateSkillRequest({
      name: "QA checklist",
      description: "Reusable browser QA process.",
      instruction: "Run checks, inspect UI, then commit.",
      tags: ["qa", "qa"],
      source: "user",
      status: "curated",
      createdBy: "user",
      reason: "Capture useful workflow",
    });

    expect(result).toMatchObject({
      ok: true,
      name: "QA checklist",
      description: "Reusable browser QA process.",
      instruction: "Run checks, inspect UI, then commit.",
      tags: ["qa"],
      source: "user",
      status: "curated",
      createdBy: "user",
      reason: "Capture useful workflow",
    });
  });

  it("rejects invalid skill requests", () => {
    expect(normalizeCreateSkillRequest({})).toMatchObject({
      ok: false,
      code: "invalid_string",
    });

    expect(
      normalizeCreateSkillRequest({
        name: "Bad skill",
        description: "Bad source.",
        instruction: "Use bad source.",
        source: "remote",
        status: "draft",
        reason: "Bad source",
      }),
    ).toMatchObject({
      ok: false,
      code: "invalid_source",
    });
  });

  it("parses comma separated skill tags safely", () => {
    expect(parseCommaSeparatedList("qa, browser, qa")).toEqual([
      "qa",
      "browser",
    ]);
  });
});
