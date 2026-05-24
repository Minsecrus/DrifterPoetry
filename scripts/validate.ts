import { parseNotesDsl } from "../src/lib/notes.ts";

interface PoemIndexEntry {
  uuid: unknown;
}

interface Poem {
  uuid?: unknown;
  number?: unknown;
  title?: unknown;
  body?: unknown;
  notes?: unknown;
}

const poemsDir = new URL("../content/poems/", import.meta.url);
const errors: string[] = [];

await validate();

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} error(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  Deno.exit(1);
}

console.log("DrifterPoetry content is valid.");

async function validate(): Promise<void> {
  const index = await readJson<{ poems?: PoemIndexEntry[] }>(new URL("index.json", poemsDir));

  if (!Array.isArray(index.poems)) {
    errors.push("content/poems/index.json must contain a poems array.");
    return;
  }

  const seen = new Set<string>();
  const poems: Poem[] = [];

  for (const [position, entry] of index.poems.entries()) {
    if (typeof entry.uuid !== "string" || entry.uuid.trim() === "") {
      errors.push(`index.json poems[${position}] must contain a non-empty uuid.`);
      continue;
    }

    if (seen.has(entry.uuid)) {
      errors.push(`uuid "${entry.uuid}" is duplicated in index.json.`);
      continue;
    }

    seen.add(entry.uuid);

    const poemUrl = new URL(`${entry.uuid}.json`, poemsDir);
    try {
      const poem = await readJson<Poem>(poemUrl);
      poems.push(poem);
      validatePoem(poem, entry.uuid, position + 1);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        errors.push(`index.json references missing poem file: ${entry.uuid}.json.`);
      } else {
        errors.push(`could not read ${entry.uuid}.json: ${String(error)}`);
      }
    }
  }

  const poemUuidSet = new Set<string>();
  for (const poem of poems) {
    if (typeof poem.uuid !== "string") {
      continue;
    }
    if (poemUuidSet.has(poem.uuid)) {
      errors.push(`uuid "${poem.uuid}" is duplicated across poem files.`);
    }
    poemUuidSet.add(poem.uuid);
  }
}

function validatePoem(poem: Poem, expectedUuid: string, expectedNumber: number): void {
  const label = `${expectedUuid}.json`;

  if (poem.uuid !== expectedUuid) {
    errors.push(`${label} uuid must match its index entry.`);
  }

  if (poem.number !== expectedNumber) {
    errors.push(`${label} number must be ${expectedNumber}.`);
  }

  if (typeof poem.title !== "string") {
    errors.push(`${label} title must be a string, even when empty.`);
  }

  if (typeof poem.body !== "string") {
    errors.push(`${label} body must be a string.`);
  } else {
    try {
      parseNotesDsl(poem.body);
    } catch (error) {
      errors.push(`${label} body has invalid note DSL: ${String(error)}`);
    }
  }

  if (!Array.isArray(poem.notes)) {
    errors.push(`${label} notes must be an array.`);
  }
}

async function readJson<T>(url: URL): Promise<T> {
  return JSON.parse(await Deno.readTextFile(url)) as T;
}
