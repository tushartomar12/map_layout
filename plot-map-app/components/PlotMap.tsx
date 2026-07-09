"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Baby, Building2, Waves } from "lucide-react";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import FilterPanel from "@/components/FilterPanel";
import PlotPopup from "@/components/PlotPopup";
import type { Plot, PlotStatus } from "@/types/plot";

type Orientation = "portrait" | "landscape";

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type PlotBox = {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
};

type PreparedPlot = {
  plot: Plot;
  points: [number, number][];
  pointsString: string;
  centroid: [number, number];
  interactive: boolean;
  fillId: string;
  stroke: string;
  box: PlotBox;
};

type PreparedRoad = {
  plot: Plot;
  points: [number, number][];
  pointsString: string;
  centerPoints: [number, number][];
  centerPath: string;
  label: string;
  box: PlotBox;
};

type PlotMapProps = {
  plots: Plot[];
  orientation?: Orientation;
  showLegend?: boolean;
  /** When false, renders the SVG at native viewBox scale without zoom/pan controls. */
  enableZoom?: boolean;
  showFilters?: boolean;
  backgroundImageUrl?: string;
};

const LANDMARK_COLORS: Record<string, { fillId: string; stroke: string }> = {
  "amenity-area": { fillId: "fill-amenity-area", stroke: "#1d4ed8" },
  PlayArea: { fillId: "fill-PlayArea", stroke: "#6d28d9" },
  ClubHouse: { fillId: "fill-clubhouse", stroke: "#c2410c" },
  clubhouse: { fillId: "fill-clubhouse", stroke: "#c2410c" },
  canal1: { fillId: "fill-canal1", stroke: "#0f766e" },
  canal2: { fillId: "fill-canal2", stroke: "#0f766e" },
  Canal_2: { fillId: "fill-canal1", stroke: "#0f766e" },
  Canal_3: { fillId: "fill-canal2", stroke: "#0f766e" },
  Park: { fillId: "fill-park", stroke: "#16a34a" },
};

const CANAL_IDS = new Set(["canal1", "canal2", "Canal_2", "Canal_3"]);

const LEGEND_ITEMS = [
  { label: "Available", fill: "#dcfce7", stroke: "#16a34a" },
  { label: "Sold", fill: "#fee2e2", stroke: "#dc2626" },
  { label: "Under Development", fill: "#f3f4f6", stroke: "#9ca3af" },
  { label: "Amenity", fill: "#93c5fd", stroke: "#1d4ed8" },
  { label: "Play Area", fill: "#c4b5fd", stroke: "#6d28d9" },
  { label: "Clubhouse", fill: "#fdba74", stroke: "#c2410c" },
  { label: "Canal", fill: "#5eead4", stroke: "#0f766e" },
  { label: "Park", fill: "#86efac", stroke: "#16a34a" },
];

function centroid(points: [number, number][]): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  const n = points.length || 1;
  return [sx / n, sy / n];
}

function boundsFromPoints(allPoints: [number, number][][]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const points of allPoints) {
    for (const [x, y] of points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return { minX, minY, maxX, maxY };
}

function boxFromPoints(id: string, points: [number, number][]): PlotBox {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    id,
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

function isInteractive(plot: Plot): boolean {
  return plot.category === "plot" && plot.sellable;
}

function sellableStyle(plot: Plot): { fillId: string; stroke: string } {
  if (!plot.dataComplete || plot.status === "under-development") {
    return { fillId: "fill-under-development", stroke: "#9ca3af" };
  }
  if (plot.status === "sold") {
    return { fillId: "fill-sold", stroke: "#dc2626" };
  }
  return { fillId: "fill-available", stroke: "#16a34a" };
}

function landmarkStyle(plot: Plot): { fillId: string; stroke: string } {
  return (
    LANDMARK_COLORS[plot.id] ?? {
      fillId: "fill-under-development",
      stroke: "#9ca3af",
    }
  );
}

function rotatePointClockwise(point: [number, number], center: [number, number]): [number, number] {
  const [x, y] = point;
  const [cx, cy] = center;
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dy, cy - dx];
}

function orientPoints(
  points: [number, number][],
  orientation: Orientation,
  center: [number, number],
): [number, number][] {
  if (orientation === "portrait") return points;
  return points.map((point) => rotatePointClockwise(point, center));
}

function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function pointAtLength(points: [number, number][], targetLength: number): [number, number] {
  if (points.length === 0) return [0, 0];
  if (points.length === 1) return points[0];

  let walked = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distance(start, end);

    if (walked + segmentLength >= targetLength) {
      const segmentProgress = segmentLength === 0 ? 0 : (targetLength - walked) / segmentLength;
      return [
        start[0] + (end[0] - start[0]) * segmentProgress,
        start[1] + (end[1] - start[1]) * segmentProgress,
      ];
    }

    walked += segmentLength;
  }

  return points[points.length - 1];
}

