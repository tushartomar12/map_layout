/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import PlotSketch from "@/components/PlotSketch";
import { parseVerticalEdges } from "@/lib/edgeOrientation";
import { UNDER_DEVELOPMENT_MESSAGE } from "@/lib/underDevelopmentPlots";
import type { Plot, PlotStatus } from "@/types/plot";

type PlotPopupProps = {
  plot: Plot;
  onClose: () => void;
};

function formatInr(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatMeters(length: number): string {
  return `${length.toFixed(2)} m`;
}

function statusMeta(status: PlotStatus): {
  label: string;
  dot: string;
  pill: string;
} {
  if (status === "sold") {
    return {
      label: "SOLD",
      dot: "bg-red-500",
      pill: "bg-red-500/20 text-red-300 ring-red-500/40",
    };
  }
  if (status === "under-development") {
    return {
      label: "UNDER DEVELOPMENT",
      dot: "bg-blue-500",
      pill: "bg-blue-500/20 text-blue-300 ring-blue-500/40",
    };
  }
  return {
    label: "AVAILABLE",
    dot: "bg-emerald-400",
    pill: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  };
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "TBD";
  }
  return String(value);
}

function deriveDimension(plot: Plot): string {
  const vertical = parseVerticalEdges(plot.edgeLengths);
  const widths = [vertical.top, vertical.bottom].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  const depths = [vertical.left, vertical.right].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

  if (widths.length > 0 && depths.length > 0) {
    const width = widths.reduce((sum, value) => sum + value, 0) / widths.length;
    const depth = depths.reduce((sum, value) => sum + value, 0) / depths.length;
    return `${formatMeters(width)} x ${formatMeters(depth)}`;
  }

  const edges = (plot.edgeLengths ?? []).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (edges.length >= 2) {
    const unique = Array.from(
      new Set(edges.map((value) => Number(value.toFixed(2)))),
    ).sort((a, b) => b - a);
    if (unique.length >= 2) {
      return `${formatMeters(unique[0])} x ${formatMeters(unique[1])}`;
    }
    return `${formatMeters(unique[0])} x ${formatMeters(unique[0])}`;
  }
  if (edges.length === 1) {
    return formatMeters(edges[0]);
  }
  return "TBD";
}

function SketchOverride({ plot, fallback }: { plot: Plot; fallback: React.ReactNode }) {
  const [imageState, setImageState] = useState<"loading" | "found" | "error">("loading");
  const [ext, setExt] = useState<"png" | "jpg">("png");

  useEffect(() => {
    setImageState("loading");
    let isMounted = true;

    const imgPng = new window.Image();
    imgPng.onload = () => {
      if (!isMounted) return;
      setExt("png");
      setImageState("found");
    };
    imgPng.onerror = () => {
      if (!isMounted) return;
      const imgJpg = new window.Image();
      imgJpg.onload = () => {
        if (!isMounted) return;
        setExt("jpg");
        setImageState("found");
      };
      imgJpg.onerror = () => {
        if (!isMounted) return;
        setImageState("error");
      };
      imgJpg.src = `/plot-sketches/${plot.id}.jpg`;
    };
    imgPng.src = `/plot-sketches/${plot.id}.png`;

    return () => {
      isMounted = false;
    };
  }, [plot.id]);

  if (imageState === "error") {
    return <>{fallback}</>;
  }

  return (
    <div className="relative flex min-h-[260px] w-full items-center justify-center overflow-hidden rounded-2xl bg-white shadow-inner">
      {imageState === "loading" ? (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500" />
        </div>
      ) : (
        <img
          src={`/plot-sketches/${plot.id}.${ext}`}
          alt={`Plot ${plot.id} sketch`}
          className="h-full w-full object-contain"
        />
      )}
      <span className="absolute bottom-3 right-3 rounded-full bg-neutral-900 px-3 py-1 text-[10px] font-semibold tracking-[0.12em] text-amber-100/90">
        PLOT SKETCH
      </span>
    </div>
  );
}

