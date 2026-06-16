import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import CourseRoadmap from "@/components/CourseRoadmap";
import { getCourse } from "@/lib/course";

export function generateMetadata({ params }: { params: { id: string } }) {
  const c = getCourse(params.id);
  return { title: `${c?.source.title ?? "Course"} — InteractiveLearning` };
}

export default function CoursePage({ params }: { params: { id: string } }) {
  const course = getCourse(params.id);
  if (!course) notFound();

  // Flatten for the roadmap component (it overlays per-lesson progress client-side).
  const flatLessons: { n: number; title: string; moduleTitle: string; hasStory: boolean; estMinutes?: number; quizCount: number }[] = [];
  let counter = 0;
  for (const m of course.modules) {
    for (const l of m.lessons) {
      counter += 1;
      flatLessons.push({
        n: counter,
        title: l.story?.title ?? l.title,
        moduleTitle: m.title,
        hasStory: !!l.story,
        estMinutes: l.story?.est_minutes ?? l.est_minutes,
        quizCount: l.story?.quiz.questions.length ?? 0,
      });
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[1180px] bg-surface md:my-6 md:rounded-3xl md:border md:border-border md:shadow-lift">
      <header className="glass sticky top-0 z-30 flex items-center gap-3.5 border-b px-5 py-3">
        <Link
          href="/library"
          aria-label="Back to library"
          className="grid h-10 w-10 flex-none place-items-center rounded-xl text-text-2 transition-colors hover:bg-surface-2"
        >
          <ChevronLeft size={19} />
        </Link>
        <b className="font-display text-[15px]">Course roadmap</b>
        <span className="ml-auto" />
        <ThemeToggle />
      </header>

      <div className="mx-auto max-w-[820px] px-7 pb-12 pt-7">
        <h1 className="text-[24px] font-bold tracking-tight">
          {course.source.title ?? course.source.file}
        </h1>
        <p className="mt-0.5 text-[14px] text-text-2">
          Generated from <b className="text-text">{course.source.file}</b> ·{" "}
          {course.modules.length} module{course.modules.length === 1 ? "" : "s"} ·{" "}
          {flatLessons.length} lessons · structure: {course.source.structure_from}
        </p>

        <CourseRoadmap
          courseId={params.id}
          modules={course.modules.map((m) => ({
            title: m.title,
            order: m.order,
            lessonStart: flatLessons.findIndex((l) => l.moduleTitle === m.title) + 1,
            lessons: m.lessons.length,
          }))}
          flatLessons={flatLessons}
        />
      </div>
    </div>
  );
}
