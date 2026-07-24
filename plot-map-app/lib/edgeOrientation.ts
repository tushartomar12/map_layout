/**
 * Edge-dimension orientation mapping.
 *
 * Excel / PDF source stores edges in vertical-layout order:
 *   [Top/Front, Right, Bottom/Rear, Left]
 *
 * The live SVG map was rotated from that vertical sheet into a horizontal
 * layout. Remap vertical roles into horizontal screen roles before labeling.
 */

export type SideRole = "top" | "right" | "bottom" | "left";

/** Rotation used when converting the vertical source layout to the SVG. */
export type LayoutRotation = "cw90" | "ccw90";

/** Default matches the digitization pipeline (vertical → horizontal). */
export const DEFAULT_LAYOUT_ROTATION: LayoutRotation = "cw90";

type VerticalEdges = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

/**
 * Parse Excel edge arrays into named vertical roles.
 *
 * Preferred format is a fixed 4-slot array [Top, Right, Bottom, Left] where
 * missing sides are `null` (not omitted). Legacy compact arrays (blanks
 * dropped) are still accepted: 3 values ⇒ Right blank.
 */
export function parseVerticalEdges(
  edgeLengths: Array<number | null | undefined> | null | undefined,
): VerticalEdges {
  const raw = edgeLengths ?? [];

  const asNumber = (value: number | null | undefined): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

  // Explicit 4-slot form keeps blank sides addressable.
  if (raw.length === 4) {
    return {
      top: asNumber(raw[0]),
      right: asNumber(raw[1]),
      bottom: asNumber(raw[2]),
      left: asNumber(raw[3]),
    };
  }

  const values = raw.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

  if (values.length >= 4) {
    return {
      top: values[0],
      right: values[1],
      bottom: values[2],
      left: values[3],
    };
  }

  if (values.length === 3) {
    // Legacy: Right side blank → [Top, Bottom, Left]
    return {
      top: values[0],
      bottom: values[1],
      left: values[2],
    };
  }

  if (values.length === 2) {
    return { top: values[0], bottom: values[1] };
  }

  if (values.length === 1) {
    return { top: values[0] };
  }

  return {};
}

/**
 * Map vertical-source edge roles onto horizontal SVG screen roles.
 *
 * CW 90° (default):
 *   Original Top    → Rendered Right
 *   Original Right  → Rendered Bottom
 *   Original Bottom → Rendered Left
 *   Original Left   → Rendered Top
 *
 * CCW 90° (toggle if labels appear mirrored):
 *   Original Top    → Rendered Left
 *   Original Left   → Rendered Bottom
 *   Original Bottom → Rendered Right
 *   Original Right  → Rendered Top
 */
export function mapVerticalEdgesToHorizontal(
  vertical: VerticalEdges,
  rotation: LayoutRotation = DEFAULT_LAYOUT_ROTATION,
): Partial<Record<SideRole, number>> {
  const { top, right, bottom, left } = vertical;

  if (rotation === "ccw90") {
    return {
      ...(right != null ? { top: right } : {}),
      ...(bottom != null ? { right: bottom } : {}),
      ...(left != null ? { bottom: left } : {}),
      ...(top != null ? { left: top } : {}),
    };
  }

  // cw90
  return {
    ...(left != null ? { top: left } : {}),
    ...(top != null ? { right: top } : {}),
    ...(right != null ? { bottom: right } : {}),
    ...(bottom != null ? { left: bottom } : {}),
  };
}

/** Convenience: Excel edgeLengths array → horizontal screen role map. */
export function horizontalEdgesFromLengths(
  edgeLengths: Array<number | null | undefined> | null | undefined,
  rotation: LayoutRotation = DEFAULT_LAYOUT_ROTATION,
): Partial<Record<SideRole, number>> {
  return mapVerticalEdgesToHorizontal(parseVerticalEdges(edgeLengths), rotation);
}
