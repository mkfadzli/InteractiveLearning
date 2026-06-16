#!/usr/bin/env python3
"""
pipeline runner — used by the Next.js /api/jobs/:id/stream route.

Reads:  --pdf SOURCE.pdf  --out DIR  [--enrich] [--limit N]
Writes: <DIR>/course.json   (final result, lesson player consumes this)
        <DIR>/source.pdf    (already placed there by the API route)
Emits: JSON-lines progress events on STDERR for the SSE route to forward.
       One event per line, schema:
         {event:"stage", stage:"probe|structure|extract|enrich",
          status:"start|done", stats?: object}
         {event:"extract_progress", done:int, total:int}
         {event:"enrich_progress",  done:int, total:int}
         {event:"done", summary:object, confidence:object}
         {event:"error", message:str}
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import traceback
from pathlib import Path

import pdf2course

try:
    import lessonwriter  # optional — only used when --enrich is passed
except ImportError:
    lessonwriter = None


def _emit(**kw) -> None:
    print(json.dumps(kw, separators=(",", ":")), file=sys.stderr, flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--enrich", action="store_true",
                    help="run stage 2 (requires ANTHROPIC_API_KEY)")
    ap.add_argument("--limit", type=int, default=5,
                    help="max lessons to enrich (cost control)")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    try:
        # Stage 1 — extract structure. pdf2course already emits its own
        # stage/progress events on stderr; we let them pass through.
        course = pdf2course.run(args.pdf)
        (out / "course.json").write_text(json.dumps(course, indent=1))

        # Stage 2 — optional enrichment
        enriched_count = 0
        if args.enrich:
            key = os.environ.get("ANTHROPIC_API_KEY")
            if not key:
                _emit(event="enrich_skipped",
                      reason="ANTHROPIC_API_KEY not set")
            elif lessonwriter is None:
                _emit(event="enrich_skipped",
                      reason="lessonwriter module unavailable")
            else:
                total = min(args.limit, sum(len(m["lessons"])
                                             for m in course["modules"]))
                _emit(event="stage", stage="enrich", status="start",
                      total=total)
                done = 0
                for m in course["modules"]:
                    for l in m["lessons"]:
                        if done >= args.limit:
                            break
                        paras = [b["text"] for b in l.get("raw_blocks", [])
                                 if b.get("type") == "paragraph"]
                        if not paras:
                            continue
                        try:
                            prompt = lessonwriter.build_user_prompt(
                                l["title"], paras)
                            raw = lessonwriter.call_claude(
                                prompt, lessonwriter.DEFAULT_MODEL, key)
                            l["story"] = lessonwriter.parse_and_validate(raw)
                            enriched_count += 1
                        except Exception as e:  # noqa: BLE001
                            l["story_error"] = str(e)[:200]
                        done += 1
                        _emit(event="enrich_progress",
                              done=done, total=total,
                              title=l["title"][:60])
                (out / "course.json").write_text(json.dumps(course, indent=1))
                _emit(event="stage", stage="enrich", status="done",
                      stats={"enriched": enriched_count})

        _emit(event="done",
              summary=course["summary"],
              confidence=course["confidence"],
              enriched=enriched_count)
    except Exception as e:  # noqa: BLE001
        _emit(event="error",
              message=f"{type(e).__name__}: {e}",
              traceback=traceback.format_exc()[-1200:])
        sys.exit(1)


if __name__ == "__main__":
    main()
