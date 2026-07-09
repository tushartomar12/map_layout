"use client";

import { useState } from "react";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import type { PlotStatus } from "@/types/plot";

type FilterPanelProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  activeStatus: "all" | PlotStatus;
  onStatusChange: (status: "all" | PlotStatus) => void;
  matchingCount: number;
  totalCount: number;
  onReset: () => void;
};

const STATUS_OPTIONS: Array<{ id: "all" | PlotStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "sold", label: "Sold" },
  { id: "under-development", label: "Under Development" },
];

function PanelContent({
  searchValue,
  onSearchChange,
  activeStatus,
  onStatusChange,
  matchingCount,
  totalCount,
  onReset,
}: FilterPanelProps) {
  return (
    <div className="space-y-4 text-white">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
          Find Plot
        </p>
        <label className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-3 py-2.5 shadow-sm backdrop-blur">
          <Search className="h-4 w-4 text-white/60" />
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Type plot id"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
          />
        </label>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
          Status
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => {
            const active = option.id === activeStatus;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onStatusChange(option.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-cyan-400/80 bg-cyan-400/18 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.14)]"
                    : "border-white/10 bg-white/6 text-white/70 hover:bg-white/10"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/8 px-3 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
            Matching Plots
          </p>
          <p className="text-lg font-semibold text-white">
            {matchingCount}
            <span className="ml-1 text-sm font-medium text-white/55">/ {totalCount}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/14"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>
    </div>
  );
}

export default function FilterPanel(props: FilterPanelProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="absolute left-3 top-3 z-30 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#111827]/88 shadow-lg backdrop-blur"
          aria-label="Open filters"
        >
          <SlidersHorizontal className="h-5 w-5 text-white" />
        </button>
      </div>

      <div className="absolute left-3 top-3 z-30 hidden w-[320px] rounded-3xl border border-white/10 bg-[#111827]/88 p-4 shadow-2xl backdrop-blur md:block">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
              Search & Filters
            </p>
            <p className="text-sm font-medium text-white">Refine visible plots</p>
          </div>
          <SlidersHorizontal className="h-4 w-4 text-cyan-300" />
        </div>
        <PanelContent {...props} />
      </div>

      <div
        className={`absolute inset-0 z-40 bg-black/20 transition-opacity md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
      />
      <div
        className={`absolute left-3 top-3 z-50 w-[min(320px,calc(100vw-1.5rem))] rounded-3xl border border-white/10 bg-[#111827]/92 p-4 shadow-2xl backdrop-blur transition-all duration-200 md:hidden ${
          mobileOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
              Search & Filters
            </p>
            <p className="text-sm font-medium text-white">Refine visible plots</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-full p-1 text-white/70"
            aria-label="Close filters"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <PanelContent {...props} />
      </div>
    </>
  );
}
