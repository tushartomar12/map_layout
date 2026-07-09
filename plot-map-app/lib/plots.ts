import rawPlots from "@/data/plots.master.json";
import type { Plot, PlotCategory, PlotStatus } from "@/types/plot";

type RawPlot = {
  id: string;
  category: PlotCategory;
  points: number[][];
  sellable: boolean;
  edgeLengths: number[] | null;
  areaSqM: number | null;
  zone: string | null;
  typeOfDevelopment: string | null;
  description?: string | null;
  status: string | null;
  price: number | null;
  dataComplete: boolean;
};

const ALLOWED_STATUS = new Set<PlotStatus>([
  "available",
  "sold",
  "under-development",
]);

function normalizeStatus(status: string | null): PlotStatus {
  if (status && ALLOWED_STATUS.has(status as PlotStatus)) {
    return status as PlotStatus;
  }
  return "under-development";
}

function normalizePlot(raw: RawPlot): Plot {
  return {
    id: raw.id,
    category: raw.category,
    points: raw.points.map(([x, y]) => [x, y] as [number, number]),
    sellable: raw.sellable,
    edgeLengths: raw.edgeLengths,
    areaSqM: raw.areaSqM,
    zone: raw.zone ?? "",
    typeOfDevelopment: raw.typeOfDevelopment ?? "",
    description: raw.description ?? "",
    status: normalizeStatus(raw.status),
    price: raw.price,
    dataComplete: raw.dataComplete,
  };
}

export function getPlots(): Plot[] {
  return (rawPlots as RawPlot[]).map(normalizePlot);
}

export function getPlotSummary(plots: Plot[]) {
  const sellable = plots.filter((plot) => plot.category === "plot" && plot.sellable);
  const available = sellable.filter((plot) => plot.status === "available").length;
  const sold = sellable.filter((plot) => plot.status === "sold").length;
  return { total: plots.length, sellable: sellable.length, available, sold };
}
