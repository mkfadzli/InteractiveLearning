# InteractiveLearning

**Author:** [Fadzli Abdullah](https://github.com/mkfad)  
**Organization:** Personal project, courtesy of Hetnet Wireless Technologies

Turn any PDF into an interactive course on your machine. Uploads and progress stay on your device.

**Stack:** Next.js 14 · TypeScript · Tailwind · Lucide · Python (PyMuPDF) · Claude API

> This is a personal project shared for reference. No license is provided — use at your own discretion.

---

## Quick start (Windows)

Double-click **`run.bat`** in the project folder, or run it from PowerShell:

```powershell
.\run.bat
```

The script will:
1. Check that Node.js is installed
2. Run `npm install` automatically on first launch (if `node_modules` is missing)
3. Open [http://localhost:3000](http://localhost:3000) in your browser
4. Start the Next.js dev server

Before the first run, copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY` if you want AI lesson enrichment (optional for structure preview).

You also need Python with PyMuPDF for PDF uploads:

```powershell
pip install pymupdf
```

---

## Setup

```bash
# 1. Install dependencies
npm install
pip install pymupdf

# 2. Configure environment
copy .env.example .env.local   # Windows
# cp .env.example .env.local   # macOS/Linux
# Then edit .env.local and set ANTHROPIC_API_KEY (optional for stage 1 preview)

# 3. Run
npm run dev                    # → http://localhost:3000
# Or on Windows: double-click run.bat
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | No (stage 2 only) | Claude API key for AI lesson enrichment |
| `IL_PYTHON` | No | Python executable (`python` on Windows, `python3` elsewhere) |
| `IL_JOBS_DIR` | No | Override temp directory for uploaded PDFs and generated courses |

---

## How it works

1. **Upload** a PDF on `/upload` (drag-and-drop, up to 50 MB).
2. The Python pipeline runs:
   - **pdf2course.py** — extracts chapter/section structure deterministically (PyMuPDF), classifying paragraphs, code listings (via monospace font detection), and figures.
   - **lessonwriter.py** — for each lesson, asks Claude to rewrite extracted paragraphs into interactive story pages + an MCQ knowledge check. Faithful-rewrite rules enforced in the system prompt (no invented facts; code blocks pass through verbatim).
3. Read the result on `/course/<id>` → `/course/<id>/lesson/<n>`.

---

## What's saved, and where

| Data | Location | Survives |
|---|---|---|
| Uploaded PDFs and generated `course.json` | `$TMPDIR/interactive-learning-jobs/<jobId>/` | Reboot (on most systems); not OS temp cleanups |
| Reading position (last page in each lesson) | Browser localStorage, key `il:position:v1` | Refresh, restart, browser close |
| Lesson completion + quiz scores | Browser localStorage, key `il:progress:v1` | Refresh, restart, browser close |
| Last opened lesson (for "Continue") | Browser localStorage, key `il:last:v1` | Refresh, restart, browser close |

If you clear browser data, your progress resets (uploads stay). Progress is per-browser, per-profile — switching machines means starting fresh, by design for this build.

To override the temp directory, set `IL_JOBS_DIR=/your/path` before `npm run dev`.

---

## Cost control

When `ANTHROPIC_API_KEY` is set, stage 2 (lesson generation) runs on every lesson by default. A 100-lesson book is ~100 sequential API calls and ~30–60 minutes. To cap it, edit `src/app/api/jobs/[id]/stream/route.ts` and change `["--enrich"]` to `["--enrich", "--limit", "5"]`.

Without `ANTHROPIC_API_KEY`, stage 1 still runs — lessons open as "structure previews" of the raw extracted content. Useful for inspecting whether the PDF was extracted well before paying for the LLM pass.

---

## Architecture

```
Browser  ──(POST /api/upload)──▶  Node: writes PDF to disk, returns jobId
   │
   └─(EventSource /api/jobs/[id]/stream)──▶ Node spawns python3 scripts/pipeline.py
                                                  │
                                                  ├─ pdf2course.py (structure + extract)
                                                  └─ lessonwriter.py (Claude calls; optional)
                                                  │
                                            stderr JSON-lines progress
                                                  │
                                          ◀── SSE forwards to browser
                                                  │
   on completion: course.json on disk, library page sees the new course.
```

---

## File map

```
src/
  app/
    library/          — home: lists your uploaded courses
    upload/           — drag-and-drop PDF + SSE-streamed pipeline progress
    course/[id]/      — roadmap with localStorage completion overlay
    course/[id]/lesson/[n]/ — interactive lesson player
    api/upload/                  — POST: receive PDF
    api/jobs/[id]/stream/        — GET SSE: run pipeline, stream progress
  components/
    TopBar, ThemeToggle,
    CourseLibraryGrid     — empty state, "continue" banner, course cards
    CourseRoadmap         — modules + lessons with per-lesson completion
    LessonPlayer          — story pages + quiz + completion ring
    LessonTOC             — sidebar with done-state ticks
  lib/
    course.ts             — typed course schema + disk loader
    jobs.ts               — paths under $TMPDIR/interactive-learning-jobs/
    library.ts            — server-side: scan jobs dir for uploaded courses
    progress.ts           — localStorage API + React hook
  app/globals.css         — design tokens (CSS variables, light/dark)
scripts/
  pdf2course.py           — stage 1: PDF → structured course.json
  lessonwriter.py         — stage 2: course.json → enriched stories + quizzes
  pipeline.py             — runner that orchestrates both, emits SSE events
run.bat                   — Windows launcher (install deps + start dev server)
sample-course-*.json      — example course output for local testing
```

---

## Known gaps (personal-testing build)

- Single-machine only — progress doesn't sync across devices (localStorage)
- No accounts, no auth, no multi-user
- `/tmp/` may be cleaned by OS housekeeping eventually
- Scanned PDFs are detected (`likely_scanned` flag) but not OCR-handled
- Tables come through as text and may be filtered as "too short" lessons
- Stage 2 is sequential (one lesson at a time); no batching or retries-with-backoff

---

## Push to GitHub (PowerShell)

Run these commands from the project folder. Replace `YOUR_GITHUB_USERNAME` and repo name as needed.

```powershell
# 1. Go to the project
cd "C:\Users\mkfad\OneDrive\Desktop\01. MY_GITHUB\InteractiveLearning"

# 2. Initialize git (first time only)
git init

# 3. Stage all tracked files (.env.local, node_modules, .next are gitignored)
git add .

# 4. First commit
git commit -m "Initial commit: InteractiveLearning personal build"

# 5. Create an empty repo on GitHub first (https://github.com/new), then:
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/InteractiveLearning.git

# 6. Push
git push -u origin main
```

If GitHub asks for credentials, use a [Personal Access Token](https://github.com/settings/tokens) as the password (not your GitHub account password).

To push updates later:

```powershell
git add .
git commit -m "Describe your changes"
git push
```

---

**© Fadzli Abdullah** · Personal project, courtesy of Hetnet Wireless Technologies
