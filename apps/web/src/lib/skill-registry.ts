import {
  createPersistentSkillRegistry,
  type SkillRegistry,
} from "@sage/runtime";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const skillRegistryKey = Symbol.for("sage.skillRegistry");

type WebGlobal = typeof globalThis & {
  [skillRegistryKey]?: SkillRegistry;
};

export function getSkillRegistry(): SkillRegistry {
  const runtimeGlobal = globalThis as WebGlobal;
  runtimeGlobal[skillRegistryKey] ??= createPersistentSkillRegistry();
  return runtimeGlobal[skillRegistryKey];
}

export function resetSkillRegistry(): void {
  const runtimeGlobal = globalThis as WebGlobal;
  delete runtimeGlobal[skillRegistryKey];

  const storagePath = path.resolve(
    process.env.SAGE_WORKSPACE_ROOT ?? process.cwd(),
    ".sage",
    "skill-registry.json",
  );
  if (existsSync(storagePath)) {
    rmSync(storagePath);
  }
}
