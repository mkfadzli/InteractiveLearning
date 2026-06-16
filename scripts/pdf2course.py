#!/usr/bin/env python3
"""
pdf2course — prototype: any PDF -> course structure JSON
Stage 1 of the InteractiveLearning pipeline (deterministic, no LLM).

Output contract (consumed later by the LLM lesson-writer and the lesson player):
{
  "source": {...}, "confidence": {...},
  "modules": [
    { "title", "order", "page_start", "page_end",
      "lessons": [
        { "title", "order", "page_start", "page_end", "word_count",
          "est_minutes", "figures": [...], "raw_blocks": [block, ...] } ] } ]
}
raw_blocks types: heading | paragraph | figure_ref  (LLM later rewrites
paragraphs into story blocks + callouts + quizzes; figures pass through).

Strategy:
  A. Probe: digital vs scanned, text coverage.
  B. Structure: embedded TOC if present & sane, else font/numbering heuristics.
  C. Segment: level-1 entries -> modules, level-2 -> lessons
     (long flat docs get auto-chunked lessons).
  D. Extract: paragraphs + figure references per lesson.
  E. Report: counts, reading time, confidence + flags.
"""
from __future__ import annotations

import json
import re
import statistics
import sys
from collections import Counter
from dataclasses import dataclass, field

import fitz  # PyMuPDF

WPM = 200                      # reading speed for est_minutes
MAX_LESSON_WORDS = 1800        # auto-chunk threshold for flat documents
MIN_HEADING_RATIO = 1.15       # heading font >= body * ratio (heuristic path)
MIN_LESSON_WORDS = 80          # below this, flag a lesson as too thin
CODE_FONT_RATIO = 0.6          # >=60% block text in monospaced spans -> code
NUM_RE = re.compile(r"^(\d+)(\.\d+)*\.?\s+\S")          # 1 / 1.2 / 1.2.3 Title
FRONT_RE = re.compile(
    r"^(contents|table of contents|brief contents|index|references|"
    r"bibliography|acknowledg|preface|foreword|"
    r"list of (figures|tables)|copyright|about the author)\b", re.I)
CAPTION_RE = re.compile(
    r"^(figure|fig\.|table|diagram|chart|exhibit|listing)\s*\d", re.I)
# Monospaced/code-typeface signatures (case-insensitive, matched in font names).
# We match "mono" anywhere because no normal prose typeface contains it.
MONO_FONT_RE = re.compile(
    r"(mono|courier|consolas|menlo|inconsolata|"
    r"sourcecodepro|fira[\s-]?code|"
    r"andale|lucida[\s]?console|typewriter|terminal)", re.I)


def _emit(**kw) -> None:
    """One-line JSON progress event on stderr for the runner to forward."""
    print(json.dumps(kw, separators=(",", ":")), file=sys.stderr, flush=True)


# ----------------------------------------------------------------- data model
@dataclass
class Heading:
    level: int
    title: str
    page: int          # 0-based
    y: float = 0.0     # vertical position on page (for slicing)


@dataclass
class Lesson:
    title: str
    order: int
    page_start: int
    page_end: int
    y_start: float = 0.0
    y_end: float = 1e9
    word_count: int = 0
    figures: list = field(default_factory=list)
    raw_blocks: list = field(default_factory=list)


@dataclass
class Module:
    title: str
    order: int
    page_start: int
    page_end: int
    lessons: list = field(default_factory=list)


