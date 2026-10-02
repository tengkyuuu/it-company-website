/**
 * Shown inside the admin shell while a panel page's queries run. Deliberately
 * shape-only (a heading and a few cards) so it reads as "loading" on every
 * page without pretending to know the layout of the one being opened.
 */
export default function AdminLoading() {
  const bar = "rounded-full bg-ink/[0.07] motion-safe:animate-pulse";
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2.5">
        <div className={`${bar} h-7 w-48`} />
        <div className={`${bar} h-4 w-72 max-w-full`} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-mist/70 bg-surface p-6 md:p-7">
          <div className={`${bar} h-5 w-40`} />
          <div className={`${bar} mt-4 h-3.5 w-full`} />
          <div className={`${bar} mt-2.5 h-3.5 w-5/6`} />
          <div className={`${bar} mt-2.5 h-3.5 w-2/3`} />
        </div>
      ))}
    </div>
  );
}
