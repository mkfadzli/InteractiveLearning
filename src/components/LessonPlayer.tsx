"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  Lightbulb,
  Star,
  X,
} from "lucide-react";
import type { Block, EnrichedLesson, Story } from "@/lib/course";
import { useLessonProgress } from "@/lib/progress";
import LessonTOC from "./LessonTOC";

/* ---------------------------------------------------------- blocks renderer */
function BlockView({ b }: { b: Block }) {
  switch (b.type) {
    case "heading":
      return (
        <h1
          tabIndex={-1}
          data-page-heading
          className="mb-3.5 mt-1 text-[26px] font-bold leading-tight tracking-tight outline-none"
        >
          {b.text}
        </h1>
      );
    case "paragraph":
      return <p className="mb-3.5 max-w-[68ch] text-[16px]">{b.text}</p>;
    case "callout":
      return (
        <div className="my-4 flex gap-3.5 rounded-md2 border-l-4 border-coral bg-coral-soft px-4 py-3.5">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-coral text-white">
            <Lightbulb size={16} />
          </span>
          <div>
            <b className="block font-display text-[14px]">{b.title ?? "Note"}</b>
            <p className="text-[13.5px]">{b.text}</p>
          </div>
        </div>
      );
    case "key_idea":
      return (
        <div className="my-4 flex items-center gap-2.5 rounded-sm2 bg-teal-soft px-3.5 py-3 text-[14px] font-semibold text-primary">
          <Check size={16} strokeWidth={2.6} className="flex-none" />
          {b.text}
        </div>
      );
    case "code":
      return (
        <figure className="my-4">
          <pre className="overflow-x-auto rounded-md2 border border-border bg-navy px-4 py-3.5 font-mono text-[13px] leading-relaxed text-[#EAF1F8]">
            <code>{b.text}</code>
          </pre>
          {b.caption && (
            <figcaption className="mt-1.5 text-[12px] text-text-2">{b.caption}</figcaption>
          )}
        </figure>
      );
    case "figure_ref":
      return (
        <div className="my-4 rounded-md2 border border-border bg-surface-2 px-4 py-6 text-center text-[13px] text-text-2">
          Figure from source PDF{b.page ? ` (p. ${b.page})` : ""}
          {b.caption ? ` — ${b.caption}` : ""}
        </div>
      );
  }
}

