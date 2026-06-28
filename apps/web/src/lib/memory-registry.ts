import {
  createPersistentMemoryRegistry,
  type MemoryRegistry,
} from "@sage/runtime";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const memoryRegistryKey = Symbol.for("sage.memoryRegistry");

type WebGlobal = typeof globalThis & {
  [memoryRegistryKey]?: MemoryRegistry;
};

export function getMemoryRegistry(): MemoryRegistry {
  const runtimeGlobal = globalThis as WebGlobal;
  runtimeGlobal[memoryRegistryKey] ??= createPersistentMemoryRegistry();
  return runtimeGlobal[memoryRegistryKey];
}

export function resetMemoryRegistry(): void {
  const runtimeGlobal = globalThis as WebGlobal;
  delete runtimeGlobal[memoryRegistryKey];

  const storagePath = path.resolve(
    process.env.SAGE_WORKSPACE_ROOT ?? process.cwd(),
    ".sage",
    "memory-registry.json",
  );
  if (existsSync(storagePath)) {
    rmSync(storagePath);
  }
}
