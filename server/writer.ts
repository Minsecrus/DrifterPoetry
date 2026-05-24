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

const host = "127.0.0.1";
const port = 8787;
const poemsDir = new URL("../content/poems/", import.meta.url);

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
