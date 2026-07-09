# Plot Map Layout

Interactive SVG-based plot map with roads, landmarks, grass texture, filters, and plot detail popups.

## Project structure

- `plot-map-app/` — Next.js app for the interactive map
- `plot-digitization/` — source SVG assets, generated JSON, and preview tools
- `parse_svg_to_json.py` — converts `full-layout.svg` into layout JSON
- `merge_plot_data.py` — merges layout geometry with plot business data

## Run locally

```bash
cd plot-map-app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Regenerate map data

```bash
python parse_svg_to_json.py
python merge_plot_data.py
```

Then copy `plot-digitization/data/plots.master.v2.json` into `plot-map-app/data/plots.master.json`.

## Production build

```bash
cd plot-map-app
npm run build
npm run start
```
