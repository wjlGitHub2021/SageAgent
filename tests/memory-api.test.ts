import { describe, expect, it } from "vitest";
import {
  normalizeCreateMemoryRequest,
  parseCommaSeparatedList,
} from "../apps/web/src/lib/memory-api";

describe("memory api helpers", () => {
  it("normalizes create payloads for memory requests", () => {
    const result = normalizeCreateMemoryRequest({
      scope: "workspace",
      title: "Approval boundary",
      content: "File writes require approval.",
      tags: ["policy", "policy"],
      createdBy: "user",
      reason: "Capture boundary",
    });

    expect(result).toMatchObject({
      ok: true,
      scope: "workspace",
      title: "Approval boundary",
      content: "File writes require approval.",
      tags: ["policy"],
      createdBy: "user",
      reason: "Capture boundary",
    });
  });

  it("rejects invalid memory requests", () => {
    expect(normalizeCreateMemoryRequest({})).toMatchObject({
      ok: false,
      code: "invalid_string",
    });
  });

  it("parses comma separated tags safely", () => {
    expect(parseCommaSeparatedList("alpha, beta, alpha")).toEqual([
      "alpha",
      "beta",
    ]);
  });
});