export default function PlotPopup({ plot, onClose }: PlotPopupProps) {
  const status = statusMeta(plot.status);
  const area = plot.areaSqM == null ? "TBD" : `${plot.areaSqM} sq.m`;
  const dimension = deriveDimension(plot);
  const development = displayValue(plot.typeOfDevelopment || null);
  const [showForm, setShowForm] = useState(false);
  const [visible, setVisible] = useState(false);
  
  const [formData, setFormData] = useState({ name: "", email: "", mobile: "", address: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Please enter your name.";
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid email address.";
    }

    const mobileDigits = formData.mobile.replace(/\D/g, "");
    const coreNumber = mobileDigits.startsWith("91") && mobileDigits.length === 12 
      ? mobileDigits.substring(2) 
      : mobileDigits;
    
    if (coreNumber.length !== 10) {
      newErrors.mobile = "Please enter a valid 10-digit mobile number.";
    }

    if (!formData.address.trim()) newErrors.address = "Please enter your address.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, plotId: plot.id }),
      });
      
      if (!res.ok) throw new Error("Submission failed");
      setIsSuccess(true);
    } catch {
      setSubmitError("Something went wrong, please try again or contact us directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormEmpty = !formData.name.trim() || !formData.email.trim() || !formData.mobile.trim() || !formData.address.trim();

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

            <SketchOverride plot={plot} fallback={<PlotSketch plot={plot} />} />
          </div>

          <div className="flex flex-col gap-4 lg:pt-10">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { label: "AREA", value: area },
                { label: "DIMENSION", value: dimension },
                ...(plot.sellable && plot.facingRoad
                  ? [{ label: "FACING", value: `Faces ${plot.facingRoad}` }]
                  : []),
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

            {plot.status === "available" && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
                <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-emerald-200/80">
                  PRICE
                </p>
                <p className="mb-4 text-2xl font-semibold text-emerald-300">
                  {plot.price == null ? "Price on request" : formatInr(plot.price)}
                </p>
                
                {isSuccess ? (
                  <div className="mt-6 rounded-xl bg-white/[0.03] border border-emerald-500/30 p-5">
                    <p className="text-emerald-300 font-medium text-lg mb-6">
                      Thank you! We&apos;ll get in touch with you soon.
                    </p>
                    <p className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-emerald-200/80 uppercase">
                      CALL / WHATSAPP
                    </p>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <a href="tel:+919818318132" className="text-xl font-medium text-white transition hover:text-emerald-300">
                          +91 98183 18132
                        </a>
                        <a href="https://wa.me/919818318132" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/20 text-[#25D366] transition hover:bg-[#25D366]/30">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </a>
                      </div>
                      <div className="flex items-center gap-3">
                        <a href="tel:+919811718331" className="text-xl font-medium text-white transition hover:text-emerald-300">
                          +91 98117 18331
                        </a>
                        <a href="https://wa.me/919811718331" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/20 text-[#25D366] transition hover:bg-[#25D366]/30">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </a>
                      </div>
                    </div>
                  </div>
                ) : !showForm ? (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold tracking-wide text-neutral-950 transition hover:bg-emerald-400"
                  >
                    Enquire Now
                  </button>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
                    <div>
                      <input
                        type="text"
                        placeholder="Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-4 py-2.5 text-sm text-emerald-100 placeholder-emerald-200/50 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition"
                      />
                      {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
                    </div>
                    <div>
                      <input
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-4 py-2.5 text-sm text-emerald-100 placeholder-emerald-200/50 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition"
                      />
                      {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
                    </div>
                    <div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="Mobile Number (10 digits)"
                        value={formData.mobile}
                        onChange={(e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, "") })}
                        className="w-full rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-4 py-2.5 text-sm text-emerald-100 placeholder-emerald-200/50 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition"
                      />
                      {errors.mobile && <p className="mt-1 text-xs text-red-400">{errors.mobile}</p>}
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-4 py-2.5 text-sm text-emerald-100 placeholder-emerald-200/50 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition"
                      />
                      {errors.address && <p className="mt-1 text-xs text-red-400">{errors.address}</p>}
                    </div>
                    {submitError && <p className="text-sm text-red-400">{submitError}</p>}
                    <button
                      type="submit"
                      disabled={isFormEmpty || isSubmitting}
                      className="mt-2 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold tracking-wide text-neutral-950 transition hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isSubmitting ? (
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
                      ) : (
                        "Submit Enquiry"
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}

            {plot.status === "sold" && (
              <div className="rounded-2xl border border-red-500/35 bg-red-500/15 p-5">
                <p className="text-sm font-medium text-red-300">
                  This plot has been sold
                </p>
              </div>
            )}

            {plot.status === "under-development" && (
              <div className="rounded-2xl border border-blue-500/35 bg-blue-500/15 p-5">
                <p className="text-sm font-medium text-blue-300">
                  {UNDER_DEVELOPMENT_MESSAGE}
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
