import { createMemoryRuntimeStore } from "@sage/runtime";

import type { RuntimeStore } from "@sage/runtime";

const runtimeStoreKey = Symbol.for("sage.runtimeStore");

type RuntimeGlobal = typeof globalThis & {
  [runtimeStoreKey]?: RuntimeStore;
};

export function getRuntimeStore(): RuntimeStore {
  const runtimeGlobal = globalThis as RuntimeGlobal;
  runtimeGlobal[runtimeStoreKey] ??= createMemoryRuntimeStore();
  return runtimeGlobal[runtimeStoreKey];
}
