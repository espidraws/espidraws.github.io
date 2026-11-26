// @ts-check
import { defineConfig, envField } from "astro/config";

export default defineConfig({
    site: process.env.SITE_URL ?? "https://espidraws.github.io",
    base: process.env.BASE_PATH ?? "/",
    env: {
        schema: {
            YOUTUBE_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
        },
    },
});
