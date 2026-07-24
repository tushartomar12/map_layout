/** Plots reserved for Phase 2 release (not on sale in Phase 1). */
export const UNDER_DEVELOPMENT_PLOT_IDS = [
  "58", "59", "60", "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "70", "71", "72", "73", "74", "75", "76", "77", "78", "79", "80", "81",
  "82", "83", "84", "85", "86", "87", "88", "89", "90", "91", "92", "93",
  "94", "95", "96", "97", "98", "99", "100", "101", "102", "103", "104",
  "105", "106", "107", "108", "109", "110", "111", "112", "113", "114",
  "115", "116", "117",
] as const;

export const UNDER_DEVELOPMENT_MESSAGE = "This plot is Under Development";

export const UNDER_DEVELOPMENT_PLOT_ID_SET = new Set<string>(UNDER_DEVELOPMENT_PLOT_IDS);
