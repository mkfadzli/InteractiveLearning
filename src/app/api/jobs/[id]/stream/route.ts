import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { jobDir, jobPdf } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PYTHON = process.env.IL_PYTHON ?? "python3";
const SCRIPT = path.join(process.cwd(), "scripts", "pipeline.py");

/**
 * Server-Sent Events stream. Spawns the Python pipeline as a subprocess
 * and forwards each JSON-lines event from its stderr as one SSE message.
 * The stream closes when the subprocess exits or the client disconnects.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!existsSync(jobPdf(id))) {
    return new Response(`event: error\ndata: ${JSON.stringify({ message: "job not found" })}\n\n`, {
      status: 404,
      headers: { "content-type": "text/event-stream" },
    });
  }
  if (!existsSync(SCRIPT)) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: "pipeline script missing — see scripts/pipeline.py" })}\n\n`,
      { status: 500, headers: { "content-type": "text/event-stream" } },
    );
  }

  const enrich = process.env.ANTHROPIC_API_KEY ? ["--enrich", "--limit", "3"] : [];
  const pythonBin = process.env.IL_PYTHON ?? PYTHON;
  const args = [SCRIPT, "--pdf", jobPdf(id), "--out", jobDir(id), ...enrich];
  console.log(`[stream:${id}] spawning ${pythonBin} ${args.join(" ")}`);
  const child = spawn(
    pythonBin,
    args,
    { stdio: ["ignore", "pipe", "pipe"], env: process.env },
  );

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      function send(eventName: string, data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      }

      send("hello", { jobId: id });

      let buf = "";
      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        buf += text;
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const obj = JSON.parse(line);
            send("progress", obj);
          } catch {
            // Non-JSON stderr — Python warning, traceback, missing dep, etc.
            // Surface to the server console AND the client so it's never invisible.
            console.warn(`[stream:${id}] stderr (non-JSON): ${line}`);
            send("note", { line });
          }
        }
      });

      // Drain stdout to keep the pipe buffer flowing (nothing expected here).
      child.stdout.on("data", () => {});

      child.on("error", (err) => {
        console.error(`[stream:${id}] spawn failed:`, err);
        send("progress", { event: "error",
          message: `Could not start Python: ${err.message}. ` +
                   `Make sure python3 is on PATH and pymupdf is installed, ` +
                   `or set IL_PYTHON to the full path of your Python binary.` });
        try { controller.close(); } catch {}
        closed = true;
      });
      child.on("close", (code, signal) => {
        console.log(`[stream:${id}] subprocess exited code=${code} signal=${signal}`);
        if (code !== 0) {
          send("progress", { event: "error",
            message: `Python pipeline exited with code ${code}. ` +
                     `See server logs for stderr.` });
        }
        send("close", { exitCode: code });
        try { controller.close(); } catch {}
        closed = true;
      });
    },
    cancel() {
      if (!child.killed) child.kill("SIGTERM");
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
