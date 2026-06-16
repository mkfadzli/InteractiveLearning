export type Course = {
  id: string;
  title: string;
  tag: string;
  progress: number; // 0–100
  lessonsDone: number;
  lessonsTotal: number;
  timeLeft: string;
  art: "teal" | "coral" | "navy";
};

export const user = {
  name: "Fadzli",
  initials: "FA",
  xp: 2480,
  streakDays: 12,
  weeklyXp: 340,
  weeklyGoal: 500,
};

export const continueCourse = {
  id: "linux-basics",
  title: "Linux Basics for Hackers — Chapter 2",
  subtitle:
    "Chapter 2 · Next up: “Finding the needle: filtering streams with grep” — 4 min read + 3 checks",
  progress: 58,
};

export const courses: Course[] = [
  {
    id: "linux-basics",
    title: "Linux Basics for Hackers (sample)",
    tag: "From PDF · 250 pages",
    progress: 8,
    lessonsDone: 0,
    lessonsTotal: 2,
    timeLeft: "~1h left",
    art: "teal",
  },
  {
    id: "rf-kpi",
    title: "RF Optimization: KPI Deep-Dive",
    tag: "From PDF · 96 pages",
    progress: 34,
    lessonsDone: 6,
    lessonsTotal: 17,
    timeLeft: "~3h left",
    art: "coral",
  },
  {
    id: "transport",
    title: "Transport & Optical Networks 101",
    tag: "New · processed today",
    progress: 6,
    lessonsDone: 0,
    lessonsTotal: 14,
    timeLeft: "14 lessons",
    art: "navy",
  },
];

// Mon..Sun — "on" = learned, "hot" = today (streak day)
export const week: ("on" | "hot" | "off")[] = [
  "on",
  "on",
  "on",
  "hot",
  "off",
  "off",
  "off",
];