function resamplePolyline(points: [number, number][], samples: number): [number, number][] {
  if (points.length <= 2 || samples <= 2) {
    return points;
  }

  let totalLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    totalLength += distance(points[index - 1], points[index]);
  }

  if (totalLength === 0) {
    return [points[0], points[points.length - 1]];
  }

  const resampled: [number, number][] = [];
  for (let index = 0; index < samples; index += 1) {
    const t = index / (samples - 1);
    resampled.push(pointAtLength(points, totalLength * t));
  }
  return resampled;
}

function averagePolylines(a: [number, number][], b: [number, number][]): [number, number][] {
  return a.map((point, index) => [
    (point[0] + b[index][0]) / 2,
    (point[1] + b[index][1]) / 2,
  ]);
}

function simplifyPolyline(points: [number, number][], tolerance = 1.75): [number, number][] {
  if (points.length <= 2) return points;

  const simplified: [number, number][] = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = simplified[simplified.length - 1];
    const current = points[index];
    if (distance(previous, current) >= tolerance) {
      simplified.push(current);
    }
  }
  simplified.push(points[points.length - 1]);
  return simplified;
}

function polylineToPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
}

function toTitleCase(value: string): string {
  return value.replace(/\b([a-z])([a-z]*)/gi, (_, first: string, rest: string) => {
    return first.toUpperCase() + rest.toLowerCase();
  });
}

function formatRoadLabel(id: string): string {
  let cleaned = id.replace(/^road-/i, "");
  cleaned = cleaned.replace(/([A-Za-z])(\d+)/g, "$1 $2");
  cleaned = cleaned.replace(/_/g, " ").trim();
  cleaned = toTitleCase(cleaned);

  const suffixMatch = cleaned.match(/^(.*\D)\s+(\d+)$/);
  if (suffixMatch && /^\d/.test(suffixMatch[1].trim())) {
    cleaned = `${suffixMatch[1].trim()} Road ${suffixMatch[2]}`;
    return cleaned;
  }

  if (/^\d/.test(cleaned) && !/Road$/i.test(cleaned)) {
    cleaned = `${cleaned} Road`;
  }

  return cleaned;
}

function roadCenterLine(points: [number, number][]): [number, number][] {
  const count = points.length;
  if (count < 4) {
    return points;
  }

  let bestI = 0;
  let bestJ = Math.floor(count / 2);
  let bestDistance = -1;

  for (let i = 0; i < count; i += 1) {
    for (let j = i + 2; j < count; j += 1) {
      if (i === 0 && j === count - 1) continue;
      const currentDistance = distance(points[i], points[j]);
      if (currentDistance > bestDistance) {
        bestDistance = currentDistance;
        bestI = i;
        bestJ = j;
      }
    }
  }

  const chainA = points.slice(bestI, bestJ + 1);
  const chainB = [...points.slice(bestJ), ...points.slice(0, bestI + 1)].reverse();
  const sampleCount = Math.max(12, Math.min(48, Math.ceil(Math.max(chainA.length, chainB.length) / 4)));
  const resampledA = resamplePolyline(chainA, sampleCount);
  const resampledB = resamplePolyline(chainB, sampleCount);
  return simplifyPolyline(averagePolylines(resampledA, resampledB));
}

function landmarkDecorationCorners(
  id: string,
  cx: number,
  cy: number,
): [number, number][] {
  if (id === "ClubHouse" || id === "clubhouse") {
    return [
      [cx - 50, cy - 42],
      [cx + 50, cy + 34],
    ];
  }
  if (id === "amenity-area") {
    return [
      [cx - 52, cy - 48],
      [cx + 52, cy + 40],
    ];
  }
  if (id === "PlayArea") {
    return [
      [cx - 44, cy - 38],
      [cx + 44, cy + 32],
    ];
  }
  if (id === "Park") {
    return [
      [cx - 48, cy - 12],
      [cx + 48, cy + 12],
    ];
  }
  if (CANAL_IDS.has(id)) {
    return [
      [cx - 90, cy - 16],
      [cx + 90, cy + 28],
    ];
  }
  return [[cx, cy]];
}

function labelFontSize(box: PlotBox): number {
  const shortSide = Math.min(box.maxX - box.minX, box.maxY - box.minY);
  return Math.max(18, Math.min(30, shortSide * 0.42));
}

