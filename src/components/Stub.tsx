import Link from "next/link";
import { ArrowLeft, Hammer } from "lucide-react";
import TopBar from "./TopBar";

/** Placeholder for routes not yet implemented — see interactivelearning-mockups.html */
export default function Stub({ title, mockupRef }: { title: string; mockupRef: string }) {
  return (
    <div className="mx-auto min-h-dvh max-w-[1180px] bg-surface md:my-6 md:rounded-3xl md:border md:border-border md:shadow-lift">
      <TopBar />
      <div className="grid place-items-center px-6 py-24 text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-teal-soft text-primary">
          <Hammer size={24} />
        </span>
        <h1 className="text-[22px] font-bold">{title}</h1>
        <p className="mt-1 max-w-[48ch] text-[14px] text-text-2">
          This screen is designed but not built yet — see <b>{mockupRef}</b> in
          interactivelearning-mockups.html for the approved high-fidelity design.
        </p>
        <Link
          href="/library"
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-sm2 border border-border px-5 py-2.5 text-[14.5px] font-semibold transition-colors hover:bg-surface-2"
        >
          <ArrowLeft size={15} /> Back to library
        </Link>
      </div>
    </div>
  );
}
