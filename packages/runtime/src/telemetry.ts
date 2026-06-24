import type { EntityId, ISODateTimeString, JsonObject, JsonValue } from "@sage/shared";

export const TELEMETRY_REDACTED_VALUE = "[redacted]";

export type TelemetryLevel = "info" | "warn" | "error";
export type TelemetrySource =
  | "runtime"
  | "api"
  | "provider"
  | "agent"
  | "tool"
  | "approval";

export interface TelemetryEvent {
  readonly id: EntityId;
  readonly sequence: number;
  readonly name: string;
  readonly level: TelemetryLevel;
  readonly source: TelemetrySource;
  readonly message: string;
  readonly runId: EntityId | null;
  readonly threadId: EntityId | null;
  readonly metadata: JsonObject;
  readonly createdAt: ISODateTimeString;
}

export interface RecordTelemetryEventInput {
  readonly id?: EntityId;
  readonly name: string;
  readonly level?: TelemetryLevel;
  readonly source: TelemetrySource;
  readonly message: string;
  readonly runId?: EntityId | null;
  readonly threadId?: EntityId | null;
  readonly metadata?: JsonObject;
  readonly createdAt?: ISODateTimeString;
}

export interface TelemetryEventFilter {
  readonly level?: TelemetryLevel;
  readonly source?: TelemetrySource;
  readonly runId?: EntityId;
  readonly threadId?: EntityId;
}

export interface TelemetryLoggerOptions {
  readonly maxEvents?: number;
}

export interface TelemetryLogger {
  record(input: RecordTelemetryEventInput): TelemetryEvent;
  getEvents(filter?: TelemetryEventFilter): readonly TelemetryEvent[];
  clear(): void;
}

let telemetryEventIdCounter = 0;

export function createLocalTelemetryLogger(
  options: TelemetryLoggerOptions = {},
): TelemetryLogger {
  return new LocalTelemetryLogger(options.maxEvents ?? 500);
}

class LocalTelemetryLogger implements TelemetryLogger {
  private readonly maxEvents: number;
  private readonly events: TelemetryEvent[] = [];
  private sequence = 0;

  constructor(maxEvents: number) {
    this.maxEvents = Math.max(1, Math.floor(maxEvents));
  }

  record(input: RecordTelemetryEventInput): TelemetryEvent {
    const name = input.name.trim();
    const message = input.message.trim();
    if (name.length === 0) {
      throw new Error("Telemetry event name is required.");
    }
    if (message.length === 0) {
      throw new Error("Telemetry event message is required.");
    }

    this.sequence += 1;
    const event: TelemetryEvent = {
      id: input.id?.trim() || createTelemetryEventId(),
      sequence: this.sequence,
      name,
      level: input.level ?? "info",
      source: input.source,
      message,
      runId: normalizeOptionalId(input.runId),
      threadId: normalizeOptionalId(input.threadId),
      metadata: sanitizeTelemetryMetadata(input.metadata ?? {}),
      createdAt: input.createdAt?.trim() || new Date().toISOString(),
    };

    this.events.push(cloneTelemetryEvent(event));
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }

    return cloneTelemetryEvent(event);
  }

  getEvents(filter: TelemetryEventFilter = {}): readonly TelemetryEvent[] {
    return this.events
      .filter((event) => {
        if (filter.level && event.level !== filter.level) return false;
        if (filter.source && event.source !== filter.source) return false;
        if (filter.runId && event.runId !== filter.runId) return false;
        if (filter.threadId && event.threadId !== filter.threadId) return false;
        return true;
      })
      .map(cloneTelemetryEvent);
  }

  clear(): void {
    this.events.splice(0, this.events.length);
    this.sequence = 0;
  }
}

export function sanitizeTelemetryMetadata(metadata: JsonObject): JsonObject {
  return sanitizeTelemetryValue(metadata) as JsonObject;
}

function sanitizeTelemetryValue(value: JsonValue, key = ""): JsonValue {
  if (isSensitiveTelemetryKey(key)) {
    return TELEMETRY_REDACTED_VALUE;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeTelemetryValue(item));
  }

  if (isJsonObject(value)) {
    const sanitized: Record<string, JsonValue> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      sanitized[entryKey] = sanitizeTelemetryValue(entryValue, entryKey);
    }
    return sanitized;
  }

  return value;
}

function cloneTelemetryEvent(event: TelemetryEvent): TelemetryEvent {
  return {
    ...event,
    metadata: cloneJsonObject(event.metadata),
  };
}

function cloneJsonObject(value: JsonObject): JsonObject {
  return cloneJsonValue(value) as JsonObject;
}

function cloneJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(cloneJsonValue);
  }
  if (isJsonObject(value)) {
    const cloned: Record<string, JsonValue> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      cloned[key] = cloneJsonValue(entryValue);
    }
    return cloned;
  }
  return value;
}

function normalizeOptionalId(value: EntityId | null | undefined): EntityId | null {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function createTelemetryEventId(): EntityId {
  telemetryEventIdCounter += 1;
  return `telemetry-${telemetryEventIdCounter}`;
}

function isSensitiveTelemetryKey(key: string): boolean {
  return /(api[-_]?key|authorization|credential|password|secret|token)/i.test(
    key,
  );
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
