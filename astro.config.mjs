// @ts-check
import { defineConfig } from "astro/config";

export default defineConfig({
    site: process.env.SITE_URL ?? "https://espidraws.github.io",
    base: process.env.BASE_PATH ?? "/",
});
