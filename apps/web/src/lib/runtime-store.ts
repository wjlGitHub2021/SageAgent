import {
  createLocalTelemetryLogger,
  createMemoryRuntimeStore,
} from "@sage/runtime";

import type { RuntimeStore, TelemetryLogger } from "@sage/runtime";

const runtimeStoreKey = Symbol.for("sage.runtimeStore");
const telemetryLoggerKey = Symbol.for("sage.telemetryLogger");

type RuntimeGlobal = typeof globalThis & {
  [runtimeStoreKey]?: RuntimeStore;
  [telemetryLoggerKey]?: TelemetryLogger;
};

export function getRuntimeStore(): RuntimeStore {
  const runtimeGlobal = globalThis as RuntimeGlobal;
  runtimeGlobal[runtimeStoreKey] ??= createMemoryRuntimeStore();
  return runtimeGlobal[runtimeStoreKey];
}

export function getTelemetryLogger(): TelemetryLogger {
  const runtimeGlobal = globalThis as RuntimeGlobal;
  runtimeGlobal[telemetryLoggerKey] ??= createLocalTelemetryLogger();
  return runtimeGlobal[telemetryLoggerKey];
}
