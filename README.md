# DrifterPoetry

DrifterPoetry is a static poetry site framework for a personal collection. The
first version keeps all content in JSON files and renders a pure static Astro
site that can be deployed to GitHub Pages.

## Modes

- Display mode: Astro builds static pages from `content/poems`.
- Writing mode: a local Deno API can create, edit, delete, reorder, and renumber
  poems by writing JSON files under `content/poems`.

## Project Structure

```text
content/
  poems/
    index.json
    {uuid}.json
server/
  writer.ts
scripts/
  validate.ts
src/
  lib/
    notes.ts
    poems.ts
  pages/
    index.astro
    poems/
      [uuid].astro
```

`content/poems/index.json` is the source of the linear poem order. Individual
poem files keep stable `uuid` values for links and mutable `number` values for
display order.

## Commands

```powershell
pnpm dev
pnpm build
pnpm preview
```

When Deno is installed:

```powershell
deno task validate
deno task build
deno task dev
```

`deno task dev` starts the local writer API and the Astro dev server together.
The writer API listens only on `127.0.0.1:8787` and is not included in the
static build output.
