# Tarun Plantation Layout

Interactive plot layout map for Tarun Plantation, featuring real-time plot status, filtering, and detailed SVG-based interactive map visualization.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Map/SVG**: React-use-gesture for interactions, SVG textPath for labels

## Running Locally

1. Clone the repository.
2. Navigate to the web app directory:
   ``bash
   cd plot-map-app
   ``
3. Install dependencies:
   ``bash
   npm install
   ``
4. Set up environment variables by copying .env.example to .env.local and filling in the required credentials.
5. Start the development server:
   ``bash
   npm run dev
   ``
6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Data Processing Pipeline

The /plot-digitization folder contains the original data-processing pipeline used to build the core plots.master.json dataset from the original layout traces (PDFs, Excel files, SVG vectors). 

It includes:
- /source-docs/: Original reference documents.
- /scripts/: Python scripts (parse_svg_to_json.py, merge_plot_data.py, etc.) used to extract geometry from SVGs, match with Excel dimensions, compute facing roads, and generate the final JSON.

This folder is preserved as an archive in case the data needs to be re-run, corrected, or extended with new plot arrivals in the future.
