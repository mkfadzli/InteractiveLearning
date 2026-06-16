import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { jobDir, jobPdf, newJobId } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (!/\.pdf$/i.test(file.name)) {
    return NextResponse.json({ error: "only .pdf files are accepted" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 413 },
    );
  }

  const id = newJobId();
  const dir = jobDir(id);
  await fs.mkdir(dir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(jobPdf(id), bytes);
  await fs.writeFile(
    `${dir}/meta.json`,
    JSON.stringify({ originalName: file.name, size: file.size, uploadedAt: Date.now() }),
  );

  return NextResponse.json({ jobId: id, name: file.name, size: file.size });
}
