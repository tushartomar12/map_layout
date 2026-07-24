import { chromium } from "playwright";

const expectedCount = 60;
const phase2Message = "This plot is Under Development";
const baseUrl = process.env.MAP_URL ?? "http://localhost:3000";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3500);

const info = await page.evaluate(() => {
  const phase2 = [...document.querySelectorAll('#plots polygon[fill="url(#fill-under-development)"]')];
  const amenity = document.querySelector(
    '#landmarks polygon[fill="url(#fill-amenity-area)"]',
  );
  const bar = document.querySelector('[aria-label="Plot status legend"]');
  return {
    phase2Count: phase2.length,
    hasAmenity: !!amenity,
    hasStatusBar: !!bar,
  };
});

console.log("phase2 plots on map:", info.phase2Count, "expected:", expectedCount);
console.log("amenity landmark:", info.hasAmenity);
console.log("status bar:", info.hasStatusBar);

await page.locator('input[placeholder="Type plot id"]').first().fill("70");
await page.waitForTimeout(500);
await page.evaluate(() => {
  const poly = [...document.querySelectorAll("#plots polygon")].find(
    (p) => p.getAttribute("fill") === "url(#fill-under-development)",
  );
  poly?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await page.waitForTimeout(600);

const popupChecks = await page.evaluate((msg) => {
  const dialog = document.querySelector('[role="dialog"]');
  const text = dialog?.textContent ?? "";
  return {
    hasDialog: !!dialog,
    hasPhase2Msg: text.includes(msg),
    hasEnquire: text.includes("Enquire Now"),
    hasPrice: /PRICE/i.test(text),
    hasPhase2Pill: text.includes("UNDER DEVELOPMENT"),
  };
}, phase2Message);

console.log("popup:", popupChecks);

await browser.close();

const ok =
  info.phase2Count === expectedCount &&
  info.hasAmenity &&
  popupChecks.hasDialog &&
  popupChecks.hasPhase2Msg &&
  popupChecks.hasPhase2Pill &&
  !popupChecks.hasEnquire &&
  !popupChecks.hasPrice;

process.exit(ok ? 0 : 1);
