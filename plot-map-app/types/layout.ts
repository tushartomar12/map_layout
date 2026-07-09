export type LayoutFeatureType = "road" | "water" | "park";

export interface LayoutFeature {
  id: string;
  type: LayoutFeatureType;
  points: [number, number][];
}