/* ----------------------------------------------------------------- progress */
function SegBar({ total, at }: { total: number; at: number }) {
  return (
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={at}
      aria-label={`Step ${at} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <i
          key={i}
          className={`h-[5px] flex-1 rounded-full transition-colors duration-200 ${
            i < at ? "bg-teal" : "bg-surface-2"
          }`}
        />
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------- quiz */
function Quiz({
  story,
  onDone,
}: {
  story: Story;
  onDone: (score: number) => void;
}) {
  const qs = story.quiz.questions;
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = qs[qi];
  const answered = picked !== null;
  const correct = answered && picked === q.correctIndex;

  function pick(i: number) {
    if (answered) return;
    setPicked(i);
    if (i === q.correctIndex) setScore((s) => s + 1);
  }
  function next() {
    if (qi + 1 >= qs.length) onDone(score);
    else {
      setQi(qi + 1);
      setPicked(null);
    }
  }

  return (
    <div>
      <span className="mb-3 inline-block rounded-full bg-teal-soft px-3 py-1 text-[12px] font-bold text-primary">
        Knowledge check · {qi + 1} of {qs.length}
      </span>
      <h1 className="mb-5 text-[20px] font-bold leading-snug">{q.prompt}</h1>

      {q.options.map((o, i) => {
        const state = !answered
          ? ""
          : i === q.correctIndex
            ? "border-success bg-teal-soft"
            : i === picked
              ? "border-error bg-coral-soft"
              : "opacity-60";
        return (
          <button
            key={i}
            type="button"
            disabled={answered}
            onClick={() => pick(i)}
            aria-pressed={picked === i}
            className={`mb-2.5 flex min-h-[52px] w-full items-center gap-3.5 rounded-md2 border-[1.5px] border-border bg-surface px-4 py-3.5 text-left text-[15px] font-medium transition-all duration-200 ease-brand ${
              !answered ? "cursor-pointer hover:border-teal hover:bg-teal-soft" : ""
            } ${state}`}
          >
            <span
              className={`grid h-7 w-7 flex-none place-items-center rounded-lg text-[12.5px] font-bold ${
                answered && i === q.correctIndex
                  ? "bg-success text-white"
                  : answered && i === picked
                    ? "bg-error text-white"
                    : "bg-surface-2 text-text-2"
              }`}
            >
              {"ABCD"[i]}
            </span>
            {o}
            {answered && i === q.correctIndex && (
              <Check size={18} className="ml-auto flex-none text-success" strokeWidth={2.8} />
            )}
            {answered && i === picked && i !== q.correctIndex && (
              <X size={18} className="ml-auto flex-none text-error" strokeWidth={2.6} />
            )}
          </button>
        );
      })}

      {answered && (
        <div
          role="status"
          className={`mt-3.5 flex gap-3 rounded-md2 px-4 py-3.5 text-[14px] ${
            correct ? "bg-teal-soft" : "bg-coral-soft"
          }`}
        >
          <div>
            <b className="block font-display text-[14px]">
              {correct ? "Correct — nice!" : "Not quite."}
            </b>
            {q.explanation}
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        {correct ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-coral-soft px-3.5 py-1.5 font-display text-[14px] font-bold text-coral-deep">
            <Star size={14} fill="currentColor" /> +15 XP
          </span>
        ) : (
          <span />
        )}
        {answered && (
          <button
            type="button"
            onClick={next}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm2 bg-primary px-5 py-2.5 text-[14.5px] font-semibold text-on-primary transition-all duration-200 ease-brand hover:brightness-110 active:scale-[.97]"
          >
            {qi + 1 >= qs.length ? "Finish" : "Next question"}
            <ArrowRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- player */
export default function LessonPlayer({
  courseId,
  lessonNumber,
  lesson,
  flat,
  moduleTitle,
}: {
  courseId: string;
  lessonNumber: number;
  lesson: EnrichedLesson;
  flat: EnrichedLesson[];
  moduleTitle: string;
}) {
  const story = lesson.story!;
  const hasQuiz = story.quiz.questions.length > 0;
  const totalSteps = story.pages.length + (hasQuiz ? 1 : 0);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const [saved, updateSaved] = useLessonProgress(courseId, lessonNumber);
  const [restored, setRestored] = useState(false);

  // Restore last position once on hydrate. Don't restore past completion —
  // a finished lesson always re-opens at the start so users can re-read.
  useEffect(() => {
    if (restored) return;
    if (saved && !saved.completed && saved.page > 0 && saved.page < story.pages.length) {
      setStep(saved.page);
    }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved !== null]);

  // Persist page changes (debounced via React batching is fine here — writes
  // are cheap and localStorage is sync). Skip until restore completes so we
  // don't overwrite saved state with the default 0.
  useEffect(() => {
    if (!restored) return;
    if (step < story.pages.length) {
      updateSaved({ page: step });
    }
  }, [step, restored, story.pages.length, updateSaved]);

  // Auto-finalize when there's no quiz and the user clicks past the last page.
  useEffect(() => {
    if (!hasQuiz && step >= story.pages.length && result === null) {
      setResult(0);
    }
  }, [hasQuiz, step, story.pages.length, result]);

  // Mark complete when a result lands (either quiz finished or no-quiz finish).
  useEffect(() => {
    if (result !== null) {
      const qCount = story.quiz.questions.length;
      const score = hasQuiz && qCount > 0 ? result / qCount : undefined;
      updateSaved({
        completed: true,
        page: story.pages.length - 1,
        ...(score !== undefined && { score }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const goto = useCallback(
    (s: number) => {
      setStep(Math.max(0, Math.min(totalSteps - 1, s)));
      requestAnimationFrame(() => {
        mainRef.current
          ?.querySelector<HTMLElement>("[data-page-heading]")
          ?.focus();
      });
    },
    [totalSteps],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest("button,input,textarea")) return;
      if (e.key === "ArrowRight" && step < story.pages.length - 1) goto(step + 1);
      if (e.key === "ArrowLeft" && step > 0 && step < story.pages.length) goto(step - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, story.pages.length, goto]);

  const inQuiz = hasQuiz && step >= story.pages.length && result === null;
  const done = result !== null;
  const nQ = story.quiz.questions.length;
  const pct = done && nQ > 0 ? Math.round((100 * result!) / nQ) : 100;
  const ringC = 2 * Math.PI * 40;

  return (
    <div className="grid lg:grid-cols-[270px_1fr]">
      <LessonTOC
        courseId={courseId}
        lessonNumber={lessonNumber}
        flat={flat}
        moduleTitle={moduleTitle}
      />

      {/* Stage */}
      <main ref={mainRef} className="px-6 py-7 md:px-10 lg:max-w-[760px]">
        <SegBar total={totalSteps} at={done ? totalSteps : step + 1} />
        <div className="mt-5" key={done ? "done" : inQuiz ? "quiz" : step}>
          {!inQuiz && !done && (
            <>
              <span className="text-[12px] font-bold uppercase tracking-[.14em] text-coral-deep">
                Story page · ~{story.est_minutes} min lesson
              </span>
              {story.pages[step].blocks.map((b, i) => (
                <BlockView key={i} b={b} />
              ))}
              <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
                <button
                  type="button"
                  onClick={() => goto(step - 1)}
                  disabled={step === 0}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm2 border border-border px-5 py-2.5 text-[14.5px] font-semibold transition-colors hover:bg-surface-2 disabled:cursor-default disabled:opacity-40"
                >
                  <ChevronLeft size={15} /> Previous
                </button>
                <span className="hidden text-[12.5px] text-text-2 sm:block">
                  Page {step + 1} of {story.pages.length} · <kbd className="rounded border border-border bg-surface-2 px-1.5 text-[11px]">←</kbd>{" "}
                  <kbd className="rounded border border-border bg-surface-2 px-1.5 text-[11px]">→</kbd>
                </span>
                <button
                  type="button"
                  onClick={() => goto(step + 1)}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm2 bg-primary px-5 py-2.5 text-[14.5px] font-semibold text-on-primary shadow-[0_4px_14px_rgba(15,177,168,.3)] transition-all duration-200 ease-brand hover:brightness-110 active:scale-[.97]"
                >
                  {step === story.pages.length - 1
                    ? hasQuiz
                      ? "Start knowledge check"
                      : "Finish lesson"
                    : "Continue"}
                  <ArrowRight size={15} />
                </button>
              </div>
            </>
          )}

          {inQuiz && <Quiz story={story} onDone={setResult} />}

          {done && (
            <div className="py-4 text-center">
              <div
                role="img"
                aria-label={`Score ${pct} percent`}
                className="relative mx-auto mb-3 h-24 w-24"
              >
                <svg width="96" height="96" className="-rotate-90">
                  <circle cx="48" cy="48" r="40" fill="none" strokeWidth="9" className="stroke-surface-2" />
                  <circle
                    cx="48" cy="48" r="40" fill="none" strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={ringC} strokeDashoffset={ringC * (1 - pct / 100)}
                    className="stroke-teal"
                  />
                </svg>
                <span className="absolute inset-0 grid place-items-center font-display text-[19px] font-bold">
                  {pct}%
                </span>
              </div>
              <h1 className="text-[21px] font-bold">Lesson complete</h1>
              <p className="mt-1 text-[14px] text-text-2">
                {nQ > 0
                  ? `${result} of ${nQ} correct · +${result! * 15 + 20} XP earned`
                  : "Structure preview viewed — generate the full lesson to earn XP and unlock the quiz."}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => { setResult(null); setStep(0); }}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm2 border border-border px-5 py-2.5 text-[14.5px] font-semibold transition-colors hover:bg-surface-2"
                >
                  <ArrowLeft size={15} /> Replay lesson
                </button>
                {lessonNumber < flat.length ? (
                  <Link
                    href={`/course/${courseId}/lesson/${lessonNumber + 1}`}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm2 bg-primary px-5 py-2.5 text-[14.5px] font-semibold text-on-primary transition-all duration-200 ease-brand hover:brightness-110"
                  >
                    Next lesson <ArrowRight size={15} />
                  </Link>
                ) : (
                  <Link
                    href={`/course/${courseId}`}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm2 bg-primary px-5 py-2.5 text-[14.5px] font-semibold text-on-primary transition-all duration-200 ease-brand hover:brightness-110"
                  >
                    Back to course <ArrowRight size={15} />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
