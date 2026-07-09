"use client";

import { useEffect, useMemo, useState } from "react";
import type { Plot, PlotStatus } from "@/types/plot";

type PlotPopupProps = {
  plot: Plot;
  onClose: () => void;
};

const SKETCH_SIZE = 300;

function formatInr(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

function statusMeta(status: PlotStatus): {
  label: string;
  dot: string;
  pill: string;
} {
  if (status === "available") {
    return {
      label: "AVAILABLE",
      dot: "bg-emerald-400",
      pill: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
    };
  }
  if (status === "sold") {
    return {
      label: "SOLD",
      dot: "bg-red-400",
      pill: "bg-red-500/15 text-red-300 ring-red-400/30",
    };
  }
  return {
    label: "UNDER DEVELOPMENT",
    dot: "bg-neutral-400",
    pill: "bg-neutral-500/20 text-neutral-300 ring-neutral-400/30",
  };
}

function displayOrComingSoon(
  value: string | number | null | undefined,
  dataComplete: boolean,
): string {
  if (!dataComplete) return "Details coming soon";
  if (value === null || value === undefined || value === "") {
    return "Details coming soon";
  }
  return String(value);
}

function plotDescription(plot: Plot): string {
  const explicit = plot.description?.trim();
  if (explicit) return explicit;

  if (!plot.dataComplete) {
    return "Full plot description will be available once the builder confirms the final details for this inventory.";
  }

  if (plot.status === "sold") {
    return `Plot ${plot.id} is part of the ${plot.zone || "project"} inventory and has already been sold.`;
  }

  if (plot.status === "available") {
    return `Plot ${plot.id} is currently available ${plot.zone ? `in the ${plot.zone} zone` : "for enquiry"}${plot.areaSqM ? ` with an area of ${plot.areaSqM} sqm` : ""}.`;
  }

  return `Plot ${plot.id} is currently under development${plot.zone ? ` in the ${plot.zone} zone` : ""}.`;
}

const SKETCH_PAD = 36;

function normalizeSketch(points: [number, number][]) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const inner = SKETCH_SIZE - SKETCH_PAD * 2;
  const scale = Math.min(inner / width, inner / height);
  const drawnW = width * scale;
  const drawnH = height * scale;
  const offsetX = (SKETCH_SIZE - drawnW) / 2;
  const offsetY = (SKETCH_SIZE - drawnH) / 2;

  const scaled = points.map(
    ([x, y]) =>
      [
        offsetX + (x - minX) * scale,
        offsetY + (y - minY) * scale,
      ] as [number, number],
  );

  let cx = 0;
  let cy = 0;
  for (const [x, y] of scaled) {
    cx += x;
    cy += y;
  }
  cx /= scaled.length || 1;
  cy /= scaled.length || 1;

  return { scaled, cx, cy };
}

function edgeMidOutside(
  a: [number, number],
  b: [number, number],
  cx: number,
  cy: number,
  offset = 14,
): { x: number; y: number; angle: number } {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  let nx = mx - cx;
  let ny = my - cy;
  const len = Math.hypot(nx, ny) || 1;
  nx /= len;
  ny /= len;
  const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  let labelAngle = angle;
  if (labelAngle > 90 || labelAngle < -90) labelAngle += 180;
  return {
    x: mx + nx * offset,
    y: my + ny * offset,
    angle: labelAngle,
  };
}

function deriveDimension(plot: Plot): string {
  if (!plot.dataComplete) return "Details coming soon";
  if (!plot.edgeLengths || plot.edgeLengths.length < 2 || plot.points.length < 3) {
    return "TBD";
  }

  const edges: { length: number; dx: number; dy: number }[] = [];
  const n = plot.points.length;
  for (let i = 0; i < n; i += 1) {
    const [x1, y1] = plot.points[i];
    const [x2, y2] = plot.points[(i + 1) % n];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length =
      plot.edgeLengths[i] ??
      plot.edgeLengths[i % plot.edgeLengths.length] ??
      Math.hypot(dx, dy);
    edges.push({ length, dx, dy });
  }

  let best: [number, number] | null = null;
  let bestScore = -1;
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const a = edges[i];
      const b = edges[j];
      const la = Math.hypot(a.dx, a.dy) || 1;
      const lb = Math.hypot(b.dx, b.dy) || 1;
      const dot = Math.abs((a.dx * b.dx + a.dy * b.dy) / (la * lb));
      if (dot > 0.35) continue;
      const score = (1 - dot) * (a.length + b.length);
      if (score > bestScore) {
        bestScore = score;
        best = [a.length, b.length];
      }
    }
  }

  if (!best) {
    const sorted = [...edges].sort((a, b) => b.length - a.length);
    best = [sorted[0].length, sorted[1].length];
  }

  const [a, b] = best;
  const fmt = (v: number) =>
    Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
  return `${fmt(Math.max(a, b))} m x ${fmt(Math.min(a, b))} m`;
}