# -------------------------------------------------------------- stage A: probe
def probe(doc: fitz.Document) -> dict:
    n = doc.page_count
    sample = range(0, n, max(1, n // 40))  # ~40 pages sampled
    text_pages = sum(1 for i in sample if len(doc[i].get_text("text").strip()) > 40)
    coverage = text_pages / max(1, len(list(sample)))
    return {
        "pages": n,
        "title": (doc.metadata or {}).get("title") or "",
        "text_coverage": round(coverage, 2),
        "likely_scanned": coverage < 0.5,
    }


# ----------------------------------------------- stage B1: embedded TOC route
def toc_headings(doc: fitz.Document) -> list[Heading] | None:
    toc = doc.get_toc(simple=True)  # [[level, title, page1based], ...]
    if not toc or len(toc) < 3:
        return None
    hs = [Heading(level=lv, title=t.strip(), page=max(0, p - 1))
          for lv, t, p in toc if t and t.strip()]
    # sanity: monotonic-ish pages, plausible count
    pages = [h.page for h in hs]
    if sum(1 for a, b in zip(pages, pages[1:]) if b < a) > len(pages) * 0.1:
        return None
    return hs


# -------------------------------------------- stage B2: font/number heuristics
def heuristic_headings(doc: fitz.Document) -> tuple[list[Heading], dict]:
    """No outline embedded: infer headings from font size, weight, numbering."""
    sizes: Counter = Counter()
    lines = []  # (page, y, size, bold, text)
    for pno in range(doc.page_count):
        d = doc[pno].get_text("dict")
        for blk in d.get("blocks", []):
            for ln in blk.get("lines", []):
                spans = ln.get("spans", [])
                if not spans:
                    continue
                text = "".join(s["text"] for s in spans).strip()
                if not text:
                    continue
                size = round(max(s["size"] for s in spans), 1)
                bold = any(s["flags"] & 16 for s in spans)
                sizes[size] += len(text)
                lines.append((pno, ln["bbox"][1], size, bold, text))
    if not lines:
        return [], {"body_size": 0}

    body = sizes.most_common(1)[0][0]
    cands = []
    for pno, y, size, bold, text in lines:
        if len(text) > 120 or len(text.split()) > 16:
            continue  # headings are short
        big = size >= body * MIN_HEADING_RATIO
        numbered = bool(NUM_RE.match(text))
        if big or (bold and numbered):
            cands.append((pno, y, size, bold, numbered, text))

    if not cands:
        return [], {"body_size": body}

    # level assignment: numbering depth wins; else cluster by font size
    big_sizes = sorted({c[2] for c in cands if c[2] > body}, reverse=True)
    size_level = {s: min(i + 1, 3) for i, s in enumerate(big_sizes)}
    hs = []
    for pno, y, size, bold, numbered, text in cands:
        if numbered:
            depth = text.split()[0].rstrip(".").count(".") + 1
            lvl = min(depth, 3)
        else:
            lvl = size_level.get(size, 3)
        hs.append(Heading(level=lvl, title=text, page=pno, y=y))
    # de-noise: drop repeated running headers (same text on >3 pages)
    freq = Counter(h.title for h in hs)
    hs = [h for h in hs if freq[h.title] <= 3]
    return hs, {"body_size": body, "heading_sizes": big_sizes[:4]}


# ------------------------------------------------------- stage C: segmentation
def shift_wrapper_levels(hs: list[Heading]) -> tuple[list[Heading], bool]:
    """'Part I / Part II' style wrappers: if level-1 entries are few and
    level-2 are plentiful, demote the wrapper level so chapters become
    modules and sections become lessons."""
    l1 = sum(1 for h in hs if h.level == 1)
    l2 = sum(1 for h in hs if h.level == 2)
    if 0 < l1 <= 3 and l2 >= l1 * 3:
        return [Heading(level=max(1, h.level - 1), title=h.title,
                        page=h.page, y=h.y) for h in hs if h.level > 1], True
    return hs, False


def chunk_long_lessons(modules: list[Module]) -> int:
    """Split lessons whose page span implies far more than MAX_LESSON_WORDS;
    word counts are not known yet, so split by page span after extraction
    is wired — here we split post-extraction in run()."""
    return 0  # placeholder; real splitting happens in split_by_words()


def split_by_words(m: Module) -> None:
    """Post-extraction: break overlong lessons into sequential parts at
    paragraph boundaries, preserving figures with their pages."""
    new = []
    for l in m.lessons:
        if l.word_count <= MAX_LESSON_WORDS or len(l.raw_blocks) < 4:
            new.append(l)
            continue
        paras = [b for b in l.raw_blocks if b["type"] == "paragraph"]
        figs = [b for b in l.raw_blocks if b["type"] == "figure_ref"]
        parts, cur, w = [], [], 0
        for p in paras:
            cur.append(p)
            w += len(p["text"].split())
            if w >= MAX_LESSON_WORDS:
                parts.append(cur)
                cur, w = [], 0
        if cur:
            parts.append(cur)
        for k, chunk in enumerate(parts, 1):
            cw = sum(len(p["text"].split()) for p in chunk)
            sub = Lesson(
                title=l.title if len(parts) == 1 else f"{l.title} — part {k}",
                order=0, page_start=l.page_start, page_end=l.page_end,
                word_count=cw)
            sub.raw_blocks = [{"type": "heading", "text": sub.title}] + chunk
            if k == len(parts):  # attach figure refs to the last part
                sub.raw_blocks += figs
                sub.figures = l.figures
            new.append(sub)
    for i, l in enumerate(new, 1):
        l.order = i
    m.lessons = new


EXERCISE_RE = re.compile(r"^(exercises?|problems?|quiz|review questions?)\b", re.I)


def merge_exercise_modules(modules: list[Module]) -> int:
    """Standalone 'Exercises' chapters belong to the chapter before them.
    They also become seeds for the quiz generator (kind='exercises')."""
    merged, out = 0, []
    for m in modules:
        if EXERCISE_RE.match(m.title.strip()) and out:
            prev = out[-1]
            for l in m.lessons:
                l.title = f"Exercises — {prev.title}" if EXERCISE_RE.match(l.title) else l.title
                l.order = len(prev.lessons) + 1
                prev.lessons.append(l)
            prev.page_end = max(prev.page_end, m.page_end)
            merged += 1
        else:
            out.append(m)
    modules[:] = out
    for i, m in enumerate(modules, 1):
        m.order = i
    return merged


def is_front_matter(title: str) -> bool:
    return bool(FRONT_RE.match(title.strip()))


def segment(hs: list[Heading], page_count: int) -> list[Module]:
    hs = [h for h in hs if not is_front_matter(h.title)]
    l1 = [h for h in hs if h.level == 1]
    modules: list[Module] = []

    if len(l1) >= 2:
        for i, h in enumerate(l1):
            end = (l1[i + 1].page - 1) if i + 1 < len(l1) else page_count - 1
            m = Module(title=h.title, order=i + 1, page_start=h.page,
                       page_end=max(h.page, end))
            subs = [s for s in hs if s.level == 2
                    and h.page <= s.page <= m.page_end]
            if subs:
                for j, s in enumerate(subs):
                    send = (subs[j + 1].page) if j + 1 < len(subs) else m.page_end
                    y_end = subs[j + 1].y if (j + 1 < len(subs)
                                              and subs[j + 1].page == s.page) else 1e9
                    m.lessons.append(Lesson(
                        title=s.title, order=j + 1, page_start=s.page,
                        page_end=max(s.page, send), y_start=s.y, y_end=y_end))
            else:  # chapter with no subsections -> single lesson
                m.lessons.append(Lesson(title=h.title, order=1,
                                        page_start=h.page, page_end=m.page_end))
            modules.append(m)
    return modules


def flat_fallback(doc: fitz.Document) -> list[Module]:
    """No usable structure at all: chunk by word budget into one module."""
    words, start, lessons, order = 0, 0, [], 1
    for pno in range(doc.page_count):
        words += len(doc[pno].get_text("text").split())
        if words >= MAX_LESSON_WORDS or pno == doc.page_count - 1:
            lessons.append(Lesson(title=f"Part {order} (pages {start + 1}–{pno + 1})",
                                  order=order, page_start=start, page_end=pno))
            order, start, words = order + 1, pno + 1, 0
    return [Module(title="Generated course", order=1, page_start=0,
                   page_end=doc.page_count - 1, lessons=lessons)]


# --------------------------------------------------- stage D: block extraction
def _is_code_block(blk: dict) -> bool:
    """A block is code if most of its text-by-length comes from monospaced spans."""
    mono = total = 0
    for ln in blk.get("lines", []):
        for s in ln.get("spans", []):
            n = len(s.get("text", ""))
            total += n
            if MONO_FONT_RE.search(s.get("font", "") or ""):
                mono += n
    return total > 0 and mono / total >= CODE_FONT_RATIO


def _block_text(blk: dict) -> str:
    parts = []
    for ln in blk.get("lines", []):
        parts.append("".join(s.get("text", "") for s in ln.get("spans", [])))
    return "\n".join(parts).strip()


def extract_blocks(doc: fitz.Document, lesson: Lesson) -> None:
    paras, code, figures = [], [], []
    for pno in range(lesson.page_start, min(lesson.page_end + 1, doc.page_count)):
        page = doc[pno]
        y0 = lesson.y_start if pno == lesson.page_start else 0
        y1 = lesson.y_end if pno == lesson.page_end else 1e9
        for blk in page.get_text("dict").get("blocks", []):
            by = blk["bbox"][1]
            if not (y0 - 2 <= by <= y1):
                continue
            if blk.get("type") == 1:  # image block
                figures.append({"page": pno + 1,
                                "bbox": [round(v, 1) for v in blk["bbox"]]})
                continue
            text = _block_text(blk)
            if not text:
                continue
            if _is_code_block(blk) and len(text.split()) >= 2:
                # collapse intra-line whitespace runs but keep newlines
                lines = [re.sub(r"[ \t]+", " ", l).rstrip()
                         for l in text.splitlines() if l.strip()]
                code.append({"text": "\n".join(lines), "page": pno + 1})
                continue
            text = re.sub(r"\s+", " ", text)
            if CAPTION_RE.match(text):
                if figures and figures[-1].get("page") == pno + 1:
                    figures[-1]["caption"] = text[:200]
                elif code and code[-1].get("page") == pno + 1:
                    code[-1]["caption"] = text[:200]
                continue
            if len(text.split()) > 3:
                paras.append(text)
    lesson.word_count = sum(len(p.split()) for p in paras)
    lesson.figures = figures
    blocks: list[dict] = [{"type": "heading", "text": lesson.title}]
    blocks.extend({"type": "paragraph", "text": p} for p in paras)
    blocks.extend({"type": "code", **c} for c in code)
    blocks.extend({"type": "figure_ref", **f} for f in figures)
    lesson.raw_blocks = blocks


# ------------------------------------------------------------ stage E: report
def confidence(modules: list[Module], used_toc: bool, probe_info: dict) -> dict:
    flags = []
    if probe_info["likely_scanned"]:
        flags.append("LOW TEXT COVERAGE — likely scanned; OCR stage required")
    if not used_toc:
        flags.append("no embedded outline — structure inferred heuristically; "
                     "show 'Edit structure' before generating")
    all_lessons = [l for m in modules for l in m.lessons]
    tiny = [l for l in all_lessons if l.word_count < MIN_LESSON_WORDS]
    if all_lessons and len(tiny) / len(all_lessons) > 0.15:
        examples = ", ".join(f'“{l.title[:30]}”' for l in tiny[:3])
        flags.append(f"{len(tiny)}/{len(all_lessons)} lessons are very short "
                     f"(< {MIN_LESSON_WORDS} words) and may be table/figure-"
                     f"dominated — review: {examples}")
    score = 0.9 if used_toc else 0.6
    score -= 0.3 if probe_info["likely_scanned"] else 0
    score -= 0.1 if tiny and len(tiny) / max(1, len(all_lessons)) > 0.15 else 0
    return {"score": round(max(0.1, score), 2), "flags": flags}


def run(path: str, max_modules: int | None = None) -> dict:
    _emit(event="stage", stage="probe", status="start")
    doc = fitz.open(path)
    info = probe(doc)
    _emit(event="stage", stage="probe", status="done", stats=info)

    _emit(event="stage", stage="structure", status="start")
    hs = toc_headings(doc)
    used_toc = hs is not None
    extra = {}
    if not used_toc:
        hs, extra = heuristic_headings(doc)
    hs, shifted = shift_wrapper_levels(hs or [])
    if shifted:
        extra["level_shift"] = "thin top level (Part I/II) demoted"
    modules = segment(hs or [], doc.page_count)
    n_merged = merge_exercise_modules(modules)
    if n_merged:
        extra["exercise_modules_merged"] = n_merged
    if not modules:
        modules = flat_fallback(doc)
        used_toc = False
    _emit(event="stage", stage="structure", status="done",
          stats={"modules": len(modules),
                 "lessons": sum(len(m.lessons) for m in modules),
                 "used_toc": used_toc})

    if max_modules:
        modules = modules[:max_modules]

    _emit(event="stage", stage="extract", status="start",
          total=sum(len(m.lessons) for m in modules))
    processed = 0
    total = sum(len(m.lessons) for m in modules)
    for m in modules:
        for l in m.lessons:
            extract_blocks(doc, l)
            processed += 1
            if processed % 5 == 0 or processed == total:
                _emit(event="extract_progress", done=processed, total=total)
        split_by_words(m)
    _emit(event="stage", stage="extract", status="done")

    total_words = sum(l.word_count for m in modules for l in m.lessons)
    out = {
        "source": {"file": path, **info, "structure_from":
                   "embedded_toc" if used_toc else "heuristics", **extra},
        "summary": {
            "modules": len(modules),
            "lessons": sum(len(m.lessons) for m in modules),
            "figures": sum(len(l.figures) for m in modules for l in m.lessons),
            "words": total_words,
            "est_hours": round(total_words / WPM / 60, 1),
        },
        "confidence": confidence(modules, used_toc, info),
        "modules": [{
            "title": m.title, "order": m.order,
            "page_start": m.page_start + 1, "page_end": m.page_end + 1,
            "lessons": [{
                "title": l.title, "order": l.order,
                "page_start": l.page_start + 1, "page_end": l.page_end + 1,
                "word_count": l.word_count,
                "est_minutes": max(1, round(l.word_count / WPM)),
                "n_figures": len(l.figures),
                "raw_blocks": l.raw_blocks,
            } for l in m.lessons],
        } for m in modules],
    }
    doc.close()
    return out


if __name__ == "__main__":
    src = sys.argv[1]
    res = run(src)
    dst = sys.argv[2] if len(sys.argv) > 2 else "course.json"
    with open(dst, "w") as f:
        json.dump(res, f, indent=1)
    s, c = res["summary"], res["confidence"]
    print(f"\n=== {src} ===")
    print(f"structure: {res['source']['structure_from']} | "
          f"pages {res['source']['pages']} | coverage {res['source']['text_coverage']}")
    print(f"modules {s['modules']} | lessons {s['lessons']} | "
          f"figures {s['figures']} | {s['words']:,} words ≈ {s['est_hours']} h")
    print(f"confidence {c['score']}  flags: {c['flags'] or 'none'}")
    for m in res["modules"][:8]:
        print(f"  {m['order']:>2}. {m['title'][:58]:<58} "
              f"p.{m['page_start']}–{m['page_end']}  ({len(m['lessons'])} lessons)")
        for l in m["lessons"][:3]:
            print(f"        - {l['title'][:52]:<52} {l['word_count']:>5} w "
                  f"~{l['est_minutes']} min  fig:{l['n_figures']}")
        if len(m["lessons"]) > 3:
            print(f"        … +{len(m['lessons']) - 3} more")
