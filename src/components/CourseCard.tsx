import Link from "next/link";
import { Activity, BarChart3, Radio } from "lucide-react";
import { ProgressBar } from "./TopBar";
import type { Course } from "@/data/mock";

const artMap = {
  teal: {
    bg: "bg-gradient-to-br from-[#0FB1A8] to-[#0B5E66]",
    icon: <BarChart3 size={56} strokeWidth={1.6} className="text-white/85" />,
  },
  coral: {
    bg: "bg-gradient-to-br from-[#FF6B61] to-[#B5443C]",
    icon: <Radio size={56} strokeWidth={1.6} className="text-white/85" />,
  },
  navy: {
    bg: "bg-gradient-to-br from-[#274B7A] to-[#0B2545]",
    icon: <Activity size={56} strokeWidth={1.6} className="text-white/85" />,
  },
} as const;
// Note: gradient hex values here are brand "art" fills (decorative,
// not semantic UI color) — acceptable as literals per the token rules.

export default function CourseCard({ course }: { course: Course }) {
  const art = artMap[course.art];
  return (
    <Link
      href={`/course/${course.id}`}
      className="block cursor-pointer rounded-lg2 border border-border bg-surface p-[18px] transition-all duration-200 ease-brand hover:-translate-y-[3px] hover:shadow-lift active:scale-[.98]"
    >
      <div
        className={`relative mb-3.5 flex h-24 items-end justify-end overflow-hidden rounded-md2 p-2.5 ${art.bg}`}
      >
        {art.icon}
      </div>
      <span className="text-[11px] font-bold uppercase tracking-[.1em] text-text-2">
        {course.tag}
      </span>
      <h4 className="my-1.5 font-display text-[15.5px] font-semibold leading-snug">
        {course.title}
      </h4>
      <div className="my-2.5">
        <ProgressBar value={course.progress} />
      </div>
      <div className="flex justify-between text-[12.5px] font-medium text-text-2">
        <span>
          {course.progress}% · {course.lessonsDone}/{course.lessonsTotal} lessons
        </span>
        <span>{course.timeLeft}</span>
      </div>
    </Link>
  );
}
