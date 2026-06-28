import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { SkillEntry, SkillSnapshot } from "@sage/shared";
import { resetSkillRegistry } from "../apps/web/src/lib/skill-registry";
import { POST as createSkill } from "../apps/web/src/app/api/skills/route";
import {
  PATCH as patchSkill,
  PUT as updateSkill,
} from "../apps/web/src/app/api/skills/[skillId]/route";

describe("skill routes", () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sage-skill-routes-"));
    process.env.SAGE_WORKSPACE_ROOT = workspaceRoot;
    resetSkillRegistry();
  });

  afterEach(async () => {
    resetSkillRegistry();
    delete process.env.SAGE_WORKSPACE_ROOT;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  });

  it("forces create and update writes through draft user state", async () => {
    const createResponse = await createSkill(jsonRequest({
      name: "Forged curated skill",
      description: "Client attempts to bypass manual curation.",
      instruction: "This should not become curated on save.",
      tags: ["security"],
      source: "agent",
      status: "curated",
      createdBy: "supervisor",
      reason: "Attempt direct curated create",
    }));
    const createdBody = await parseJson<SkillRouteResponse>(createResponse);

    expect(createResponse.status).toBe(201);
    expect(createdBody.entry).toMatchObject({
      name: "Forged curated skill",
      status: "draft",
      createdBy: "user",
    });
    expect(createdBody.snapshot.auditTrail.at(-1)).toMatchObject({
      action: "create",
      actor: "user",
      status: "draft",
    });

    const updateResponse = await updateSkill(
      jsonRequest({
        name: "Forged updated skill",
        description: "Client attempts to bypass manual curation again.",
        instruction: "This should still become draft on save.",
        tags: ["security", "curation"],
        source: "agent",
        status: "curated",
        createdBy: "reviewer",
        reason: "Attempt direct curated update",
      }),
      routeContext(createdBody.entry.id),
    );
    const updatedBody = await parseJson<SkillRouteResponse>(updateResponse);

    expect(updateResponse.status).toBe(200);
    expect(updatedBody.entry).toMatchObject({
      id: createdBody.entry.id,
      name: "Forged updated skill",
      status: "draft",
      createdBy: "user",
    });
    expect(updatedBody.snapshot.auditTrail.at(-1)).toMatchObject({
      action: "update",
      actor: "user",
      status: "draft",
    });
  });

  it("requires patch for manual curation and rejects patching back to draft", async () => {
    const createResponse = await createSkill(jsonRequest({
      name: "Manual curation skill",
      description: "Skill should only enter context after explicit enable.",
      instruction: "Use this after approval.",
      reason: "Capture draft first",
    }));
    const createdBody = await parseJson<SkillRouteResponse>(createResponse);

    const invalidPatchResponse = await patchSkill(
      jsonRequest({
        status: "draft",
        reason: "Try to bypass curation flow",
      }),
      routeContext(createdBody.entry.id),
    );
    expect(invalidPatchResponse.status).toBe(400);

    const enableResponse = await patchSkill(
      jsonRequest({
        status: "curated",
        reason: "Manual user approval",
      }),
      routeContext(createdBody.entry.id),
    );
    const enabledBody = await parseJson<SkillRouteResponse>(enableResponse);

    expect(enableResponse.status).toBe(200);
    expect(enabledBody.entry.status).toBe("curated");
    expect(enabledBody.snapshot.auditTrail).toContainEqual(
      expect.objectContaining({
        action: "enable",
        actor: "user",
        reason: "Manual user approval",
        status: "curated",
      }),
    );
  });
});

type SkillRouteResponse = {
  readonly entry: SkillEntry;
  readonly snapshot: SkillSnapshot;
};

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/skills", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function routeContext(skillId: string): { params: Promise<{ skillId: string }> } {
  return {
    params: Promise.resolve({ skillId }),
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