function fitBoundsToViewport(
  bounds: Bounds,
  viewportWidth: number,
  viewportHeight: number,
): Bounds {
  const contentW = bounds.maxX - bounds.minX;
  const contentH = bounds.maxY - bounds.minY;
  const viewportAspect = viewportWidth / viewportHeight;
  const contentAspect = contentW / contentH;

  let minX = bounds.minX;
  let minY = bounds.minY;
  let maxX = bounds.maxX;
  let maxY = bounds.maxY;

  if (contentAspect < viewportAspect) {
    const fittedWidth = contentH * viewportAspect;
    const extraWidth = fittedWidth - contentW;
    minX -= extraWidth / 2;
    maxX += extraWidth / 2;
  } else if (contentAspect > viewportAspect) {
    const fittedHeight = contentW / viewportAspect;
    const extraHeight = fittedHeight - contentH;
    minY -= extraHeight / 2;
    maxY += extraHeight / 2;
  }

  return { minX, minY, maxX, maxY };
}

function roadLabelStartOffset(road: PreparedRoad): string {
  const width = road.box.maxX - road.box.minX;
  const height = road.box.maxY - road.box.minY;
  if (height > width * 2.4 && /^Lane /i.test(road.label)) {
    const laneNumber = Number(road.label.replace(/\D/g, ""));
    return laneNumber % 2 === 0 ? "82%" : "18%";
  }
  return "50%";
}

function roadLabelFontSize(road: PreparedRoad): number {
  const width = road.box.maxX - road.box.minX;
  const height = road.box.maxY - road.box.minY;
  if (height > width * 2.4) {
    return 12;
  }
  return road.label.length > 14 ? 13 : 16;
}

function displayRoadPoints(plot: Plot, points: [number, number][]): [number, number][] {
  if (plot.id === "road-entrance_road") {
    return simplifyPolyline(points, 8);
  }
  return points;
}

function computeFullViewBounds(
  preparedPlots: PreparedPlot[],
  preparedRoads: PreparedRoad[],
  preparedLandmarks: PreparedPlot[],
): Bounds {
  const pointSets: [number, number][][] = [
    ...preparedPlots.map((prepared) => prepared.points),
    ...preparedRoads.map((prepared) => prepared.points),
    ...preparedLandmarks.map((prepared) => prepared.points),
  ];

  const extraPoints: [number, number][] = [];

  for (const prepared of preparedPlots) {
    const fontSize = labelFontSize(prepared.box);
    const charWidth = fontSize * 0.58;
    const halfW = (charWidth * String(prepared.plot.id).length) / 2 + fontSize * 0.3;
    const halfH = fontSize * 0.55 + fontSize * 0.14;
    const [cx, cy] = prepared.centroid;
    extraPoints.push(
      [cx - halfW, cy - halfH],
      [cx + halfW, cy + halfH],
    );
  }

  for (const prepared of preparedLandmarks) {
    const [cx, cy] = prepared.centroid;
    extraPoints.push(...landmarkDecorationCorners(prepared.plot.id, cx, cy));
  }

  for (const road of preparedRoads) {
    extraPoints.push(...road.centerPoints);
    if (road.centerPoints.length === 0) continue;
    const midpoint = road.centerPoints[Math.floor(road.centerPoints.length / 2)];
    const labelWidth = road.label.length * 7.5;
    extraPoints.push(
      [midpoint[0] - labelWidth / 2, midpoint[1] - 18],
      [midpoint[0] + labelWidth / 2, midpoint[1] + 18],
    );
  }

  if (extraPoints.length > 0) {
    pointSets.push(extraPoints);
  }

  return boundsFromPoints(pointSets);
}

const PlotPolygon = memo(function PlotPolygon({
  prepared,
  hovered,
  dimmed,
  pulsing,
  onHover,
  onLeave,
  onSelect,
}: {
  prepared: PreparedPlot;
  hovered: boolean;
  dimmed: boolean;
  pulsing: boolean;
  onHover: (id: string) => void;
  onLeave: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <polygon
      points={prepared.pointsString}
      fill={`url(#${prepared.fillId})`}
      stroke={hovered ? "#065f46" : prepared.stroke}
      strokeWidth={hovered ? 2.1 : 1.2}
      vectorEffect="non-scaling-stroke"
      opacity={dimmed ? 0.24 : hovered ? 1 : prepared.interactive ? 0.97 : 1}
      className={`${prepared.interactive ? "cursor-pointer" : ""} ${pulsing ? "plot-pulse" : ""}`.trim()}
      style={{
        pointerEvents: prepared.interactive ? "auto" : "none",
        filter: hovered ? "brightness(1.08) saturate(1.1)" : undefined,
        transition: "opacity 140ms ease, filter 140ms ease, stroke-width 140ms ease",
      }}
      onMouseEnter={prepared.interactive ? () => onHover(prepared.plot.id) : undefined}
      onMouseLeave={prepared.interactive ? () => onLeave(prepared.plot.id) : undefined}
      onClick={prepared.interactive ? () => onSelect(prepared.plot.id) : undefined}
    />
  );
});

