import * as fs from "node:fs/promises";
import * as path from "node:path";

export const DEFAULT_READ_PROJECT_FILE_MAX_BYTES = 64 * 1024;

const BLOCKED_PATH_SEGMENTS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  "tmp",
  "playwright-report",
  "test-results",
]);

export type ReadProjectFileIssueCode =
  | "invalid_workspace_root"
  | "invalid_path"
  | "absolute_path_not_allowed"
  | "path_outside_workspace"
  | "blocked_path"
  | "not_found"
  | "not_file"
  | "file_too_large"
  | "binary_file"
  | "read_failed";

export interface ReadProjectFileToolInput {
  readonly workspaceRoot: string;
  readonly relativePath: string;
  readonly maxBytes?: number;
}

export interface ReadProjectFileSuccess {
  readonly ok: true;
  readonly relativePath: string;
  readonly bytes: number;
  readonly content: string;
}

export interface ReadProjectFileFailure {
  readonly ok: false;
  readonly issue: {
    readonly code: ReadProjectFileIssueCode;
    readonly message: string;
    readonly relativePath: string | null;
  };
}

export type ReadProjectFileResult =
  | ReadProjectFileSuccess
  | ReadProjectFileFailure;

export async function readProjectFileTool({
  workspaceRoot,
  relativePath,
  maxBytes = DEFAULT_READ_PROJECT_FILE_MAX_BYTES,
}: ReadProjectFileToolInput): Promise<ReadProjectFileResult> {
  const normalized = normalizeProjectRelativePath(relativePath);
  if (!normalized.ok) return normalized;

  if (isBlockedProjectPath(normalized.relativePath)) {
    return failure(
      "blocked_path",
      "Path is blocked by the Sage read-only file policy.",
      normalized.relativePath,
    );
  }

  const workspaceRealPath = await realpathSafe(workspaceRoot);
  if (workspaceRealPath === null) {
    return failure(
      "invalid_workspace_root",
      "Workspace root is not available.",
      normalized.relativePath,
    );
  }

  const candidatePath = path.resolve(workspaceRealPath, normalized.relativePath);
  if (!isPathInside(candidatePath, workspaceRealPath)) {
    return failure(
      "path_outside_workspace",
      "Path must stay inside the Sage workspace.",
      normalized.relativePath,
    );
  }

  const realFilePath = await realpathSafe(candidatePath);
  if (realFilePath === null) {
    return failure("not_found", "File was not found.", normalized.relativePath);
  }

  if (!isPathInside(realFilePath, workspaceRealPath)) {
    return failure(
      "path_outside_workspace",
      "Path must stay inside the Sage workspace.",
      normalized.relativePath,
    );
  }

  const realRelativePath = path
    .relative(workspaceRealPath, realFilePath)
    .replaceAll(path.sep, "/");
  if (isBlockedProjectPath(realRelativePath)) {
    return failure(
      "blocked_path",
      "Path is blocked by the Sage read-only file policy.",
      normalized.relativePath,
    );
  }

  const stat = await statSafe(realFilePath);
  if (stat === null) {
    return failure("read_failed", "File metadata could not be read.", normalized.relativePath);
  }

  if (!stat.isFile()) {
    return failure("not_file", "Path is not a regular file.", normalized.relativePath);
  }

  const effectiveMaxBytes = normalizeMaxBytes(maxBytes);
  if (stat.size > effectiveMaxBytes) {
    return failure(
      "file_too_large",
      `File exceeds the ${effectiveMaxBytes} byte read limit.`,
      normalized.relativePath,
    );
  }

  const contentBuffer = await readFileSafe(realFilePath);
  if (contentBuffer === null) {
    return failure("read_failed", "File could not be read.", normalized.relativePath);
  }

  if (contentBuffer.byteLength > effectiveMaxBytes) {
    return failure(
      "file_too_large",
      `File exceeds the ${effectiveMaxBytes} byte read limit.`,
      normalized.relativePath,
    );
  }

  if (isProbablyBinary(contentBuffer)) {
    return failure(
      "binary_file",
      "Binary files are not available through the read-only text tool.",
      normalized.relativePath,
    );
  }

  return {
    ok: true,
    relativePath: normalized.relativePath,
    bytes: contentBuffer.byteLength,
    content: contentBuffer.toString("utf8"),
  };
}

function normalizeProjectRelativePath(
  value: string,
): { readonly ok: true; readonly relativePath: string } | ReadProjectFileFailure {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.includes("\0")) {
    return failure("invalid_path", "Path must be a non-empty project-relative path.", null);
  }

  if (path.isAbsolute(trimmed)) {
    return failure(
      "absolute_path_not_allowed",
      "Use a project-relative path instead of an absolute path.",
      trimmed,
    );
  }

  const normalized = path.posix.normalize(trimmed.replaceAll("\\", "/"));
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/")
  ) {
    return failure(
      "path_outside_workspace",
      "Path must stay inside the Sage workspace.",
      normalized,
    );
  }

  return {
    ok: true,
    relativePath: normalized,
  };
}

function isBlockedProjectPath(relativePath: string): boolean {
  return relativePath.split("/").some((segment) => {
    const normalizedSegment = segment.toLowerCase();
    if (
      normalizedSegment === ".env" ||
      normalizedSegment.startsWith(".env.")
    ) {
      return true;
    }
    return BLOCKED_PATH_SEGMENTS.has(normalizedSegment);
  });
}

function isPathInside(candidatePath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

async function realpathSafe(value: string): Promise<string | null> {
  try {
    return await fs.realpath(value);
  } catch {
    return null;
  }
}

async function statSafe(value: string): Promise<Awaited<ReturnType<typeof fs.stat>> | null> {
  try {
    return await fs.stat(value);
  } catch {
    return null;
  }
}

async function readFileSafe(value: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(value);
  } catch {
    return null;
  }
}

function normalizeMaxBytes(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_READ_PROJECT_FILE_MAX_BYTES;
  }

  return Math.min(Math.floor(value), DEFAULT_READ_PROJECT_FILE_MAX_BYTES);
}

function isProbablyBinary(content: Buffer): boolean {
  if (content.includes(0)) return true;
  if (content.byteLength === 0) return false;

  const sample = content.subarray(0, Math.min(content.byteLength, 4096));
  let suspiciousControlBytes = 0;
  for (const byte of sample) {
    const isAllowedWhitespace = byte === 9 || byte === 10 || byte === 13;
    if (byte < 32 && !isAllowedWhitespace) suspiciousControlBytes += 1;
  }

  return suspiciousControlBytes / sample.byteLength > 0.08;
}

function failure(
  code: ReadProjectFileIssueCode,
  message: string,
  relativePath: string | null,
): ReadProjectFileFailure {
  return {
    ok: false,
    issue: {
      code,
      message,
      relativePath,
    },
  };
}
