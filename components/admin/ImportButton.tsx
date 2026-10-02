"use client";

import { useActionState } from "react";
import {
  importStaticServices,
  importStaticTeam,
  type ActionResult,
} from "@/app/admin/content-actions";
import { Banner, SubmitButton, callAction } from "./ui";

/**
 * Seeds a table from the checked-in static content, so a fresh database doesn't
 * start empty and force someone to retype what's already on the site.
 *
 * `kind` rather than taking the action as a prop: server actions *can* be passed
 * to a client component, but naming them here keeps the wiring obvious and means
 * the two labels can't drift from the two actions. `count` comes from the server
 * page so the static lists aren't bundled into the client just for a label.
 */
const VARIANTS = {
  services: {
    run: importStaticServices,
    label: (n: number) => `Import the ${n} built-in services`,
    pending: "Importing services…",
  },
  team: {
    run: importStaticTeam,
    label: (n: number) => `Import the current team (${n})`,
    pending: "Importing team…",
  },
} as const;

export default function ImportButton({
  kind,
  count,
}: {
  kind: keyof typeof VARIANTS;
  count: number;
}) {
  const variant = VARIANTS[kind];
  const [result, action] = useActionState<ActionResult | null, FormData>(
    () => callAction(variant.run),
    null
  );

  return (
    <form action={action} className="space-y-3">
      <Banner result={result} />
      <SubmitButton pendingLabel={variant.pending}>{variant.label(count)}</SubmitButton>
    </form>
  );
}
