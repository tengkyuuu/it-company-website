import Button from "@/components/Button";

export default function NotFound() {
  return (
    <section className="relative flex min-h-[82svh] flex-col items-center justify-center px-6 text-center">
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-slatey">
        Error 404
      </span>
      <h1 className="mt-6 font-display text-6xl font-semibold tracking-tight md:text-8xl">
        Page not <span className="text-accent">found.</span>
      </h1>
      <p className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-ink/60">
        The page you’re looking for doesn’t exist or may have moved. Let’s get
        you back on track.
      </p>
      <div className="mt-9">
        <Button href="/" arrow>
          Back to home
        </Button>
      </div>
    </section>
  );
}
