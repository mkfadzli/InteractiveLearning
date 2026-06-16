"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { getLessonProgress } from "@/lib/progress";
import type { EnrichedLesson } from "@/lib/course";

/**
 * Lessons-in-module sidebar with localStorage-backed completion state.
 * Render-safe on the server (renders unmarked); hydrates on the client.
 */
export default function LessonTOC({
  courseId,
  lessonNumber,
  flat,
  moduleTitle,
}: {
  courseId: string;
  lessonNumber: number;
  flat: EnrichedLesson[];
  moduleTitle: string;
}) {
  const [completed, setCompleted] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const next: Record<number, boolean> = {};
    for (let i = 1; i <= flat.length; i++) {
      next[i] = !!getLessonProgress(courseId, i)?.completed;
    }
    setCompleted(next);
  }, [courseId, flat.length]);

  return (
    <nav
      aria-label="Lessons in this module"
      className="hidden border-r border-border px-4 py-5 lg:block"
    >
      <h4 className="px-2.5 pb-2.5 text-[11.5px] font-bold uppercase tracking-[.12em] text-text-2">
        {moduleTitle}
      </h4>
      <div className="max-h-[70vh] overflow-y-auto">
        {flat.map((l, i) => {
          const n = i + 1;
          const active = n === lessonNumber;
          const done = completed[n];
          return (
            <Link
              key={n}
              href={`/course/${courseId}/lesson/${n}`}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[40px] items-center gap-2.5 rounded-sm2 px-3 py-2 text-[13.5px] transition-colors duration-200 ${
                active
                  ? "bg-teal-soft font-semibold text-primary"
                  : done
                    ? "text-text hover:bg-surface-2"
                    : "text-text-2 hover:bg-surface-2"
              }`}
            >
              <span
                className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-full border-2 text-[11px] ${
                  done
                    ? "border-teal bg-teal text-white"
                    : active
                      ? "border-primary text-primary"
                      : "border-border"
                }`}
              >
                {done ? <Check size={11} strokeWidth={3.4} /> : n}
              </span>
              <span className="truncate">{l.story?.title ?? l.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
