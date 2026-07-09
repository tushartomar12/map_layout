import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.locator("#plan").scrollIntoViewIfNeeded();
await page.waitForTimeout(600);

const info = await page.evaluate(() => {
  const svg = document.querySelector('svg[aria-label="Plot map"]');
  const texts = [...svg.querySelectorAll("#labels text")];
  const pick = ["43", "96", "4", "31", "75", "110", "122", "154", "164", "175", "8", "56"];
  const byId = Object.fromEntries(
    texts.map((t) => {
      const box = t.getBBox();
      const r = t.getBoundingClientRect();
      return [
        t.textContent,
        {
          fontSize: t.getAttribute("font-size"),
          svgW: Number(box.width.toFixed(2)),
          cssH: Number(r.height.toFixed(2)),
          cssW: Number(r.width.toFixed(2)),
        },
      ];
    }),
  );
  return {
    count: texts.length,
    anyEllipsis: texts.some(
      (t) => (t.textContent || "").includes("…") || t.textContent === "...",
    ),
    sample: pick.map((id) => ({ id, ...(byId[id] || { missing: true }) })),
  };
});

console.log(JSON.stringify(info, null, 2));
await page.locator("#plan").screenshot({ path: "verify-labels-fit.png" });
await page.getByLabel("Zoom in").click();
await page.getByLabel("Zoom in").click();
await page.waitForTimeout(400);
await page.locator("#plan").screenshot({ path: "verify-labels-zoom.png" });
await browser.close();
