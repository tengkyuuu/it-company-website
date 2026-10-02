"use client";

import { useEffect } from "react";
import Button from "@/components/Button";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, href } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="relative flex min-h-[82svh] flex-col items-center justify-center px-6 text-center">
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-slatey">
        {t("error.eyebrow")}
      </span>
      <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight md:text-7xl">
        {t("error.titleLead")} <span className="text-accent">{t("error.titleAccent")}</span>
      </h1>
      <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-ink/60">
        {t("error.body")}
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink-900"
        >
          {t("error.retry")}
        </button>
        <Button href={href("/")} variant="outline">
          {t("error.home")}
        </Button>
      </div>
    </section>
  );
}
