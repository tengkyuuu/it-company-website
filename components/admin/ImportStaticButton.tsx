"use client";

import { useActionState } from "react";
import { importStaticProjects, type ActionResult } from "@/app/admin/actions";
import { Banner, SubmitButton } from "./ui";

/** Seeds the projects table from lib/work.ts on first run. */
export default function ImportStaticButton() {
  const [result, action] = useActionState<ActionResult | null, FormData>(
    async () => importStaticProjects(),
    null
  );

  return (
    <form action={action} className="space-y-3">
      {result && <Banner result={result} />}
      <SubmitButton pendingLabel="Importing…">
        Import the 5 existing projects
      </SubmitButton>
    </form>
  );
}
