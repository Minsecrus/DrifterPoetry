import { readFile } from "node:fs/promises";
import path from "node:path";

export interface PoemIndexEntry {
  uuid: string;
}

export interface Poem {
  uuid: string;
  number: number;
  title: string;
  body: string;
  notes: unknown[];
}

export interface PoemForList {
  uuid: string;
  number: number;
  title: string;
  href: string;
}

const poemsDir = path.join(process.cwd(), "content", "poems");

export async function loadPoemIndex(): Promise<PoemIndexEntry[]> {
  const indexPath = path.join(poemsDir, "index.json");
  const index = JSON.parse(await readFile(indexPath, "utf8")) as {
    poems?: PoemIndexEntry[];
  };

  return Array.isArray(index.poems) ? index.poems : [];
}

export async function loadPoem(uuid: string): Promise<Poem> {
  const poemPath = path.join(poemsDir, `${uuid}.json`);
  return JSON.parse(await readFile(poemPath, "utf8")) as Poem;
}

export async function loadPoems(): Promise<Poem[]> {
  const index = await loadPoemIndex();
  const poems = await Promise.all(index.map((entry) => loadPoem(entry.uuid)));
  return poems.sort((a, b) => a.number - b.number);
}

export async function loadPoemList(): Promise<PoemForList[]> {
  const poems = await loadPoems();
  return poems.map((poem) => ({
    uuid: poem.uuid,
    number: poem.number,
    title: poem.title,
    href: getPoemHref(poem.uuid),
  }));
}

export function getPoemDisplayTitle(poem: Pick<Poem, "number" | "title">): string {
  return poem.title.trim() || String(poem.number);
}

export function getPoemHref(uuid: string): string {
  return withBase(`poems/${uuid}/`);
}

export function withBase(pathname = ""): string {
  const base = import.meta.env.BASE_URL;
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  return `${normalizedBase}${normalizedPath}`;
}
