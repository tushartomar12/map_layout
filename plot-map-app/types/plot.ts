export type PlotStatus = "available" | "sold" | "under-development";

export type PlotCategory = "plot" | "road" | "landmark";

export interface Plot {
  id: string;
  category: PlotCategory;
  points: [number, number][];
  sellable: boolean;
  edgeLengths: number[] | null;
  areaSqM: number | null;
  zone: string;
  typeOfDevelopment: string;
  description?: string;
  status: PlotStatus;
  price: number | null;
  dataComplete: boolean;
}
