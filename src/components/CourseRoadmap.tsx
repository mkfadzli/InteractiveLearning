"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Circle, Play } from "lucide-react";
import { ProgressRing } from "./TopBar";
import { getCourseStats, getLessonProgress } from "@/lib/progress";

type ModuleDef = { title: string; order: number; lessonStart: number; lessons: number };
type LessonDef = { n: number; title: string; moduleTitle: string; hasStory: boolean; estMinutes?: number; quizCount: number };

export default function CourseRoadmap({
  courseId,
  modules,
  flatLessons,
}: {
  courseId: string;
  modules: ModuleDef[];
  flatLessons: LessonDef[];
}) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [overall, setOverall] = useState<ReturnType<typeof getCourseStats> | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const c = new Set<number>();
    for (const l of flatLessons) {
      if (getLessonProgress(courseId, l.n)?.completed) c.add(l.n);
    }
    setCompleted(c);
    setOverall(getCourseStats(courseId, flatLessons.length));
    setHydrated(true);
  }, [courseId, flatLessons]);

  const resumeAt = overall && overall.lastOpened > 0 ? overall.lastOpened : 1;

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <ProgressRing
          value={hydrated ? overall?.percent ?? 0 : 0}
          label={`Course progress ${overall?.percent ?? 0} percent`}
          trackClass="stroke-surface-2"
          textClass="text-text"
        />
        <Link
          href={`/course/${courseId}/lesson/${resumeAt}`}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm2 bg-coral px-5 py-2.5 text-[14.5px] font-bold text-[#3A0E0A] transition-all duration-200 ease-brand hover:brightness-105 active:scale-[.97]"
        >
          <Play size={15} fill="currentColor" />
          {overall && overall.completed > 0 ? "Continue course" : "Start course"}
        </Link>
      </div>

      <div className="mt-7 space-y-4">
        {modules.map((m) => {
          const lessonsInModule = flatLessons.filter((l) => l.moduleTitle === m.title);
          const moduleDone = lessonsInModule.filter((l) => completed.has(l.n)).length;
          return (
            <section key={m.order} className="rounded-lg2 border border-border bg-surface p-5">
              <header className="flex items-baseline justify-between gap-3">
                <h4 className="font-display text-[15.5px] font-semibold">
                  {m.order} · {m.title}
                </h4>
                <span className="text-[12px] font-semibold text-text-2 tabular-nums">
                  {hydrated ? `${moduleDone}/${m.lessons}` : `${m.lessons} lessons`}
                </span>
              </header>
              <div className="mt-3 grid gap-1 border-t border-border pt-3">
                {lessonsInModule.map((l) => {
                  const done = completed.has(l.n);
                  return (
                    <Link
                      key={l.n}
                      href={`/course/${courseId}/lesson/${l.n}`}
                      className={`flex min-h-[44px] items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[14px] transition-colors ${
                        done ? "text-text" : "text-text"
                      } hover:bg-teal-soft hover:text-primary`}
                    >
                      <span
                        className={`grid h-[20px] w-[20px] flex-none place-items-center rounded-full ${
                          done
                            ? "bg-teal text-white"
                            : "border-2 border-border bg-surface text-text-2"
                        }`}
                      >
                        {done ? (
                          <Check size={11} strokeWidth={3.4} />
                        ) : (
                          <Circle size={6} fill="currentColor" />
                        )}
                      </span>
                      <span className="truncate">{l.title}</span>
                      <span className="ml-auto flex-none text-[11.5px] text-text-2">
                        ~{l.estMinutes ?? 3} min
                        {l.quizCount > 0 ? ` · ${l.quizCount} quiz` : l.hasStory ? "" : " · preview"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
