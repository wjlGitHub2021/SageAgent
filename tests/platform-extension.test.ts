import { describe, expect, it } from "vitest";

import {
  createPlatformExtensionRegistrySnapshot,
  createPlatformExtensionSurfaceCatalog,
} from "@sage/shared";

describe("platform extension registry", () => {
  it("exposes a read-only candidate surface catalog with clear boundaries", () => {
    const catalog = createPlatformExtensionSurfaceCatalog();

    expect(catalog).toEqual([
      expect.objectContaining({
        id: "cron",
        status: "planned",
        category: "automation",
      }),
      expect.objectContaining({
        id: "voice",
        status: "planned",
        category: "interaction",
      }),
      expect.objectContaining({
        id: "profiles",
        status: "planned",
        category: "identity",
      }),
      expect.objectContaining({
        id: "remote-login",
        status: "blocked",
        category: "identity",
      }),
      expect.objectContaining({
        id: "gateway-messaging",
        status: "blocked",
        category: "messaging",
      }),
      expect.objectContaining({
        id: "auto-update",
        status: "proposed",
        category: "maintenance",
      }),
    ]);
  });

  it("creates an auditable platform extension snapshot", () => {
    const snapshot = createPlatformExtensionRegistrySnapshot({
      checkedAt: "2026-06-28T10:00:00.000Z",
      auditAction: "status_check",
    });

    expect(snapshot.checkedAt).toBe("2026-06-28T10:00:00.000Z");
    expect(snapshot.entries.map((entry) => entry.id)).toEqual([
      "cron",
      "voice",
      "profiles",
      "remote-login",
      "gateway-messaging",
      "auto-update",
    ]);
    expect(snapshot.auditTrail).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "register",
        }),
        expect.objectContaining({
          action: "status_check",
        }),
      ]),
    );
  });
});
