"use client";

import { useActionState } from "react";
import { importStaticProjects, type ActionResult } from "@/app/admin/actions";
import { Banner, SubmitButton, callAction } from "./ui";

/**
 * Seeds the projects table from lib/work.ts on first run. Safe to press twice:
 * the action skips slugs that already exist and inserts with ON CONFLICT DO
 * NOTHING, and the button disables itself while the first press is running.
 */
export default function ImportStaticButton({ count }: { count: number }) {
  const [result, action] = useActionState<ActionResult | null, FormData>(
    () => callAction(importStaticProjects),
    null
  );

  return (
    <form action={action} className="space-y-3">
      <Banner result={result} />
      <SubmitButton pendingLabel="Importing…">
        Import the {count} existing project{count === 1 ? "" : "s"}
      </SubmitButton>
    </form>
  );
}
