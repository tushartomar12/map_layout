import { readFile } from "node:fs/promises";
import path from "node:path";

const IMAGE_PATH = path.join(
  process.cwd(),
  "..",
  "plot-digitization",
  "assets",
  "grass.png",
);

export async function GET() {
  const image = await readFile(IMAGE_PATH);
  return new Response(image, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
