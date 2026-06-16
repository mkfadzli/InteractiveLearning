"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Local-only progress store backed by browser localStorage.
 * No accounts, no server — this is the "good enough for personal testing"
 * persistence layer. When we add a real backend later, the same shape moves
 * into Postgres unchanged.
 *
 * Keys are namespaced under "il:" so we can clear all app state with one
 * Object.keys(localStorage).filter(k=>k.startsWith("il:")) pass.
 */

const KEY = "il:progress:v1";
const POS_KEY = "il:position:v1"; // last opened lesson per course
const LAST = "il:last:v1";        // global "continue where I left off"

export type LessonProgress = {
  /** Highest story page reached (0-based). Lets you resume mid-lesson. */
  page: number;
  /** True once the lesson's quiz was finished (or final page reached for
   *  synthesized lessons with no quiz). */
  completed: boolean;
  /** Last quiz score, 0-1 (only set if there was a quiz). */
  score?: number;
  /** Updated-at, for cleanup later. */
  ts: number;
};

type ProgressMap = Record<string, LessonProgress>;
//                 ^-- key is `${courseId}::${lessonNumber}`

type PositionMap = Record<string, number>; // courseId -> last lessonNumber
type Last = { courseId: string; lessonNumber: number; ts: number } | null;

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can be full / disabled / Safari private mode — fail soft.
  }
}

function lessonKey(courseId: string, n: number) {
  return `${courseId}::${n}`;
}

// ------------------------------------------------------------- imperative API
export function getLessonProgress(courseId: string, n: number): LessonProgress | null {
  const map = safeGet<ProgressMap>(KEY, {});
  return map[lessonKey(courseId, n)] ?? null;
}

export function setLessonProgress(
  courseId: string,
  n: number,
  patch: Partial<LessonProgress>,
) {
  const map = safeGet<ProgressMap>(KEY, {});
  const k = lessonKey(courseId, n);
  const cur = map[k] ?? { page: 0, completed: false, ts: 0 };
  map[k] = { ...cur, ...patch, ts: Date.now() };
  safeSet(KEY, map);

  const positions = safeGet<PositionMap>(POS_KEY, {});
  positions[courseId] = n;
  safeSet(POS_KEY, positions);

  safeSet(LAST, { courseId, lessonNumber: n, ts: Date.now() } satisfies Last);
}

export function getCourseStats(courseId: string, totalLessons: number) {
  const map = safeGet<ProgressMap>(KEY, {});
  let completed = 0;
  for (let i = 1; i <= totalLessons; i++) {
    if (map[lessonKey(courseId, i)]?.completed) completed++;
  }
  const positions = safeGet<PositionMap>(POS_KEY, {});
  return {
    completed,
    total: totalLessons,
    percent: totalLessons ? Math.round((100 * completed) / totalLessons) : 0,
    lastOpened: positions[courseId] ?? 0,
  };
}

export function getLastSession(): Last {
  return safeGet<Last>(LAST, null);
}

export function clearAllProgress() {
  if (typeof window === "undefined") return;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith("il:"))
    .forEach((k) => window.localStorage.removeItem(k));
}

// ----------------------------------------------------------------- React hook
/** Subscribe to a single lesson's progress; rerenders on cross-tab updates too. */
export function useLessonProgress(courseId: string, n: number) {
  const [state, setState] = useState<LessonProgress | null>(null);

  useEffect(() => {
    setState(getLessonProgress(courseId, n));
    function onStorage(e: StorageEvent) {
      if (e.key === KEY) setState(getLessonProgress(courseId, n));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [courseId, n]);

  const update = useCallback(
    (patch: Partial<LessonProgress>) => {
      setLessonProgress(courseId, n, patch);
      setState(getLessonProgress(courseId, n));
    },
    [courseId, n],
  );

  return [state, update] as const;
}
