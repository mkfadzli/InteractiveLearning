/**
 * Disk-backed job store. Each job lives in JOBS_ROOT/<jobId>/ and contains:
 *   source.pdf   — uploaded file
 *   course.json  — pipeline output (written by scripts/pipeline.py)
 *
 * In production this would be S3/Postgres. For the prototype, /tmp is fine —
 * uploads survive across server restarts during a dev session.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export const JOBS_ROOT =
  process.env.IL_JOBS_DIR ?? path.join(os.tmpdir(), "interactive-learning-jobs");

export function newJobId(): string {
  // Time-ordered, URL-safe, no PII. 12 chars of base32.
  return (
    Date.now().toString(36) +
    "-" +
    crypto.randomBytes(4).toString("hex")
  );
}

export function jobDir(id: string): string {
  // Defensive: reject path traversal even though we control id generation.
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error("invalid job id");
  return path.join(JOBS_ROOT, id);
}

export function jobPdf(id: string): string {
  return path.join(jobDir(id), "source.pdf");
}

export function jobCoursePath(id: string): string {
  return path.join(jobDir(id), "course.json");
}

export function jobExists(id: string): boolean {
  try {
    return fs.existsSync(jobCoursePath(id));
  } catch {
    return false;
  }
}
