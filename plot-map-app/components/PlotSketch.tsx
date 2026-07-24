"use client";

import { useMemo } from "react";
import { parseVerticalEdges } from "@/lib/edgeOrientation";
import {
  boundsFromPoints,
  centroidOfPoints,
  labelTransformForSegment,
  pathToPoints,
  pickLabelSegmentForRole,
  rotatePointsCcw90,
  rotatePointsCw90,
  segmentsFromPoints,
  type Point,
} from "@/lib/svgPath";
import type { Plot } from "@/types/plot";
import plotPaths from "@/data/plot-paths.json";

type PlotSketchProps = {
  plot: Plot;
};

type SideRole = "top" | "right" | "bottom" | "left";

const PATH_LOOKUP = plotPaths as Record<string, string>;
const VIEWBOX_PAD_RATIO = 0.12;

function formatMeters(length: number): string {
  return `${length.toFixed(2)} m`;
}

function mean(...values: Array<number | undefined>): number | null {
  const nums = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (nums.length === 0) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function scalePointsToAspect(
  points: Point[],
  targetAspect: number,
): Point[] {
  if (!Number.isFinite(targetAspect) || targetAspect <= 0) return points;
  const bounds = boundsFromPoints(points);
  const currentAspect = bounds.width / bounds.height;
  if (!Number.isFinite(currentAspect) || currentAspect <= 0) return points;

  // Keep width; stretch height so width/height = targetAspect.
  const sy = currentAspect / targetAspect;
  if (Math.abs(sy - 1) < 1e-4) return points;


  const cy = (bounds.minY + bounds.maxY) / 2;
  return points.map(([x, y]) => [x, cy + (y - cy) * sy]);
}

/**
 * Score how well segment side-roles match Excel lengths (lower is better).
 * Uses relative error so map units vs meters still compare.
 */
function orientationScore(
  points: Point[],
  roleLengths: Partial<Record<SideRole, number>>,
): number {
  const bounds = boundsFromPoints(points);
  const centroid = centroidOfPoints(points);
  const segments = segmentsFromPoints(points);
  const ref = Math.max(bounds.width, bounds.height) || 1;
  const minLen = ref * 0.08;

  const roles = Object.keys(roleLengths) as SideRole[];
  if (roles.length === 0) return Number.POSITIVE_INFINITY;

  const roleSegLen = new Map<SideRole, number>();
  for (const role of roles) {
    const segment = pickLabelSegmentForRole(segments, role, centroid, minLen);
    if (segment) roleSegLen.set(role, segment.length);
  }

  // Normalize path edge lengths to Excel scale via median ratio.
  const ratios: number[] = [];
  for (const role of roles) {
    const excel = roleLengths[role];
    const pathLen = roleSegLen.get(role);
    if (excel != null && excel > 0 && pathLen != null && pathLen > 0) {
      ratios.push(pathLen / excel);
    }
  }
  if (ratios.length === 0) return Number.POSITIVE_INFINITY;
  ratios.sort((a, b) => a - b);
  const scale = ratios[Math.floor(ratios.length / 2)];

  let err = 0;
  let n = 0;
  for (const role of roles) {
    const excel = roleLengths[role];
    const pathLen = roleSegLen.get(role);
    if (excel == null || pathLen == null) continue;
    err += Math.abs(pathLen / scale - excel) / excel;
    n += 1;
  }
  return n === 0 ? Number.POSITIVE_INFINITY : err / n;
}

function bestOrientedPoints(
  sourcePoints: Point[],
  roleLengths: Partial<Record<SideRole, number>>,
): Point[] {
  const centroid = centroidOfPoints(sourcePoints);
  const candidates: Point[][] = [
    sourcePoints,
    rotatePointsCcw90(sourcePoints, centroid),
    rotatePointsCw90(sourcePoints, centroid),
  ];

  let best = candidates[0];
  let bestScore = orientationScore(best, roleLengths);
  for (let i = 1; i < candidates.length; i += 1) {
    const score = orientationScore(candidates[i], roleLengths);
    if (score < bestScore) {
      bestScore = score;
      best = candidates[i];
    }
  }
  return best;
}

/**
 * Sketch follows Excel Top × Side proportions (e.g. 12.5 × 15.5 → portrait),
 * with the map path rotated/scaled so edge labels match those dimensions.
 */
export default function PlotSketch({ plot }: PlotSketchProps) {
  const pathD = PATH_LOOKUP[plot.id] ?? null;

  const geometry = useMemo(() => {
    const sourcePoints: Point[] =
      pathD != null && pathD.length > 0 ? pathToPoints(pathD) : plot.points;

    if (sourcePoints.length < 2) {
      return null;
    }

    const vertical = parseVerticalEdges(plot.edgeLengths);
    const roleLengths: Partial<Record<SideRole, number>> = {
      ...(vertical.top != null ? { top: vertical.top } : {}),
      ...(vertical.right != null ? { right: vertical.right } : {}),
      ...(vertical.bottom != null ? { bottom: vertical.bottom } : {}),
      ...(vertical.left != null ? { left: vertical.left } : {}),
    };

    const excelW = mean(vertical.top, vertical.bottom);
    const excelH = mean(vertical.left, vertical.right);
    const excelAspect =
      excelW != null && excelH != null && excelH > 0 ? excelW / excelH : null;

    let oriented = bestOrientedPoints(sourcePoints, roleLengths);
    if (excelAspect != null) {
      oriented = scalePointsToAspect(oriented, excelAspect);
    }

    const bounds = boundsFromPoints(oriented);
    const centroid = centroidOfPoints(oriented);
    const segments = segmentsFromPoints(oriented);

    const pad = Math.max(bounds.width, bounds.height) * VIEWBOX_PAD_RATIO;
    const viewX = bounds.minX - pad;
    const viewY = bounds.minY - pad;
    const viewW = bounds.width + pad * 2;
    const viewH = bounds.height + pad * 2;
    const viewBox = `${viewX} ${viewY} ${viewW} ${viewH}`;

    const labelOffset = Math.max(bounds.width, bounds.height) * 0.07;
    const fontSize = Math.max(bounds.width, bounds.height) * 0.085;
    const idFontSize = Math.max(bounds.width, bounds.height) * 0.16;
    const strokeWidth = Math.max(bounds.width, bounds.height) * 0.012;

    const labels: Array<{
      key: string;
      text: string;
      x: number;
      y: number;
      angle: number;
    }> = [];

    // Only label Excel-mentioned sides on the real outer edge for that role
    // (skip notch/step edges that were never given a dimension).
    const minLen = Math.max(bounds.width, bounds.height) * 0.08;
    for (const role of ["top", "right", "bottom", "left"] as SideRole[]) {
      const length = roleLengths[role];
      if (length == null) continue;
      const segment = pickLabelSegmentForRole(
        segments,
        role,
        centroid,
        minLen,
      );
      if (!segment) continue;

      const place = labelTransformForSegment(segment, centroid, labelOffset);
      labels.push({
        key: `edge-${role}`,
        text: formatMeters(length),
        ...place,
      });
    }

    return {
      points: oriented,
      viewBox,
      viewW,
      viewH,
      centroid,
      labels,
      fontSize,
      idFontSize,
      strokeWidth,
    };
  }, [pathD, plot.edgeLengths, plot.points]);

  if (!geometry) {
    return (
      <div className="relative flex min-h-[240px] w-full items-center justify-center rounded-2xl bg-white p-4 shadow-inner">
        <p className="text-sm text-neutral-500">Plot outline unavailable</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[260px] w-full items-center justify-center rounded-2xl bg-white p-4 shadow-inner">
      <div
        className="relative w-[85%] max-w-[290px]"
        style={{ aspectRatio: `${geometry.viewW} / ${geometry.viewH}` }}
      >
        <svg
          viewBox={geometry.viewBox}
          className="h-full w-full"
          role="img"
          aria-label={`Sketch of plot ${plot.id}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <polygon
            points={geometry.points.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="#fafafa"
            stroke="#111"
            strokeWidth={geometry.strokeWidth}
            strokeLinejoin="round"
          />

          <text
            x={geometry.centroid[0]}
            y={geometry.centroid[1]}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#111"
            fontSize={geometry.idFontSize}
            fontWeight={700}
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            {plot.id}
          </text>

          {geometry.labels.map((label) => (
            <text
              key={label.key}
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#111827"
              fontSize={geometry.fontSize}
              fontWeight={600}
              transform={`rotate(${label.angle} ${label.x} ${label.y})`}
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              {label.text}
            </text>
          ))}
        </svg>
      </div>

      {geometry.labels.length === 0 && (
        <p className="absolute bottom-10 left-0 right-0 text-center text-xs text-neutral-500">
          Exact dimensions pending
        </p>
      )}

      <span className="absolute bottom-3 right-3 rounded-full bg-neutral-900 px-3 py-1 text-[10px] font-semibold tracking-[0.12em] text-amber-100/90">
        PLOT SKETCH
      </span>
    </div>
  );
}
