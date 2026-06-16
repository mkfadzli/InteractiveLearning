/**
 * Typed contract for stage-2 output (lessonwriter.py / lesson-generator demo).
 * The lesson player renders exactly these block types — keep in sync with
 * the SYSTEM schema in lessonwriter.py.
 */
export type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "callout"; title?: string; text: string }
  | { type: "key_idea"; text: string }
  | { type: "code"; text: string; lang?: string; caption?: string }
  | { type: "figure_ref"; page?: number; caption?: string };

export type StoryPage = { blocks: Block[] };

export type QuizQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type Story = {
  title: string;
  est_minutes: number;
  pages: StoryPage[];
  quiz: { questions: QuizQuestion[] };
};

export type EnrichedLesson = {
  title: string;
  order: number;
  page_start: number;
  page_end: number;
  est_minutes?: number;
  story?: Story;
};

export type EnrichedModule = {
  title: string;
  order: number;
  lessons: EnrichedLesson[];
};

export type EnrichedCourse = {
  source: { file: string; title?: string; pages: number; structure_from: string };
  summary: { modules: number; lessons: number; words: number; est_hours: number };
  confidence: { score: number; flags: string[] };
  modules: EnrichedModule[];
};

/**
 * Course registry. In production this is a DB lookup; the prototype ships
 * one enriched course generated from the pipeline (see pdf2course.py +
 * lessonwriter.py). Any course.id used in /library mock data that is not
 * registered here falls back to the sample so navigation always works.
 */
/**
 * Course lookup. Personal-testing build: courses live only on disk under
 * the jobs directory. When we add multi-user later, this gets a DB lookup.
 */
function tryLoadFromDisk(id: string): EnrichedCourse | null {
  if (typeof window !== "undefined") return null; // server-only
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { jobCoursePath, jobExists } = require("@/lib/jobs") as typeof import("./jobs");
    if (!jobExists(id)) return null;
    return JSON.parse(fs.readFileSync(jobCoursePath(id), "utf8")) as EnrichedCourse;
  } catch {
    return null;
  }
}

export function getCourse(id: string): EnrichedCourse | null {
  return tryLoadFromDisk(id);
}

export function courseExists(id: string): boolean {
  if (typeof window !== "undefined") return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { jobExists } = require("@/lib/jobs") as typeof import("./jobs");
    return jobExists(id);
  } catch {
    return false;
  }
}

export function getLesson(
  courseId: string,
  n: number,
): { course: EnrichedCourse; module: EnrichedModule; lesson: EnrichedLesson; index: number; flat: EnrichedLesson[] } | null {
  const course = getCourse(courseId);
  if (!course) return null;
  const flat: { m: EnrichedModule; l: EnrichedLesson }[] = [];
  for (const m of course.modules) for (const l of m.lessons) flat.push({ m, l });
  const idx = n - 1;
  if (idx < 0 || idx >= flat.length) return null;
  return {
    course,
    module: flat[idx].m,
    lesson: flat[idx].l,
    index: idx,
    flat: flat.map((f) => f.l),
  };
}

/**
 * For uploaded courses where stage-2 enrichment hasn't run yet, synthesize
 * a single-page "story" from the raw extracted blocks so the lesson player
 * still renders something meaningful. No quiz — the UI shows a "Generate
 * with Claude" banner instead.
 */
export function ensureStory(lesson: EnrichedLesson & { raw_blocks?: Block[] }): {
  story: Story;
  synthesized: boolean;
} {
  if (lesson.story) return { story: lesson.story, synthesized: false };
  const blocks = (lesson.raw_blocks ?? []).filter(
    (b): b is Block => b.type !== "heading" || (b as { text: string }).text !== lesson.title,
  );
  const story: Story = {
    title: lesson.title,
    est_minutes: lesson.est_minutes ?? 3,
    pages: [
      {
        blocks: [
          { type: "heading", text: lesson.title },
          ...blocks.slice(0, 24), // keep page reasonable
        ],
      },
    ],
    quiz: { questions: [] }, // no quiz for unenriched lessons
  };
  return { story, synthesized: true };
}
