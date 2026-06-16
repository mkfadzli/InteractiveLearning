"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, Clock, FileText, Sparkles } from "lucide-react";
import { ProgressBar } from "./TopBar";
import { getCourseStats, getLastSession } from "@/lib/progress";
import type { UploadedCourseSummary } from "@/lib/library";

/**
 * Client-side overlay on the server-rendered course list: reads per-course
 * progress from localStorage and shows a "Continue where you left off"
 * banner if there's a last-session record. Server still owns the list
 * itself; this hydrates the dynamic bits without round-tripping.
 */
export default function CourseLibraryGrid({ courses }: { courses: UploadedCourseSummary[] }) {
  const [stats, setStats] = useState<Record<string, ReturnType<typeof getCourseStats>>>({});
  const [last, setLast] = useState<{ courseId: string; lessonNumber: number } | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next: Record<string, ReturnType<typeof getCourseStats>> = {};
    for (const c of courses) next[c.id] = getCourseStats(c.id, c.lessons);
    setStats(next);
    setLast(getLastSession());
    setHydrated(true);
  }, [courses]);

  const resumable =
    hydrated && last && courses.find((c) => c.id === last.courseId) ? last : null;

  if (courses.length === 0) {
    return (
      <div className="rounded-lg2 border border-dashed border-border bg-surface px-6 py-12 text-center">
        <FileText size={36} className="mx-auto mb-3 text-text-2 opacity-50" />
        <h3 className="font-display text-[16.5px] font-semibold">Your library is empty</h3>
        <p className="mx-auto mt-1 max-w-[42ch] text-[13.5px] text-text-2">
          Upload a PDF to turn it into an interactive course. Your uploads stay on this device.
        </p>
        <Link
          href="/upload"
          className="mt-5 inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm2 bg-primary px-5 py-2.5 text-[14.5px] font-semibold text-on-primary shadow-[0_4px_14px_rgba(15,177,168,.3)] transition-all duration-200 ease-brand hover:brightness-110 active:scale-[.97]"
        >
          Upload your first PDF
        </Link>
      </div>
    );
  }

  return (
    <>
      {resumable && (
        <section
          aria-label="Continue learning"
          className="relative mb-6 grid items-center gap-4 overflow-hidden rounded-lg2 bg-gradient-to-r from-[#0B2545] via-[#123B6B] to-[#0F5E66] p-6 text-white sm:grid-cols-[1fr_auto]"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(15,177,168,.45),transparent_70%)]" />
          <div className="relative">
            <span className="text-[11.5px] font-bold uppercase tracking-[.14em] text-[#8FD8D2]">
              Pick up where you left off
            </span>
            <h2 className="mb-1 mt-1.5 text-[20px] font-semibold">
              {courses.find((c) => c.id === resumable.courseId)?.title}
            </h2>
            <p className="text-[13.5px] text-[#B9C8DC]">
              Lesson {resumable.lessonNumber} ·{" "}
              {stats[resumable.courseId]?.percent ?? 0}% complete
            </p>
            <Link
              href={`/course/${resumable.courseId}/lesson/${resumable.lessonNumber}`}
              className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm2 bg-coral px-5 py-2.5 text-[14.5px] font-bold text-[#3A0E0A] transition-all duration-200 ease-brand hover:brightness-105 active:scale-[.97]"
            >
              Resume lesson
            </Link>
          </div>
        </section>
      )}

      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-[17px] font-bold">Your library</h3>
        <Link
          href="/upload"
          className="text-[13.5px] font-semibold text-primary hover:underline"
        >
          + Upload another PDF
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((c) => {
          const s = stats[c.id];
          const resumeAt = s?.lastOpened && s.lastOpened > 0 ? s.lastOpened : 1;
          return (
            <Link
              key={c.id}
              href={`/course/${c.id}/lesson/${resumeAt}`}
              className="block cursor-pointer rounded-lg2 border border-border bg-surface p-[18px] transition-all duration-200 ease-brand hover:-translate-y-[3px] hover:shadow-lift active:scale-[.98]"
            >
              <div className="relative mb-3.5 flex h-24 items-end justify-end overflow-hidden rounded-md2 bg-gradient-to-br from-[#0FB1A8] to-[#0B5E66] p-2.5">
                <BookOpen size={48} strokeWidth={1.6} className="text-white/85" />
                {c.hasStories && (
                  <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                    <Sparkles size={11} fill="currentColor" /> Interactive
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-[.1em] text-text-2">
                {c.pages ? `From PDF · ${c.pages} pages` : "From PDF"}
              </span>
              <h4 className="my-1.5 line-clamp-2 font-display text-[15.5px] font-semibold leading-snug">
                {c.title}
              </h4>
              <div className="my-2.5">
                <ProgressBar value={hydrated ? s?.percent ?? 0 : 0} />
              </div>
              <div className="flex justify-between text-[12.5px] font-medium text-text-2">
                <span>
                  {hydrated
                    ? `${s?.percent ?? 0}% · ${s?.completed ?? 0}/${c.lessons} lessons`
                    : `${c.lessons} lessons`}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} /> {c.modules} modules
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
