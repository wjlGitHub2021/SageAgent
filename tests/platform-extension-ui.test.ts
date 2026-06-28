import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("platform extension settings UI", () => {
  it("registers the V2.5 extension panel in both locales and keeps unsupported features marked as read-only", async () => {
    const pageSource = await readFile(
      path.resolve("apps/web/src/app/page.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("platformExtensions");
    expect(pageSource).toContain("platformExtensionsDetail");
    expect(pageSource).toContain("extensionCandidateCron");
    expect(pageSource).toContain("extensionCandidateVoice");
    expect(pageSource).toContain("extensionCandidateGateway");
    expect(pageSource).toContain("extensionCandidateUpdate");
    expect(pageSource).toContain("extensionNotBuiltTitle");
    expect(pageSource).toContain("extensionNotBuiltDetail");
    expect(pageSource).toContain("extensionPlanned");
    expect(pageSource).toContain("extensionBlocked");
    expect(pageSource).toContain("extensionProposed");
    expect(pageSource).toContain("extensionAutomation");
    expect(pageSource).toContain("extensionInteraction");
    expect(pageSource).toContain("extensionIdentity");
    expect(pageSource).toContain("extensionMessaging");
    expect(pageSource).toContain("extensionMaintenance");
    expect(pageSource).toContain("cron、voice、gateway 和自动更新");
    expect(pageSource).toContain("Cron, voice, gateway, and auto-update");
  });
});
