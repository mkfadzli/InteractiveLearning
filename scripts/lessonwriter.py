#!/usr/bin/env python3
"""
lessonwriter — stage 2 of the InteractiveLearning pipeline.
Takes course.json from pdf2course.py and enriches each lesson:
raw paragraphs -> story pages (heading/paragraph/callout/key_idea blocks)
plus an MCQ knowledge check with explanations. Output is ready for the
lesson player's blocks renderer.

Usage:
  export ANTHROPIC_API_KEY=sk-ant-...
  python3 lessonwriter.py course.json enriched.json [--limit 3] [--model M]
  python3 lessonwriter.py course.json enriched.json --mock   # offline test

Design rules enforced by the prompt:
  * faithful rewrite — no invented facts, numbers, or claims
  * story-first: concrete hook, plain language, short paragraphs
  * math/code-dense source text is summarized conceptually, never mangled
  * strict JSON output, schema-validated; one retry on invalid JSON
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request

API_URL = "https://api.anthropic.com/v1/messages"
DEFAULT_MODEL = "claude-sonnet-4-20250514"
MAX_SOURCE_WORDS = 2200   # cap source text per lesson (chunked upstream anyway)

SYSTEM = """You convert extracted textbook/document sections into short, engaging interactive lessons.

HARD RULES
1. FAITHFUL: use only facts present in the source text. Never invent numbers, names, examples-as-fact, or claims. You may add a relatable framing/hook, clearly as framing.
2. CLEAR: plain language, short paragraphs (2-4 sentences), define jargon on first use.
3. If the source is math/equation-heavy, explain the concepts in words; never reproduce garbled equation text.
4. OUTPUT: respond with ONLY a JSON object, no markdown fences, no preamble.

JSON SCHEMA
{
 "title": str,                       // catchy but accurate lesson title
 "est_minutes": int,
 "pages": [                          // 2-4 story pages
   { "blocks": [
       {"type":"heading","text":str},
       {"type":"paragraph","text":str},
       {"type":"callout","title":str,"text":str},   // max 1 per page, the "aha"
       {"type":"key_idea","text":str}               // one-line takeaway
   ]}
 ],
 "quiz": { "questions": [            // 2-4 questions
   { "prompt": str,
     "options": [str,str,str,str],
     "correctIndex": int,            // 0-3
     "explanation": str }            // cites the relevant page idea
 ]}
}"""


def build_user_prompt(lesson_title: str, paragraphs: list[str]) -> str:
    text, words = [], 0
    for p in paragraphs:
        w = len(p.split())
        if words + w > MAX_SOURCE_WORDS:
            break
        text.append(p)
        words += w
    return (f"Section title: {lesson_title}\n\nSource text:\n" +
            "\n\n".join(text) +
            "\n\nConvert this section into a lesson per the schema.")


# --------------------------------------------------------------- API plumbing
def call_claude(prompt: str, model: str, api_key: str) -> str:
    body = json.dumps({
        "model": model,
        "max_tokens": 3000,
        "system": SYSTEM,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(API_URL, data=body, headers={
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    })
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read())
    return "".join(b.get("text", "") for b in data.get("content", [])
                   if b.get("type") == "text")


def parse_and_validate(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        raw = raw[raw.find("{"):]
    obj = json.loads(raw[raw.find("{"): raw.rfind("}") + 1])
    assert isinstance(obj.get("title"), str) and obj["title"]
    pages = obj.get("pages")
    assert isinstance(pages, list) and 1 <= len(pages) <= 6
    for pg in pages:
        for b in pg["blocks"]:
            assert b["type"] in ("heading", "paragraph", "callout",
                                 "key_idea", "figure_ref")
    qs = obj.get("quiz", {}).get("questions", [])
    assert 1 <= len(qs) <= 6
    for q in qs:
        assert len(q["options"]) == 4 and 0 <= int(q["correctIndex"]) <= 3
        assert q.get("explanation")
    return obj


def mock_lesson(title: str) -> dict:
    return {"title": title, "est_minutes": 3, "pages": [{"blocks": [
        {"type": "heading", "text": title},
        {"type": "paragraph", "text": "Mock story paragraph (offline test)."},
        {"type": "callout", "title": "Why it matters",
         "text": "Mock callout."},
        {"type": "key_idea", "text": "Mock key idea."}]}],
        "quiz": {"questions": [{
            "prompt": "Mock question?",
            "options": ["A", "B", "C", "D"], "correctIndex": 1,
            "explanation": "Mock explanation."}]}}


# ------------------------------------------------------------------- pipeline
def enrich(course: dict, model: str, api_key: str | None,
           limit: int | None, mock: bool) -> dict:
    done = 0
    for m in course["modules"]:
        for l in m["lessons"]:
            if limit and done >= limit:
                return course
            paras = [b["text"] for b in l.get("raw_blocks", [])
                     if b.get("type") == "paragraph"]
            if not paras:
                continue
            label = f"[{m['order']}.{l['order']}] {l['title'][:48]}"
            if mock:
                l["story"] = mock_lesson(l["title"])
            else:
                prompt = build_user_prompt(l["title"], paras)
                for attempt in (1, 2):
                    try:
                        raw = call_claude(prompt, model, api_key)
                        l["story"] = parse_and_validate(raw)
                        break
                    except Exception as e:  # noqa: BLE001
                        if attempt == 2:
                            l["story_error"] = str(e)[:200]
                            print(f"  FAIL {label}: {e}", file=sys.stderr)
                        else:
                            time.sleep(2)
            # keep figure refs alongside the generated story
            l["story_figures"] = l.get("figures", [])
            l.pop("raw_blocks", None)  # source no longer needed downstream
            done += 1
            print(f"  ok   {label}")
    return course


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--limit", type=int, default=None,
                    help="enrich only the first N lessons (cost control)")
    ap.add_argument("--mock", action="store_true",
                    help="offline: insert placeholder stories, no API calls")
    args = ap.parse_args()

    key = os.environ.get("ANTHROPIC_API_KEY")
    if not args.mock and not key:
        sys.exit("Set ANTHROPIC_API_KEY or use --mock")

    course = json.load(open(args.src))
    course = enrich(course, args.model, key, args.limit, args.mock)
    json.dump(course, open(args.dst, "w"), indent=1)
    n = sum(1 for m in course["modules"] for l in m["lessons"] if "story" in l)
    print(f"\nwrote {args.dst} — {n} lessons enriched")


if __name__ == "__main__":
    main()
