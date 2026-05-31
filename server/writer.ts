interface PoemIndex {
  poems: Array<{ uuid: string }>;
}

interface Poem {
  uuid: string;
  number: number;
  title: string;
  body: string;
  notes: unknown[];
}

interface PageStyleColors {
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

interface PageStyle {
  colors: PageStyleColors;
  fontFamily: string;
}

const host = "127.0.0.1";
const port = 8787;
const poemsDir = new URL("../content/poems/", import.meta.url);
const styleUrl = new URL("../content/style.json", import.meta.url);
const defaultPageStyle: PageStyle = {
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
const styleColorKeys = Object.keys(defaultPageStyle.colors) as Array<keyof PageStyleColors>;
const colorPattern = /^#[0-9a-f]{6}$/i;

Deno.serve({ hostname: host, port }, async (request) => {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return json(null, 204);
  }

  try {
    if (url.pathname === "/api/poems" && request.method === "GET") {
      return json(await readPoems());
    }

    if (url.pathname === "/api/poems" && request.method === "POST") {
      const input = await request.json() as Partial<Pick<Poem, "title" | "body">>;
      const poem = await createPoem(input);
      return json(poem, 201);
    }

    const poemMatch = url.pathname.match(/^\/api\/poems\/([^/]+)$/);
    if (poemMatch && request.method === "PUT") {
      const input = await request.json() as Partial<Pick<Poem, "title" | "body">>;
      return json(await updatePoem(poemMatch[1], input));
    }

    if (poemMatch && request.method === "DELETE") {
      await deletePoem(poemMatch[1]);
      return json({ ok: true });
    }

    if (url.pathname === "/api/reorder" && request.method === "POST") {
      const input = await request.json() as { uuids?: unknown };
      return json(await reorderPoems(input.uuids));
    }

    if (url.pathname === "/api/style" && request.method === "GET") {
      return json(await readPageStyle());
    }

    if (url.pathname === "/api/style" && request.method === "PUT") {
      const input = await request.json();
      const style = normalizePageStyle(input);
      await writePageStyle(style);
      return json(style);
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

console.log(`DrifterPoetry writer listening at http://${host}:${port}`);

async function readPoems(): Promise<Poem[]> {
  const index = await readIndex();
  const poems = await Promise.all(index.poems.map(({ uuid }) => readPoem(uuid)));
  return poems.sort((a, b) => a.number - b.number);
}

async function createPoem(input: Partial<Pick<Poem, "title" | "body">>): Promise<Poem> {
  const index = await readIndex();
  const uuid = crypto.randomUUID();
  index.poems.push({ uuid });

  const poem: Poem = {
    uuid,
    number: index.poems.length,
    title: input.title ?? "",
    body: input.body ?? "",
    notes: [],
  };

  await writePoem(poem);
  await writeIndex(index);
  await renumberPoems();
  return readPoem(uuid);
}

async function updatePoem(uuid: string, input: Partial<Pick<Poem, "title" | "body">>): Promise<Poem> {
  const poem = await readPoem(uuid);
  const updated = {
    ...poem,
    title: typeof input.title === "string" ? input.title : poem.title,
    body: typeof input.body === "string" ? input.body : poem.body,
  };
  await writePoem(updated);
  return updated;
}

async function deletePoem(uuid: string): Promise<void> {
  const index = await readIndex();
  index.poems = index.poems.filter((entry) => entry.uuid !== uuid);
  await writeIndex(index);
  await Deno.remove(new URL(`${uuid}.json`, poemsDir));
  await renumberPoems();
}

async function reorderPoems(uuids: unknown): Promise<Poem[]> {
  if (!Array.isArray(uuids) || !uuids.every((uuid) => typeof uuid === "string")) {
    throw new Error("uuids must be an array of strings.");
  }

  const current = await readIndex();
  const currentSet = new Set(current.poems.map((entry) => entry.uuid));
  const nextSet = new Set(uuids);

  if (currentSet.size !== nextSet.size || [...currentSet].some((uuid) => !nextSet.has(uuid))) {
    throw new Error("reorder request must contain exactly the current poem UUIDs.");
  }

  await writeIndex({ poems: uuids.map((uuid) => ({ uuid })) });
  return renumberPoems();
}

async function renumberPoems(): Promise<Poem[]> {
  const index = await readIndex();
  const poems: Poem[] = [];

  for (const [position, entry] of index.poems.entries()) {
    const poem = await readPoem(entry.uuid);
    poem.number = position + 1;
    await writePoem(poem);
    poems.push(poem);
  }

  return poems;
}

async function readIndex(): Promise<PoemIndex> {
  return readJson<PoemIndex>(new URL("index.json", poemsDir));
}

async function writeIndex(index: PoemIndex): Promise<void> {
  await writeJson(new URL("index.json", poemsDir), index);
}

async function readPoem(uuid: string): Promise<Poem> {
  return readJson<Poem>(new URL(`${uuid}.json`, poemsDir));
}

async function writePoem(poem: Poem): Promise<void> {
  await writeJson(new URL(`${poem.uuid}.json`, poemsDir), poem);
}

async function readJson<T>(url: URL): Promise<T> {
  return JSON.parse(await Deno.readTextFile(url)) as T;
}

async function writeJson(url: URL, value: unknown): Promise<void> {
  await Deno.writeTextFile(url, `${JSON.stringify(value, null, 2)}\n`);
}

async function readPageStyle(): Promise<PageStyle> {
  try {
    return normalizePageStyle(await readJson<unknown>(styleUrl));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return defaultPageStyle;
    }
    throw error;
  }
}

async function writePageStyle(style: PageStyle): Promise<void> {
  await writeJson(styleUrl, normalizePageStyle(style));
}

function normalizePageStyle(value: unknown): PageStyle {
  const input = isRecord(value) ? value : {};
  const inputColors = isRecord(input.colors) ? input.colors : {};
  const colors = { ...defaultPageStyle.colors };

  for (const key of styleColorKeys) {
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

function json(body: unknown, status = 200): Response {
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });

  if (status === 204) {
    return new Response(null, { status, headers });
  }

  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}
