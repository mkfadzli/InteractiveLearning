"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  FileText,
  Loader2,
  Upload as UploadIcon,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const STAGES = [
  { key: "probe",     label: "Probe & inspect",                 detail: "Check pages, fonts, text coverage" },
  { key: "structure", label: "Detect structure",                detail: "Find chapters and sections from the outline or fonts" },
  { key: "extract",   label: "Extract blocks",                  detail: "Paragraphs, code listings, figures, page-by-page" },
  { key: "enrich",    label: "Generate interactive lessons",    detail: "Story rewrites + quizzes via Claude (needs API key)" },
] as const;

type Summary = {
  event: "done";
  summary: { modules: number; lessons: number; figures: number; words: number; est_hours: number };
  confidence: { score: number; flags: string[] };
  enriched: number;
};

type ProgressEvent =
  | { event: "stage"; stage: string; status: "start" | "done"; stats?: Record<string, unknown> }
  | { event: "extract_progress"; done: number; total: number }
  | { event: "enrich_progress"; done: number; total: number; title?: string }
  | { event: "enrich_skipped"; reason: string }
  | Summary
  | { event: "error"; message: string };

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [stages, setStages] = useState<Record<string, "pending" | "active" | "done">>({});
  const [extractProgress, setExtractProgress] = useState<{ done: number; total: number } | null>(null);
  const [enrichProgress, setEnrichProgress] = useState<{ done: number; total: number; title?: string } | null>(null);
  const [skippedReason, setSkippedReason] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null); setJobId(null); setStages({}); setExtractProgress(null);
    setEnrichProgress(null); setSkippedReason(null); setSummary(null); setError(null);
  }, []);

  const handleEvent = useCallback((p: ProgressEvent) => {
    switch (p.event) {
      case "stage":
        setStages((prev) => ({ ...prev, [p.stage]: p.status === "done" ? "done" : "active" }));
        break;
      case "extract_progress":
        setExtractProgress({ done: p.done, total: p.total });
        break;
      case "enrich_progress":
        setEnrichProgress({ done: p.done, total: p.total, title: p.title });
        break;
      case "enrich_skipped":
        setSkippedReason(p.reason);
        setStages((prev) => ({ ...prev, enrich: "done" }));
        break;
      case "done":
        setSummary(p);
        break;
      case "error":
        setError(p.message);
        break;
    }
  }, []);

  async function handleFile(f: File) {
    if (!/\.pdf$/i.test(f.name)) {
      setError("Only .pdf files are accepted."); return;
    }
    reset();
    setFile(f);

    const fd = new FormData(); fd.append("file", f);
    let up: Response;
    try {
      up = await fetch("/api/upload", { method: "POST", body: fd });
    } catch (e) {
      setError("Upload failed: " + (e as Error).message); return;
    }
    if (!up.ok) {
      const j = (await up.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? `Upload failed (${up.status})`); return;
    }
    const { jobId: id } = (await up.json()) as { jobId: string };
    setJobId(id);

    const es = new EventSource(`/api/jobs/${id}/stream`);
    es.addEventListener("progress", (ev) => {
      try {
        const p = JSON.parse((ev as MessageEvent<string>).data) as ProgressEvent;
        handleEvent(p);
      } catch {
        // ignore malformed line
      }
    });
    es.addEventListener("note", (ev) => {
      // Non-JSON stderr from the subprocess — Python warning, traceback, etc.
      // Show in dev so silent failures stop being silent.
      try {
        const { line } = JSON.parse((ev as MessageEvent<string>).data) as { line: string };
        // eslint-disable-next-line no-console
        console.warn("[pipeline stderr]", line);
        // If it looks like an error message, surface it.
        if (/error|traceback|not found|modulenotfound/i.test(line)) {
          setError((prev) => (prev ? prev + "\n" + line : line));
        }
      } catch {}
    });
    es.addEventListener("close", () => es.close());
    es.onerror = () => {
      // Browser-level connection error (different from pipeline errors,
      // which arrive as "progress" with event:"error"). Treat as soft failure.
    };
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  }

  const extractPct = extractProgress
    ? Math.round((100 * extractProgress.done) / Math.max(1, extractProgress.total))
    : 0;

  return (
    <div className="mx-auto min-h-dvh max-w-[1180px] bg-surface md:my-6 md:rounded-3xl md:border md:border-border md:shadow-lift">
      <header className="glass sticky top-0 z-30 flex items-center gap-3.5 border-b px-5 py-3">
        <Link href="/library" aria-label="Back to library"
          className="grid h-10 w-10 flex-none place-items-center rounded-xl text-text-2 transition-colors hover:bg-surface-2">
          <ChevronLeft size={19} />
        </Link>
        <b className="font-display text-[15px]">Create a course from PDF</b>
        <span className="ml-auto" />
        <ThemeToggle />
      </header>

      <div className="grid gap-6 px-6 py-7 md:grid-cols-[1.05fr_1fr] md:px-8">
        {/* ---- Upload + timeline ---- */}
        <section>
          {!file ? (
            <button type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="block w-full cursor-pointer rounded-lg2 border-2 border-dashed border-border bg-surface px-6 py-9 text-center transition-all duration-200 ease-brand hover:border-teal hover:bg-teal-soft">
              <span className="mx-auto mb-3 grid h-[60px] w-[60px] place-items-center rounded-2xl bg-teal-soft text-primary">
                <UploadIcon size={26} />
              </span>
              <h3 className="text-[17px] font-semibold">Drop your PDF here</h3>
              <p className="mt-1 text-[13.5px] text-text-2">
                or <strong className="text-primary">browse files</strong> · up to 50 MB
              </p>
              <input ref={inputRef} type="file" accept="application/pdf" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
            </button>
          ) : (
            <div className="flex items-center gap-3.5 rounded-md2 border border-border bg-surface p-4">
              <span className="grid h-[42px] w-[42px] flex-none place-items-center rounded-xl bg-coral-soft text-coral-deep">
                <FileText size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[14px]">{file.name}</b>
                <span className="text-[12px] text-text-2">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · uploaded
                </span>
              </div>
              {summary || error ? (
                <button onClick={reset}
                  className="rounded-sm2 border border-border px-3 py-2 text-[13px] font-semibold hover:bg-surface-2">
                  New file
                </button>
              ) : (
                <Loader2 size={20} className="animate-spin text-primary" />
              )}
            </div>
          )}

          {error && (
            <div role="alert" className="mt-4 flex gap-3 rounded-md2 border border-error bg-coral-soft px-4 py-3.5 text-[13.5px]">
              <AlertTriangle size={18} className="mt-0.5 flex-none text-error" />
              <div>
                <b className="block font-display">Pipeline error</b>
                <pre className="mt-1 whitespace-pre-wrap font-mono text-[12px]">{error}</pre>
                <p className="mt-2 text-text-2">
                  Common in local dev: <code>python3</code> not on PATH, or
                  PyMuPDF missing (<code>pip install pymupdf</code>). See README.
                </p>
              </div>
            </div>
          )}

          {file && (
            <ol className="mt-6" aria-label="Processing pipeline">
              {STAGES.map((s, i) => {
                const state = stages[s.key] ?? "pending";
                const showExtractPct = s.key === "extract" && state === "active" && extractProgress;
                const showEnrich = s.key === "enrich" && state === "active" && enrichProgress;
                return (
                  <li key={s.key} className="relative flex gap-3.5 pb-5 last:pb-0">
                    {i < STAGES.length - 1 && (
                      <span aria-hidden
                        className={`absolute left-[15px] top-8 h-full w-[2px] ${state === "done" ? "bg-teal" : "bg-border"}`} />
                    )}
                    <span className={`relative z-10 grid h-8 w-8 flex-none place-items-center rounded-full border-2 ${
                      state === "done" ? "border-teal bg-teal text-white"
                        : state === "active" ? "border-primary text-primary"
                        : "border-border bg-surface text-text-2"
                    }`}>
                      {state === "done" ? <Check size={15} strokeWidth={3} />
                        : state === "active" ? <Loader2 size={15} className="animate-spin" />
                        : <span className="text-[12px] font-bold">{i + 1}</span>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <b className="text-[14px]">{s.label}</b>
                      <span className="block text-[12.5px] text-text-2">
                        {s.key === "enrich" && skippedReason ? `Skipped — ${skippedReason}` : s.detail}
                      </span>
                      {showExtractPct && (
                        <div className="mt-2 max-w-[260px]">
                          <div className="h-[6px] overflow-hidden rounded-full bg-surface-2">
                            <i className="block h-full rounded-full bg-teal transition-[width] duration-300" style={{ width: `${extractPct}%` }} />
                          </div>
                          <span className="mt-1 block text-[11.5px] tabular-nums text-text-2">
                            {extractProgress!.done} / {extractProgress!.total} lessons
                          </span>
                        </div>
                      )}
                      {showEnrich && (
                        <div className="mt-2 max-w-[300px] text-[12px] text-text-2">
                          Lesson {enrichProgress!.done} / {enrichProgress!.total}
                          {enrichProgress!.title ? ` · ${enrichProgress!.title}` : ""}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* ---- Summary panel ---- */}
        <aside className="rounded-lg2 border border-border bg-surface p-6 shadow-card">
          {!summary ? (
            <div className="grid h-full place-items-center py-8 text-center text-text-2">
              <div>
                <FileText size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-[14px]">
                  Once your PDF is processed, the extraction summary appears here:
                  module/lesson breakdown, confidence, page ranges.
                </p>
              </div>
            </div>
          ) : (
            <>
              <span className="text-[11.5px] font-bold uppercase tracking-[.13em] text-primary">
                Extraction summary
              </span>
              <h3 className="mb-3 mt-1.5 font-display text-[19px] font-semibold">
                Here&rsquo;s the course we built
              </h3>
              <div className="mb-4 flex flex-wrap gap-2">
                {(["modules", "lessons", "figures", "est_hours"] as const).map((k) => {
                  const v = summary.summary[k];
                  const label = k === "est_hours" ? "hours" : k;
                  return (
                    <span key={k} className="rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold">
                      {v} {label}
                    </span>
                  );
                })}
              </div>
              <div className="mb-4 flex items-center gap-2.5 text-[13.5px]">
                <span className="font-display font-bold">Confidence</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${
                  summary.confidence.score >= 0.8 ? "bg-teal-soft text-primary"
                    : summary.confidence.score >= 0.6 ? "bg-coral-soft text-coral-deep"
                    : "bg-coral-soft text-error"
                }`}>
                  {summary.confidence.score.toFixed(2)}
                </span>
              </div>
              {summary.confidence.flags.length > 0 && (
                <ul className="mb-4 space-y-1.5 rounded-md2 bg-coral-soft px-3.5 py-3 text-[12.5px]">
                  {summary.confidence.flags.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <AlertTriangle size={14} className="mt-0.5 flex-none text-coral-deep" />{f}
                    </li>
                  ))}
                </ul>
              )}
              {summary.enriched > 0 ? (
                <p className="mb-4 rounded-md2 bg-teal-soft px-3.5 py-3 text-[12.5px] text-primary">
                  Stage 2 ran on the first {summary.enriched} lesson{summary.enriched === 1 ? "" : "s"} —
                  full interactive stories with quizzes are ready.
                </p>
              ) : skippedReason ? (
                <p className="mb-4 rounded-md2 bg-surface-2 px-3.5 py-3 text-[12.5px] text-text-2">
                  Stage 2 skipped ({skippedReason}). Lessons open as structure
                  previews; set <code>ANTHROPIC_API_KEY</code> and re-upload to
                  generate the full interactive content.
                </p>
              ) : null}
              <button onClick={() => router.push(`/course/${jobId}`)}
                className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-sm2 bg-primary px-5 py-2.5 text-[14.5px] font-semibold text-on-primary shadow-[0_4px_14px_rgba(15,177,168,.3)] transition-all duration-200 ease-brand hover:brightness-110 active:scale-[.97]">
                Open course <ArrowRight size={15} />
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
