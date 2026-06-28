"use client";

import { useEffect } from "react";
import Button from "@/components/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="relative flex min-h-[82svh] flex-col items-center justify-center px-6 text-center">
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-slatey">
        Something broke
      </span>
      <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight md:text-7xl">
        An unexpected <span className="text-accent">error.</span>
      </h1>
      <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-ink/60">
        Sorry — something went wrong on our end. Try again, or head back home.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink-900"
        >
          Try again
        </button>
        <Button href="/" variant="outline">
          Back home
        </Button>
      </div>
    </section>
  );
}
