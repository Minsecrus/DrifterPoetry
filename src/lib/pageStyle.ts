import { readFile } from "node:fs/promises";
import path from "node:path";

export interface PageStyleColors {
  background: string;
  surface: string;
  title: string;
  text: string;
  muted: string;
  faint: string;
  line: string;
  accent: string;
  accentSoft: string;
}

export interface PageStyle {
  colors: PageStyleColors;
  fontFamily: string;
}

export const defaultPageStyle: PageStyle = {
  colors: {
    background: "#fcfbfa",
    surface: "#fcfbfa",
    title: "#211e1a",
    text: "#211e1a",
    muted: "#7d756b",
    faint: "#b8aea1",
    line: "#ded5ca",
    accent: "#6f4e37",
    accentSoft: "#eee5dc",
  },
  fontFamily: "\"Libre Baskerville\", \"Noto Serif SC\", \"Songti SC\", Georgia, serif",
};

const stylePath = path.join(process.cwd(), "content", "style.json");
const colorKeys = Object.keys(defaultPageStyle.colors) as Array<keyof PageStyleColors>;
const colorPattern = /^#[0-9a-f]{6}$/i;

export async function loadPageStyle(): Promise<PageStyle> {
  try {
    return normalizePageStyle(JSON.parse(await readFile(stylePath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return defaultPageStyle;
    }
    throw error;
  }
}

export function normalizePageStyle(value: unknown): PageStyle {
  const input = isRecord(value) ? value : {};
  const inputColors = isRecord(input.colors) ? input.colors : {};
  const colors = { ...defaultPageStyle.colors };

  for (const key of colorKeys) {
    const color = inputColors[key];
    if (typeof color === "string" && colorPattern.test(color)) {
      colors[key] = color;
    }
  }

  return {
    colors,
    fontFamily: sanitizeFontFamily(input.fontFamily),
  };
}

export function pageStyleToCustomProperties(style: PageStyle): string {
  const normalized = normalizePageStyle(style);

  return [
    ["--bg", normalized.colors.background],
    ["--surface", normalized.colors.surface],
    ["--title", normalized.colors.title],
    ["--text", normalized.colors.text],
    ["--muted", normalized.colors.muted],
    ["--faint", normalized.colors.faint],
    ["--line", normalized.colors.line],
    ["--accent", normalized.colors.accent],
    ["--accent-soft", normalized.colors.accentSoft],
    ["--font-family", normalized.fontFamily],
  ]
    .map(([property, value]) => `${property}: ${value}`)
    .join("; ");
}

function sanitizeFontFamily(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    return defaultPageStyle.fontFamily;
  }

  const sanitized = value.replace(/[;{}<>]/g, "").trim();
  return sanitized || defaultPageStyle.fontFamily;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