const PlotLabel = memo(function PlotLabel({ prepared }: { prepared: PreparedPlot }) {
  const [cx, cy] = prepared.centroid;
  const fontSize = labelFontSize(prepared.box);
  const strokeWidth = Math.max(3.5, fontSize * 0.28);
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="central"
      fill="#111827"
      fontSize={fontSize}
      fontWeight={800}
      style={{
        paintOrder: "stroke fill",
        stroke: "#ffffff",
        strokeWidth,
        strokeLinejoin: "round",
        pointerEvents: "none",
        textRendering: "geometricPrecision",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {prepared.plot.id}
    </text>
  );
});

function LandmarkDecorations({ preparedLandmarks }: { preparedLandmarks: PreparedPlot[] }) {
  return (
    <g id="landmark-decorations" pointerEvents="none">
      {preparedLandmarks.map((prepared) => {
        const [cx, cy] = prepared.centroid;
        const id = prepared.plot.id;

        if (id === "ClubHouse" || id === "clubhouse") {
          return (
            <g key={`clubhouse-${id}`} transform={`translate(${cx} ${cy})`}>
              <Waves x={-22} y={-34} width={44} height={44} color="#7c2d12" strokeWidth={2.25} />
              <text x={0} y={26} fill="#7c2d12" fontSize={15} fontWeight={700} textAnchor="middle">
                Clubhouse
              </text>
            </g>
          );
        }
        if (id === "amenity-area") {
          return (
            <g key="amenity-label" transform={`translate(${cx} ${cy})`}>
              <Building2 x={-24} y={-42} width={48} height={48} color="#1e3a8a" strokeWidth={2.25} />
              <text x={0} y={28} fill="#1e3a8a" fontSize={17} fontWeight={700} textAnchor="middle">
                Amenity
              </text>
            </g>
          );
        }
        if (id === "PlayArea") {
          return (
            <g key="play-label" transform={`translate(${cx} ${cy})`}>
              <Baby x={-22} y={-34} width={44} height={44} color="#581c87" strokeWidth={2.25} />
              <text x={0} y={26} fill="#581c87" fontSize={15} fontWeight={700} textAnchor="middle">
                Play
              </text>
            </g>
          );
        }
        if (id === "Park") {
          return (
            <g key="park-label">
              <text
                x={cx}
                y={cy}
                fill="#166534"
                fontSize={18}
                fontWeight={700}
                textAnchor="middle"
                opacity="0.9"
              >
                Park
              </text>
            </g>
          );
        }
        if (CANAL_IDS.has(id)) {
          return (
            <g key={`canal-${id}`}>
              <text
                x={cx}
                y={cy}
                fill="#0f766e"
                fontSize={16}
                fontWeight={700}
                textAnchor="middle"
                opacity="0.82"
              >
                CANAL
              </text>
              <path
                d={`M ${cx - 42} ${cy + 14} q 10 -8 20 0 t 20 0 t 20 0 t 20 0`}
                fill="none"
                stroke="#0f766e"
                strokeWidth="2"
                opacity="0.72"
              />
            </g>
          );
        }
        return null;
      })}
    </g>
  );
}

const ZoomControls = memo(function ZoomControls({
  zoomIn,
  zoomOut,
  resetTransform,
}: {
  zoomIn: (step?: number) => void;
  zoomOut: (step?: number) => void;
  resetTransform: () => void;
}) {
  return (
    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-2xl border border-white/70 bg-white/90 p-2 shadow-xl backdrop-blur">
      <button
        type="button"
        onClick={() => zoomOut(0.3)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-xl font-semibold text-neutral-700 transition hover:bg-neutral-50"
        aria-label="Zoom out"
      >
        -
      </button>
      <button
        type="button"
        onClick={resetTransform}
        className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-700 transition hover:bg-neutral-50"
      >
        Reset View
      </button>
      <button
        type="button"
        onClick={() => zoomIn(0.3)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-xl font-semibold text-neutral-700 transition hover:bg-neutral-50"
        aria-label="Zoom in"
      >
        +
      </button>
    </div>
  );
});

const LegendPanel = memo(function LegendPanel() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-sm backdrop-blur">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Legend
        </p>
        <p className="text-sm font-medium text-neutral-700">Status key</p>
      </div>
      <div className="space-y-2">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span
              className="h-4 w-4 rounded-sm border"
              style={{ backgroundColor: item.fill, borderColor: item.stroke }}
            />
            <span className="text-sm text-neutral-700">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

export default function PlotMap({
  plots,
  orientation = "portrait",
  showLegend = true,
  enableZoom = true,
  showFilters = false,
  backgroundImageUrl,
}: PlotMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PlotStatus>("all");
  const [pulsingPlotId, setPulsingPlotId] = useState<string | null>(null);
  const [focusedViewBox, setFocusedViewBox] = useState<{
    viewX: number;
    viewY: number;
    viewW: number;
    viewH: number;
  } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [fittedViewBox, setFittedViewBox] = useState<{
    viewX: number;
    viewY: number;
    viewW: number;
    viewH: number;
  } | null>(null);

  const sourceBounds = useMemo(
    () => boundsFromPoints(plots.map((plot) => plot.points)),
    [plots],
  );
  const sourceCenter = useMemo<[number, number]>(
    () => [
      (sourceBounds.minX + sourceBounds.maxX) / 2,
      (sourceBounds.minY + sourceBounds.maxY) / 2,
    ],
    [sourceBounds],
  );

  const { preparedPlots, preparedRoads, preparedLandmarks } = useMemo(() => {
    const plotShapes: PreparedPlot[] = [];
    const roadShapes: PreparedRoad[] = [];
    const landmarkShapes: PreparedPlot[] = [];

    for (const plot of plots) {
      const points = orientPoints(plot.points, orientation, sourceCenter);
      const pointsString = points.map(([x, y]) => `${x},${y}`).join(" ");
      const box = boxFromPoints(plot.id, points);
      const base = {
        plot,
        points,
        pointsString,
        centroid: centroid(points),
        box,
      };

      if (plot.category === "road") {
        const displayPoints = displayRoadPoints(plot, points);
        const displayBox = boxFromPoints(plot.id, displayPoints);
        const centerPoints = roadCenterLine(displayPoints);
        roadShapes.push({
          plot,
          points: displayPoints,
          pointsString: displayPoints.map(([x, y]) => `${x},${y}`).join(" "),
          centerPoints,
          centerPath: polylineToPath(centerPoints),
          label: formatRoadLabel(plot.id),
          box: displayBox,
        });
        continue;
      }

      if (plot.category === "landmark") {
        const style = landmarkStyle(plot);
        landmarkShapes.push({
          ...base,
          interactive: false,
          fillId: style.fillId,
          stroke: style.stroke,
        });
        continue;
      }

      const style = sellableStyle(plot);
      plotShapes.push({
        ...base,
        interactive: isInteractive(plot),
        fillId: style.fillId,
        stroke: style.stroke,
      });
    }

    return {
      preparedPlots: plotShapes,
      preparedRoads: roadShapes,
      preparedLandmarks: landmarkShapes,
    };
  }, [orientation, plots, sourceCenter]);

  const fullBounds = useMemo(
    () => computeFullViewBounds(preparedPlots, preparedRoads, preparedLandmarks),
    [preparedLandmarks, preparedPlots, preparedRoads],
  );

  const pad = 40;
  const shadowPad = 14;
  const viewX = fullBounds.minX - pad - shadowPad;
  const viewY = fullBounds.minY - pad - shadowPad;
  const viewW = fullBounds.maxX - fullBounds.minX + (pad + shadowPad) * 2;
  const viewH = fullBounds.maxY - fullBounds.minY + (pad + shadowPad) * 2;

  const activeViewBox = useMemo(
    () => focusedViewBox ?? fittedViewBox ?? { viewX, viewY, viewW, viewH },
    [fittedViewBox, focusedViewBox, viewH, viewW, viewX, viewY],
  );

  const sellablePlots = useMemo(
    () => plots.filter((plot) => plot.category === "plot" && plot.sellable),
    [plots],
  );
  const normalizedSearch = searchValue.trim().toLowerCase();
  const matchingPlotIds = useMemo(() => {
    return new Set(
      sellablePlots
        .filter((plot) => {
          const matchesSearch =
            normalizedSearch.length === 0 || plot.id.toLowerCase().includes(normalizedSearch);
          const matchesStatus =
            statusFilter === "all" || plot.status === statusFilter;
          return matchesSearch && matchesStatus;
        })
        .map((plot) => plot.id),
    );
  }, [normalizedSearch, sellablePlots, statusFilter]);
  const matchingPlotCount = matchingPlotIds.size;
  const searchedPlot = useMemo(() => {
    if (normalizedSearch.length === 0) return null;
    return (
      sellablePlots.find((plot) => plot.id.toLowerCase() === normalizedSearch) ??
      sellablePlots.find((plot) => plot.id.toLowerCase().startsWith(normalizedSearch)) ??
      sellablePlots.find((plot) => plot.id.toLowerCase().includes(normalizedSearch)) ??
      null
    );
  }, [normalizedSearch, sellablePlots]);

  const selectedPlot = useMemo(
    () =>
      plots.find((plot) => plot.id === selectedId && plot.category === "plot") ?? null,
    [plots, selectedId],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setLoaded(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (enableZoom) {
      setFittedViewBox(null);
      return;
    }

    const container = mapContainerRef.current;
    if (!container) return;

    const fitToContainer = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;

      const contentW = viewW;
      const contentH = viewH;
      const containerAspect = width / height;
      const contentAspect = contentW / contentH;

      let fitW = contentW;
      let fitH = contentH;
      let fitX = viewX;
      let fitY = viewY;

      if (contentAspect < containerAspect) {
        fitW = contentH * containerAspect;
        fitX = viewX - (fitW - contentW) / 2;
      } else if (contentAspect > containerAspect) {
        fitH = contentW / containerAspect;
        fitY = viewY - (fitH - contentH) / 2;
      }

      setFittedViewBox({
        viewX: fitX,
        viewY: fitY,
        viewW: fitW,
        viewH: fitH,
      });
    };

    fitToContainer();
    const observer = new ResizeObserver(fitToContainer);
    observer.observe(container);
    return () => observer.disconnect();
  }, [enableZoom, viewH, viewW, viewX, viewY]);

  useEffect(() => {
    if (enableZoom || !searchedPlot) {
      setFocusedViewBox(null);
      return;
    }

    const container = mapContainerRef.current;
    if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;

    const focusedBounds = fitBoundsToViewport(
      {
        minX: searchedPlot.points.reduce((min, [x]) => Math.min(min, x), Infinity) - 90,
        minY: searchedPlot.points.reduce((min, [, y]) => Math.min(min, y), Infinity) - 90,
        maxX: searchedPlot.points.reduce((max, [x]) => Math.max(max, x), -Infinity) + 90,
        maxY: searchedPlot.points.reduce((max, [, y]) => Math.max(max, y), -Infinity) + 90,
      },
      width,
      height,
    );

    setFocusedViewBox({
      viewX: focusedBounds.minX,
      viewY: focusedBounds.minY,
      viewW: focusedBounds.maxX - focusedBounds.minX,
      viewH: focusedBounds.maxY - focusedBounds.minY,
    });
    setPulsingPlotId(searchedPlot.id);

    const timeout = window.setTimeout(() => setPulsingPlotId((current) => (current === searchedPlot.id ? null : current)), 2200);
    return () => window.clearTimeout(timeout);
  }, [enableZoom, searchedPlot]);

  useEffect(() => {
    if (!enableZoom) {
      console.log("[PlotMap] viewBox", {
        viewX: activeViewBox.viewX,
        viewY: activeViewBox.viewY,
        viewW: activeViewBox.viewW,
        viewH: activeViewBox.viewH,
        viewBox: `${activeViewBox.viewX} ${activeViewBox.viewY} ${activeViewBox.viewW} ${activeViewBox.viewH}`,
        contentBounds: { viewX, viewY, viewW, viewH },
        fullBounds,
      });
    }
  }, [activeViewBox, enableZoom, fullBounds, viewH, viewW, viewX, viewY]);

  const handleHover = useCallback((id: string) => setHoveredId(id), []);
  const handleLeave = useCallback(
    (id: string) =>
      setHoveredId((current) => (current === id ? null : current)),
    [],
  );
  const handleSelect = useCallback((id: string) => setSelectedId(id), []);
  const handleClose = useCallback(() => setSelectedId(null), []);
  const handleResetFilters = useCallback(() => {
    setSearchValue("");
    setStatusFilter("all");
    setFocusedViewBox(null);
    setPulsingPlotId(null);
  }, []);

  const mapSvg = (
    <svg
      viewBox={`${activeViewBox.viewX} ${activeViewBox.viewY} ${activeViewBox.viewW} ${activeViewBox.viewH}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Plot map"
      className={
        enableZoom
          ? "block h-full w-full touch-none select-none"
          : "block h-full w-full"
      }
    >
      <defs>
        <linearGradient id="grass-base" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7fb069" />
          <stop offset="38%" stopColor="#91c178" />
          <stop offset="72%" stopColor="#a8d08d" />
          <stop offset="100%" stopColor="#96c97d" />
        </linearGradient>
        <filter id="grass-noise" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.75"
            numOctaves="2"
            seed="11"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 0.045 0"
          />
        </filter>
        <pattern id="grass-blades" width="26" height="26" patternUnits="userSpaceOnUse">
          <rect width="26" height="26" fill="transparent" />
          <path
            d="M4 22 q1.2 -4 0 -8"
            fill="none"
            stroke="#6fa058"
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.85"
          />
          <path
            d="M9 19 q-1.6 -4.5 -0.2 -9"
            fill="none"
            stroke="#8fc47a"
            strokeWidth="0.95"
            strokeLinecap="round"
            opacity="0.72"
          />
          <path
            d="M14 24 q0.8 -3.5 0.4 -7.4"
            fill="none"
            stroke="#7fb069"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.78"
          />
          <path
            d="M19 18 q1.8 -4.2 0.6 -8.8"
            fill="none"
            stroke="#6fa058"
            strokeWidth="0.9"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path
            d="M22 23 q-1.1 -3.2 -0.1 -6.7"
            fill="none"
            stroke="#8fc47a"
            strokeWidth="0.9"
            strokeLinecap="round"
            opacity="0.68"
          />
          <path
            d="M6 8 q1.3 -2.6 0.4 -5.1"
            fill="none"
            stroke="#7fb069"
            strokeWidth="0.8"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d="M17 9 q-1.1 -2.8 -0.3 -5.4"
            fill="none"
            stroke="#6fa058"
            strokeWidth="0.75"
            strokeLinecap="round"
            opacity="0.5"
          />
        </pattern>
        {backgroundImageUrl ? (
          <pattern
            id="grass-image-pattern"
            width="220"
            height="220"
            patternUnits="userSpaceOnUse"
          >
            <image
              href={backgroundImageUrl}
              x="0"
              y="0"
              width="220"
              height="220"
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>
        ) : null}
        <linearGradient id="fill-available" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eefcf2" />
          <stop offset="100%" stopColor="#bbf7d0" />
        </linearGradient>
        <linearGradient id="fill-sold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff1f2" />
          <stop offset="100%" stopColor="#fecaca" />
        </linearGradient>
        <linearGradient id="fill-under-development" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e5e7eb" />
        </linearGradient>
        <linearGradient id="fill-amenity-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#93c5fd" />
        </linearGradient>
        <linearGradient id="fill-PlayArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ddd6fe" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
        <linearGradient id="fill-clubhouse" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fed7aa" />
          <stop offset="100%" stopColor="#fdba74" />
        </linearGradient>
        <linearGradient id="fill-canal1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#99f6e4" />
          <stop offset="100%" stopColor="#5eead4" />
        </linearGradient>
        <linearGradient id="fill-canal2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#99f6e4" />
          <stop offset="100%" stopColor="#5eead4" />
        </linearGradient>
        <linearGradient id="fill-park" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bbf7d0" />
          <stop offset="100%" stopColor="#86efac" />
        </linearGradient>
        <pattern id="canal-wave" width="24" height="14" patternUnits="userSpaceOnUse">
          <path
            d="M0 7 q 6 -5 12 0 t 12 0"
            fill="none"
            stroke="#0f766e"
            strokeOpacity="0.28"
            strokeWidth="2"
          />
        </pattern>
        <filter id="plot-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="3"
            floodColor="#475569"
            floodOpacity="0.18"
          />
        </filter>
      </defs>

      <rect
        x={activeViewBox.viewX}
        y={activeViewBox.viewY}
        width={activeViewBox.viewW}
        height={activeViewBox.viewH}
        fill="url(#grass-base)"
      />
      <rect
        x={activeViewBox.viewX}
        y={activeViewBox.viewY}
        width={activeViewBox.viewW}
        height={activeViewBox.viewH}
        fill={backgroundImageUrl ? "url(#grass-image-pattern)" : "url(#grass-blades)"}
        filter={backgroundImageUrl ? undefined : "url(#grass-noise)"}
        opacity={backgroundImageUrl ? 0.88 : 0.82}
      />

      <g id="roads" pointerEvents="none">
        {preparedRoads.map((road) => (
          <polygon
            key={road.plot.id}
            points={road.pointsString}
            fill="#4b5563"
            stroke="#374151"
            strokeWidth={1.2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <g
          stroke="#f8fafc"
          strokeWidth={4}
          strokeDasharray="18 12"
          strokeLinecap="round"
          opacity="0.92"
        >
          {preparedRoads.map((road) => (
            <path
              key={`lane-${road.plot.id}`}
              d={road.centerPath}
              fill="none"
            />
          ))}
        </g>
        <g id="road-label-guides" opacity="0">
          {preparedRoads.map((road) => (
            <path key={`guide-${road.plot.id}`} id={`road-label-${road.plot.id}`} d={road.centerPath} fill="none" />
          ))}
        </g>
        <g id="road-labels" fontFamily="system-ui, sans-serif" pointerEvents="none">
          {preparedRoads.map((road) => (
            <text
              key={`road-name-${road.plot.id}`}
              fill="#f8fafc"
              fontSize={roadLabelFontSize(road)}
              fontWeight={800}
              letterSpacing="0.02em"
              style={{
                paintOrder: "stroke fill",
                stroke: "rgba(17,24,39,0.85)",
                strokeWidth: 4,
                strokeLinejoin: "round",
                textRendering: "geometricPrecision",
              }}
            >
              <textPath
                href={`#road-label-${road.plot.id}`}
                startOffset={roadLabelStartOffset(road)}
                textAnchor="middle"
              >
                {road.label}
              </textPath>
            </text>
          ))}
        </g>
      </g>

      <g id="landmarks" pointerEvents="none">
        {preparedLandmarks.map((prepared) => (
          <PlotPolygon
            key={`landmark-${prepared.plot.id}`}
            prepared={prepared}
            hovered={false}
            dimmed={false}
            pulsing={false}
            onHover={handleHover}
            onLeave={handleLeave}
            onSelect={handleSelect}
          />
        ))}
      </g>

      <g id="canal-overlay" opacity="0.55" pointerEvents="none">
        {preparedLandmarks
          .filter((prepared) => CANAL_IDS.has(prepared.plot.id))
          .map((prepared) => (
            <polygon
              key={`overlay-${prepared.plot.id}`}
              points={prepared.pointsString}
              fill="url(#canal-wave)"
              stroke="none"
            />
          ))}
      </g>

      <g id="plots" filter="url(#plot-shadow)">
        {preparedPlots.map((prepared) => (
          <PlotPolygon
            key={`shape-${prepared.plot.id}`}
            prepared={prepared}
            hovered={prepared.interactive && hoveredId === prepared.plot.id}
            dimmed={prepared.interactive && !matchingPlotIds.has(prepared.plot.id)}
            pulsing={pulsingPlotId === prepared.plot.id}
            onHover={handleHover}
            onLeave={handleLeave}
            onSelect={handleSelect}
          />
        ))}
      </g>

      <LandmarkDecorations preparedLandmarks={preparedLandmarks} />

      <g id="labels">
        {preparedPlots.map((prepared) => (
          <g
            key={`label-${prepared.plot.id}`}
            opacity={prepared.interactive && !matchingPlotIds.has(prepared.plot.id) ? 0.32 : 1}
          >
            <PlotLabel prepared={prepared} />
          </g>
        ))}
      </g>
    </svg>
  );

  return (
    <div
      className={`relative h-full w-full overflow-hidden transition-opacity duration-500 ${
        enableZoom ? "bg-neutral-300" : "bg-[#96c97d]"
      } ${loaded ? "opacity-100" : "opacity-0"}`}
    >
      <style>{`
        .plot-pulse {
          animation: plot-pulse-outline 0.9s ease-in-out 3;
          transform-box: fill-box;
          transform-origin: center;
        }
        @keyframes plot-pulse-outline {
          0%, 100% { stroke-width: 1.8px; filter: brightness(1); }
          50% { stroke-width: 4.4px; filter: brightness(1.12); }
        }
      `}</style>
      {showFilters && (
        <FilterPanel
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          activeStatus={statusFilter}
          onStatusChange={setStatusFilter}
          matchingCount={matchingPlotCount}
          totalCount={sellablePlots.length}
          onReset={handleResetFilters}
        />
      )}
      {showLegend && (
        <>
          <div className="absolute left-3 top-3 z-20 md:hidden">
            <button
              type="button"
              onClick={() => setLegendOpen((current) => !current)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/90 shadow-lg backdrop-blur"
              aria-label="Toggle legend"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-neutral-700"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <div className="absolute left-0 top-0 z-10 hidden h-full w-[260px] border-r border-stone-200/70 bg-white/85 p-4 backdrop-blur md:block">
            <LegendPanel />
          </div>

          <div
            className={`absolute left-3 top-16 z-20 w-[240px] rounded-2xl border border-white/70 bg-white/90 p-4 shadow-xl backdrop-blur transition-all duration-200 md:hidden ${
              legendOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Legend
                </p>
                <p className="text-sm font-medium text-neutral-700">Status key</p>
              </div>
              <button
                type="button"
                onClick={() => setLegendOpen(false)}
                className="rounded-full p-1 text-neutral-500"
                aria-label="Close legend"
              >
                x
              </button>
            </div>
            <LegendPanel />
          </div>
        </>
      )}

      <div
        ref={!enableZoom ? mapContainerRef : undefined}
        className={
          enableZoom
            ? showLegend
              ? "h-full w-full md:pl-[260px]"
              : "h-full w-full"
            : "h-full w-full"
        }
      >
        {enableZoom ? (
          <TransformWrapper
            initialScale={1}
            minScale={0.85}
            maxScale={4.5}
            limitToBounds={false}
            centerOnInit
            smooth
            wheel={{ step: 0.1 }}
            pinch={{ step: 4 }}
            doubleClick={{ disabled: false, step: 0.8, animationTime: 200 }}
            panning={{ velocityDisabled: true }}
          >
            {({ zoomIn, zoomOut, resetTransform }: ReactZoomPanPinchRef) => (
              <>
                <TransformComponent
                  wrapperClass="!h-full !w-full"
                  contentClass="!h-full !w-full"
                >
                  {mapSvg}
                </TransformComponent>
                <ZoomControls
                  zoomIn={zoomIn}
                  zoomOut={zoomOut}
                  resetTransform={resetTransform}
                />
              </>
            )}
          </TransformWrapper>
        ) : (
          mapSvg
        )}
      </div>

      {selectedPlot && <PlotPopup plot={selectedPlot} onClose={handleClose} />}
    </div>
  );
}