function PlotSketch({ plot }: { plot: Plot }) {
  const { scaled, cx, cy } = useMemo(
    () => normalizeSketch(plot.points),
    [plot.points],
  );
  const hasEdges = Boolean(plot.edgeLengths && plot.edgeLengths.length > 0);

  return (
    <div className="relative rounded-2xl bg-white p-4 shadow-inner">
      <svg
        viewBox={`0 0 ${SKETCH_SIZE} ${SKETCH_SIZE}`}
        className="mx-auto block h-auto w-full max-w-[300px]"
        role="img"
        aria-label={`Sketch of plot ${plot.id}`}
      >
        <polygon
          points={scaled.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="#fafafa"
          stroke="#111"
          strokeWidth={2}
        />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#111"
          fontSize={22}
          fontWeight={700}
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          {plot.id}
        </text>
        {hasEdges &&
          scaled.map((point, index) => {
            const next = scaled[(index + 1) % scaled.length];
            const length = plot.edgeLengths?.[index];
            if (length == null) return null;
            const label = edgeMidOutside(point, next, cx, cy);
            const text =
              Number.isInteger(length) ? `${length} m` : `${length.toFixed(2)} m`;
            return (
              <text
                key={`edge-${index}`}
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#374151"
                fontSize={11}
                fontWeight={600}
                transform={`rotate(${label.angle} ${label.x} ${label.y})`}
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                {text}
              </text>
            );
          })}
      </svg>

      {!hasEdges && (
        <p className="mt-2 text-center text-xs text-neutral-500">
          Exact dimensions pending
        </p>
      )}

      <span className="absolute bottom-3 right-3 rounded-full bg-neutral-900 px-3 py-1 text-[10px] font-semibold tracking-[0.12em] text-amber-100/90">
        PLOT SKETCH
      </span>
    </div>
  );
}

export default function PlotPopup({ plot, onClose }: PlotPopupProps) {
  const status = statusMeta(plot.status);
  const zone = displayOrComingSoon(plot.zone || null, plot.dataComplete);
  const area = !plot.dataComplete
    ? "Details coming soon"
    : plot.areaSqM == null
      ? "TBD"
      : `${plot.areaSqM} sqm`;
  const dimension = deriveDimension(plot);
  const development = displayOrComingSoon(
    plot.typeOfDevelopment || null,
    plot.dataComplete,
  );
  const description = plotDescription(plot);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 transition-opacity duration-200 sm:items-center sm:p-6 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`relative h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0d0d0d] text-neutral-100 shadow-2xl transition-all duration-200 sm:h-auto sm:max-h-[95vh] sm:max-w-5xl sm:rounded-3xl ${
          visible
            ? "translate-y-0 scale-100"
            : "translate-y-6 scale-[0.98] sm:translate-y-2"
        }`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Plot ${plot.id} details`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-xl text-neutral-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          x
        </button>

        <div className="grid gap-8 p-5 pb-8 sm:p-8 lg:grid-cols-2 lg:gap-10 lg:p-10">
          <div className="space-y-5">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.14em] ring-1 ${status.pill}`}
            >
              <span className={`h-2 w-2 rounded-full ${status.dot}`} />
              {status.label}
            </span>

            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Plot {plot.id}
            </h2>

            {!plot.dataComplete && (
              <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100/90">
                Details coming soon — final plot specs will appear here once
                confirmed by the builder.
              </p>
            )}

            <PlotSketch plot={plot} />
          </div>

          <div className="flex flex-col gap-4 lg:pt-10">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: "ZONE", value: zone },
                { label: "AREA", value: area },
                { label: "DIMENSION", value: dimension },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-amber-100/70">
                    {card.label}
                  </p>
                  <p className="text-sm font-medium leading-snug text-white">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-amber-100/70">
                TYPE OF DEVELOPMENT
              </p>
              <p className="text-base font-medium text-white">{development}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-amber-100/70">
                PLOT DESCRIPTION
              </p>
              <p className="text-sm leading-7 text-neutral-200">{description}</p>
            </div>

            {plot.status === "available" && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
                <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-emerald-200/80">
                  PRICE
                </p>
                <p className="text-2xl font-semibold text-emerald-300">
                  {!plot.dataComplete
                    ? "Details coming soon"
                    : plot.price == null
                      ? "Price on request"
                      : formatInr(plot.price)}
                </p>
              </div>
            )}

            {plot.status === "sold" && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm text-neutral-400">
                  This plot has been sold
                </p>
              </div>
            )}

            {plot.status === "under-development" && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm text-neutral-300">
                  {plot.dataComplete
                    ? "This plot is currently under development."
                    : "Details coming soon for this plot."}
                </p>
              </div>
            )}

            <div className="mt-auto flex justify-center pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition hover:bg-white/10"
                aria-label="Close and return to map"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 10.5 12 3l9 7.5" />
                  <path d="M5 9.5V21h14V9.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

