// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://minsecrus.github.io",
  base: "/DrifterPoetry",
  output: process.env.NODE_ENV === "production" ? "static" : "server",
});
