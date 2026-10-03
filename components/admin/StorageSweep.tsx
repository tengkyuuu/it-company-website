"use client";

import { useState } from "react";
import {
  cleanUpUnusedUploads,
  scanUnusedUploads,
  type SweepScanResponse,
} from "@/app/admin/history-actions";
import { Banner } from "./ui";
import { Spinner, Thumb, safely, smallButton } from "./HistoryParts";

/**
 * The "unused images" sweep on /admin/settings. Saving and deleting already
 * clean up the images they drop — but only when nothing else uses them, and a
 * stored revision counts. Revisions are pruned in the database (20 per item),
 * and an image whose last reference was a pruned revision is never revisited.
 * This finds those: Storage objects nothing references, uploaded more than a
 * day ago. Scan is read-only; Clean up re-checks on the server before it
 * deletes anything.
 */

const SHOWN = 48;

type Scan = Extract<SweepScanResponse, { ok: true }>;

export default function StorageSweep() {
  const [scan, setScan] = useState<Scan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const runScan = async () => {
    setScanning(true);
    setResult(null);
    setConfirming(false);
    const r = (await safely(() => scanUnusedUploads())) as SweepScanResponse;
    setScanning(false);
    if (r.ok) setScan(r);
    else {
      setScan(null);
      setResult(r);
    }
  };

  const cleanUp = async () => {
    if (!scan) return;
    setCleaning(true);
    const r = await safely(() => cleanUpUnusedUploads(scan.items.map((i) => i.path)));
    setCleaning(false);
    setConfirming(false);
    setResult(r);
    if (r.ok) setScan(null);
  };

  const count = scan?.items.length ?? 0;

  return (
    <section id="storage" className="scroll-mt-24 rounded-2xl border border-mist/70 bg-surface p-6 md:p-7">
      <h2 className="font-display text-lg font-semibold tracking-tight">Unused images</h2>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink/55">
        Uploaded screenshots and covers that nothing uses any more — not a project, product or
        post, and not any saved version in History. Images uploaded in the last 24 hours are left
        alone, in case someone is still adding them.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" className={smallButton} disabled={scanning || cleaning} onClick={() => void runScan()}>
          {scanning && <Spinner />}
          {scanning ? "Scanning…" : scan ? "Scan again" : "Scan for unused images"}
        </button>
      </div>

      {result && <Banner result={result} className="mt-4" />}

      {scan && (
        <div className="mt-5">
          {count === 0 ? (
            <p className="text-sm text-ink/60">
              Nothing to clean up — every one of the {scan.scanned} stored image
              {scan.scanned === 1 ? " is" : "s is"} in use
              {scan.recent > 0 ? `, or was uploaded in the last day (${scan.recent})` : ""}.
            </p>
          ) : (
            <>
              <p className="text-sm">
                <span className="font-medium">
                  {count} unused image{count === 1 ? "" : "s"}
                </span>
                <span className="text-ink/55">
                  {" "}
                  · {scan.totalSize} · of {scan.scanned} stored
                  {scan.recent > 0 ? ` · ${scan.recent} newer than a day skipped` : ""}
                </span>
              </p>
              {scan.truncated && (
                <p className="mt-1 text-xs text-ink/55">
                  The bucket is large — only the first part was scanned. Clean up, then scan again.
                </p>
              )}

              <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {scan.items.slice(0, SHOWN).map((item) => (
                  <li key={item.path} className="min-w-0">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40"
                      title={`${item.path} · ${item.size} · uploaded ${item.uploaded}`}
                    >
                      <Thumb url={item.url} label={item.path} />
                    </a>
                    <p className="mt-1 truncate font-mono text-[10px] text-slatey">{item.size}</p>
                  </li>
                ))}
              </ul>
              {count > SHOWN && (
                <p className="mt-2 text-xs text-ink/55">+{count - SHOWN} more not shown.</p>
              )}

              <div className="mt-5">
                {!confirming ? (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-red-500/40 px-4 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-to/40 dark:text-red-400"
                  >
                    Clean up {count} image{count === 1 ? "" : "s"}
                  </button>
                ) : (
                  <div
                    role="group"
                    aria-label="Confirm clean-up"
                    className="rounded-xl border border-red-500/35 bg-red-500/[0.06] p-4 text-sm"
                  >
                    <p className="font-medium text-ink">
                      Delete {count} image{count === 1 ? "" : "s"} ({scan.totalSize}) from Storage?
                    </p>
                    <p className="mt-1 leading-relaxed text-ink/65">
                      This can’t be undone. The server checks each one again first and skips
                      anything that has started being used.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={cleaning}
                        onClick={() => void cleanUp()}
                        className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cleaning && <Spinner />}
                        {cleaning ? "Deleting…" : "Delete them"}
                      </button>
                      <button
                        type="button"
                        className={smallButton}
                        disabled={cleaning}
                        onClick={() => setConfirming(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
