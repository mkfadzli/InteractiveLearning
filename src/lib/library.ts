import fs from "node:fs";
import path from "node:path";
import { JOBS_ROOT } from "@/lib/jobs";
import type { EnrichedCourse } from "@/lib/course";

export type UploadedCourseSummary = {
  id: string;
  title: string;
  fileName: string;
  pages?: number;
  lessons: number;
  modules: number;
  uploadedAt: number;
  hasStories: boolean;
};

/**
 * List every uploaded course currently on disk. Server-only (uses node:fs).
 * Returns newest first. Bad/half-written jobs are silently skipped.
 */
export function listUploadedCourses(): UploadedCourseSummary[] {
  if (!fs.existsSync(JOBS_ROOT)) return [];
  const out: UploadedCourseSummary[] = [];
  for (const id of fs.readdirSync(JOBS_ROOT)) {
    const dir = path.join(JOBS_ROOT, id);
    const coursePath = path.join(dir, "course.json");
    const metaPath = path.join(dir, "meta.json");
    if (!fs.existsSync(coursePath)) continue; // upload still in progress
    try {
      const course = JSON.parse(fs.readFileSync(coursePath, "utf8")) as EnrichedCourse;
      const meta = fs.existsSync(metaPath)
        ? (JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
            originalName?: string;
            uploadedAt?: number;
          })
        : {};
      const lessons = course.modules.reduce((n, m) => n + m.lessons.length, 0);
      const hasStories = course.modules.some((m) => m.lessons.some((l) => l.story));
      out.push({
        id,
        title: course.source.title ?? meta.originalName ?? course.source.file,
        fileName: meta.originalName ?? course.source.file,
        pages: course.source.pages,
        lessons,
        modules: course.modules.length,
        uploadedAt: meta.uploadedAt ?? fs.statSync(coursePath).mtimeMs,
        hasStories,
      });
    } catch {
      // skip corrupted job
    }
  }
  return out.sort((a, b) => b.uploadedAt - a.uploadedAt);
}
