/** Teintes HSL réparties sur le cercle (24 couleurs) — raccourcis + défaut automatique. */
export const PLANNING_PROF_PALETTE_HUES = [
  0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225,
  240, 255, 270, 285, 300, 315, 330, 345,
] as const;

export type PlanningProfessorAccent = {
  border: string;
  background: string;
  labelColor: string;
  matiereColor: string;
  badgeSurface: string;
  badgeText: string;
  badgeRing: string;
  /** Titre formation (couleur carte hex exacte). */
  cardFormationTitleColor?: string;
  cardProfNameColor?: string;
  cardFooterMutedColor?: string;
};

export function normalizeHueDegrees(h: number): number {
  if (!Number.isFinite(h)) return 0;
  let x = h % 360;
  if (x < 0) x += 360;
  return x;
}

export function normalizeProfPaletteIndex(index: number): number {
  const len = PLANNING_PROF_PALETTE_HUES.length;
  return ((index % len) + len) % len;
}

/** Index palette par défaut à partir du `professeurId` (déterministe). */
export function defaultPaletteIndexForProfesseur(
  professeurId: string
): number {
  let n = 0;
  for (let i = 0; i < professeurId.length; i += 1) {
    n = (n * 31 + professeurId.charCodeAt(i)) >>> 0;
  }
  return n % PLANNING_PROF_PALETTE_HUES.length;
}

/** Teinte HSL (0–360°) utilisée si aucune surcharge. */
export function defaultHueForProfesseur(professeurId: string): number {
  return PLANNING_PROF_PALETTE_HUES[defaultPaletteIndexForProfesseur(professeurId)];
}

function hslToRgb(h: number, s: number, l: number) {
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r, g, b };
}

/** Surcharge grille : pastel par teinte, ou hex imposé (couleur libre). */
export type PlanningProfessorColorOverride =
  | { mode: "hue"; hueDegrees: number }
  | { mode: "hex"; hex: string };

export function normalizeHex6(hex: string): string | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  return m ? `#${m[1].toLowerCase()}` : null;
}

export function parseRgbFromHex6(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex6(hex);
  if (!normalized) return null;
  const n = parseInt(normalized.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relativeLuminanceRgb(rgb: { r: number; g: number; b: number }): number {
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * lin(rgb.r) +
    0.7152 * lin(rgb.g) +
    0.0722 * lin(rgb.b)
  );
}

function rgbChannelToHex(c: number): string {
  return Math.max(0, Math.min(255, Math.round(c)))
    .toString(16)
    .padStart(2, "0");
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  return `#${rgbChannelToHex(rgb.r)}${rgbChannelToHex(rgb.g)}${rgbChannelToHex(rgb.b)}`;
}

/** Fond = **exactement** la couleur choisie ; cadre et textes ajustés pour le contraste. */
export function planningAccentFromExactHex(hexInput: string): PlanningProfessorAccent | null {
  const rgb = parseRgbFromHex6(hexInput);
  if (!rgb) return null;
  const bg = normalizeHex6(hexInput);
  if (!bg) return null;
  const borderRgb = {
    r: rgb.r * 0.62,
    g: rgb.g * 0.62,
    b: rgb.b * 0.62,
  };
  const border = rgbToHex(borderRgb);
  const lum = relativeLuminanceRgb(rgb);
  const dark = lum > 0.22;
  const title = dark ? "#0f172a" : "#f8fafc";
  const prof = dark ? "#0f172a" : "#f1f5f9";
  const muted = dark ? "#334155" : "#cbd5e1";
  return {
    border,
    background: bg,
    labelColor: dark ? "#475569" : "#e2e8f0",
    matiereColor: dark ? "#0f172a" : "#f8fafc",
    badgeSurface: dark ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.22)",
    badgeText: dark ? "#0f172a" : "#f8fafc",
    badgeRing: dark ? "rgba(15,23,42,0.15)" : "rgba(248,250,252,0.35)",
    cardFormationTitleColor: title,
    cardProfNameColor: prof,
    cardFooterMutedColor: muted,
  };
}

export function resolveProfessorAccent(
  professeurId: string,
  override: PlanningProfessorColorOverride | null | undefined
): PlanningProfessorAccent {
  if (override == null) {
    return planningProfessorAccent(professeurId, undefined);
  }
  if (override.mode === "hue") {
    return planningProfessorAccent(professeurId, override.hueDegrees);
  }
  return planningAccentFromExactHex(override.hex) ??
    planningProfessorAccent(professeurId, undefined);
}

/** `#rrggbb` pour `<input type="color">`, teinte saturée lisible sur le cercle. */
export function hueDegreesToHex(h: number): string {
  const hh = normalizeHueDegrees(h) / 360;
  const { r, g, b } = hslToRgb(hh, 1, 0.5);
  const to255 = (x: number) =>
    Math.round(Math.max(0, Math.min(255, x * 255)));
  return `#${to255(r).toString(16).padStart(2, "0")}${to255(g).toString(16).padStart(2, "0")}${to255(b).toString(16).padStart(2, "0")}`;
}

/** Extrait la teinte HSL (°) d’un `#rrggbb` (valeur du sélecteur couleur navigateur). */
export function hexToHueDegrees(hex: string): number | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 1e-8) return 0;
  let hue = 0;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return hue * 360;
}

export function planningAccentFromHue(h: number): PlanningProfessorAccent {
  const hd = normalizeHueDegrees(h);
  return {
    border: `hsl(${hd} 52% 36%)`,
    background: `hsl(${hd} 40% 92%)`,
    labelColor: `hsl(${hd} 48% 28%)`,
    matiereColor: `hsl(${hd} 40% 22%)`,
    badgeSurface: `hsl(${hd} 28% 97%)`,
    badgeText: `hsl(${hd} 42% 26%)`,
    badgeRing: `hsl(${hd} 32% 78%)`,
  };
}

export function accentForProfesseurPaletteIndex(paletteIndex: number): PlanningProfessorAccent {
  const idx = normalizeProfPaletteIndex(paletteIndex);
  return planningAccentFromHue(PLANNING_PROF_PALETTE_HUES[idx]);
}

/**
 * Couleur carte planning : surcharge optionnelle en **degrés de teinte HSL** (0–360),
 * sinon teinte par défaut dérivée du `professeurId`.
 */
export function planningProfessorAccent(
  professeurId: string,
  hueOverrideDegrees: number | null | undefined
): PlanningProfessorAccent {
  if (hueOverrideDegrees != null && Number.isFinite(hueOverrideDegrees)) {
    return planningAccentFromHue(hueOverrideDegrees);
  }
  return planningAccentFromHue(defaultHueForProfesseur(professeurId));
}
