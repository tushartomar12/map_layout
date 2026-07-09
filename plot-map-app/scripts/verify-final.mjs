import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.locator("#plan").scrollIntoViewIfNeeded();
await page.waitForTimeout(600);

const info = await page.evaluate(() => {
  const svg = document.querySelector('svg[aria-label="Plot map"]');
  const texts = [...svg.querySelectorAll("#labels text")];
  const pick = ["43", "96", "4", "31", "75", "110", "122", "154", "164", "175"];
  return {
    count: texts.length,
    anyEllipsis: texts.some(
      (t) => (t.textContent || "").includes("…") || t.textContent === "...",
    ),
    ids: pick.map((id) => ({
      id,
      text: texts.find((t) => t.textContent === id)?.textContent ?? null,
      fontSize: texts.find((t) => t.textContent === id)?.getAttribute("font-size"),
      cssH: Number(
        (texts.find((t) => t.textContent === id)?.getBoundingClientRect().height || 0).toFixed(2),
      ),
    })),
    hasGrass: !!svg.querySelector("#grass-texture, [fill='url(#grass-texture)']") ||
      [...svg.querySelectorAll("rect")].some((r) => r.getAttribute("fill") === "url(#grass-texture)"),
    hasAsphalt: [...svg.querySelectorAll("#roads rect")].some(
      (r) => r.getAttribute("fill") === "url(#asphalt)",
    ),
    dashedLines: svg.querySelectorAll("#roads line").length,
  };
});

console.log(JSON.stringify(info, null, 2));
await page.locator("#plan").screenshot({ path: "final-fit.png" });
await page.getByLabel("Zoom in").click();
await page.getByLabel("Zoom in").click();
await page.waitForTimeout(400);
await page.locator("#plan").screenshot({ path: "final-zoom.png" });
await browser.close();
