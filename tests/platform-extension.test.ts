import { describe, expect, it } from "vitest";

import {
  createPlatformExtensionRegistrySnapshot,
  createPlatformExtensionSurfaceCatalog,
  createPlatformExtensionSnapshot,
} from "@sage/shared";

describe("platform extension snapshot", () => {
  it("exposes the candidate surfaces as a read-only audit snapshot", () => {
    const snapshot = createPlatformExtensionSnapshot({
      checkedAt: "2026-06-28T10:00:00.000Z",
    });
    const registrySnapshot = createPlatformExtensionRegistrySnapshot({
      checkedAt: "2026-06-28T10:00:00.000Z",
    });

    expect(snapshot.checkedAt).toBe("2026-06-28T10:00:00.000Z");
    expect(registrySnapshot).toEqual(snapshot);
    expect(snapshot.entries.map((entry) => entry.id)).toEqual([
      "cron",
      "voice",
      "profiles",
      "remote-login",
      "gateway-messaging",
      "auto-update",
    ]);
    expect(snapshot.entries).toEqual(createPlatformExtensionSurfaceCatalog());
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
    expect(snapshot.entries.every((entry) => entry.boundary.length > 0)).toBe(
      true,
    );
  });
});
