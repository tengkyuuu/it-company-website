import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3100";
const routes = ["/", "/services", "/about", "/location"];
const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

mkdirSync(".verify", { recursive: true });
const browser = await chromium.launch();
let totalErrors = 0;

const shot = async (page, path, size) => {
  try {
    await page.evaluate(() => {
      document
        .querySelectorAll(".cursor-dot,.cursor-ring")
        .forEach((e) => e.remove());
      // blur/backdrop/blend compositing is what stalls the headless software
      // renderer on tall pages — neutralise it just for the capture.
      const s = document.createElement("style");
      s.textContent =
        "*{filter:none !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;mix-blend-mode:normal !important}";
      document.head.appendChild(s);
    });
    await page.waitForTimeout(120);
    await page.screenshot({
      path,
      timeout: 40000,
      clip: { x: 0, y: 0, width: size.width, height: size.height },
    });
  } catch (e) {
    console.log("  ! screenshot failed:", path, e.message.split("\n")[0]);
  }
};

// One shot of the preloader itself (desktop, no skip).
{
  const ctx = await browser.newContext({ viewport: viewports.desktop });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await shot(page, ".verify/preloader.png", viewports.desktop);
  await ctx.close();
}

for (const [vp, size] of Object.entries(viewports)) {
  const ctx = await browser.newContext({ viewport: size });
  // skip the preloader for stable captures
  await ctx.addInitScript(() => {
    try {
      window.sessionStorage.setItem("mykt-preloaded", "1");
    } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("response", (r) => {
    if (r.status() >= 400)
      errors.push(`${r.status()} ${r.url().replace(BASE, "")}`);
  });

  for (const r of routes) {
    errors.length = 0;
    await page.goto(BASE + r, { waitUntil: "load" });
    await page.waitForTimeout(1600);
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
    }));
    const overflow = m.sw > m.iw + 2;
    const tag = r === "/" ? "home" : r.replaceAll("/", "");
    await shot(page, `.verify/${vp}-${tag}.png`, size);
    totalErrors += errors.length;
    console.log(
      `${vp.padEnd(7)} ${r.padEnd(11)} overflow=${overflow ? "YES " + m.sw + ">" + m.iw : "no"} errors=${errors.length}` +
        (errors.length ? " :: " + errors.slice(0, 4).join(" | ") : "")
    );
  }

  // scrolled landing shots (drive with the wheel so Lenis + ScrollTrigger fire)
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.waitForTimeout(1600);
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, size.height * 0.9);
    await page.waitForTimeout(600);
  }
  await shot(page, `.verify/${vp}-home-mid.png`, size);
  for (let i = 0; i < 9; i++) {
    await page.mouse.wheel(0, size.height * 0.9);
    await page.waitForTimeout(550);
  }
  await shot(page, `.verify/${vp}-home-late.png`, size);

  await ctx.close();
}

await browser.close();
console.log("TOTAL console errors:", totalErrors);
