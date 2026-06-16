import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronLeft, Star } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import LessonPlayer from "@/components/LessonPlayer";
import { ensureStory, getLesson } from "@/lib/course";

export function generateMetadata({ params }: { params: { id: string; n: string } }) {
  const hit = getLesson(params.id, Number(params.n));
  return { title: `${hit?.lesson.title ?? "Lesson"} — InteractiveLearning` };
}

export default function LessonPage({
  params,
}: {
  params: { id: string; n: string };
}) {
  const n = Number(params.n);
  const hit = getLesson(params.id, n);
  if (!hit) notFound();
  const { course, module: mod, lesson, flat } = hit;
  const { story, synthesized } = ensureStory(lesson);
  // Replace lesson.story so LessonPlayer can be pure on this prop.
  const lessonForPlayer = { ...lesson, story };

  return (
    <div className="mx-auto min-h-dvh max-w-[1180px] bg-surface md:my-6 md:rounded-3xl md:border md:border-border md:shadow-lift">
      <header className="glass sticky top-0 z-30 flex items-center gap-3.5 border-b px-5 py-3">
        <Link
          href={`/course/${params.id}`}
          aria-label="Back to course"
          className="grid h-10 w-10 flex-none place-items-center rounded-xl text-text-2 transition-colors hover:bg-surface-2"
        >
          <ChevronLeft size={19} />
        </Link>
        <div className="min-w-0 flex-1">
          <b className="block truncate font-display text-[15px]">
            {course.source.title ?? course.source.file}
          </b>
          <span className="text-[12.5px] text-text-2">
            {mod.title} · Lesson {n} of {flat.length} · “{story.title}”
          </span>
        </div>
        {!synthesized && (
          <span className="hidden items-center gap-1.5 rounded-full bg-teal-soft px-3.5 py-1.5 text-[13px] font-semibold text-primary sm:inline-flex">
            <Star size={14} fill="currentColor" /> +20 XP on finish
          </span>
        )}
        <ThemeToggle />
      </header>

      {synthesized && (
        <div className="mx-6 mt-4 flex items-start gap-3 rounded-md2 border border-border bg-coral-soft px-4 py-3 text-[13.5px] md:mx-10">
          <AlertTriangle size={18} className="mt-0.5 flex-none text-coral-deep" />
          <div>
            <b className="font-display">Structure preview — not yet generated</b>
            <p className="text-text-2">
              The PDF was extracted successfully, but no interactive story or quiz
              has been generated for this lesson yet. What you see below is the
              raw extracted content. Run stage 2 (lessonwriter.py with{" "}
              <code>ANTHROPIC_API_KEY</code>) to turn it into a real lesson.
            </p>
          </div>
        </div>
      )}

      <LessonPlayer
        courseId={params.id}
        lessonNumber={n}
        lesson={lessonForPlayer}
        flat={flat}
        moduleTitle={mod.title}
      />
    </div>
  );
}
