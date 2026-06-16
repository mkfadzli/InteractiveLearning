import Link from "next/link";
import { Upload } from "lucide-react";
import TopBar from "@/components/TopBar";
import CourseLibraryGrid from "@/components/CourseLibraryGrid";
import { listUploadedCourses } from "@/lib/library";

export const dynamic = "force-dynamic"; // always read latest jobs from disk
export const metadata = { title: "Library — InteractiveLearning" };

export default function LibraryPage() {
  const courses = listUploadedCourses();

  return (
    <div className="mx-auto min-h-dvh max-w-[1180px] bg-surface md:my-6 md:rounded-3xl md:border md:border-border md:shadow-lift">
      <TopBar />

      <main className="px-6 py-7 md:px-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[27px] font-bold tracking-tight">Welcome back</h1>
            <p className="mt-0.5 text-[15px] text-text-2">
              {courses.length === 0
                ? "Upload a PDF to start your first course."
                : `${courses.length} course${courses.length === 1 ? "" : "s"} in your library, stored on this device.`}
            </p>
          </div>
          <Link
            href="/upload"
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm2 bg-primary px-5 py-2.5 text-[14.5px] font-semibold text-on-primary shadow-[0_4px_14px_rgba(15,177,168,.3)] transition-all duration-200 ease-brand hover:brightness-110 active:scale-[.97]"
          >
            <Upload size={15} /> Upload PDF
          </Link>
        </header>

        <CourseLibraryGrid courses={courses} />
      </main>
    </div>
  );
}
