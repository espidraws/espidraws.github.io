import { defineCollection } from "astro:content";
import { file } from "astro/loaders";
import { z } from "astro/zod";

const link = z.object({
    label: z.string(),
    url: z.url(),
});

// Each JSON file is edited as a whole by Pages CMS, so it becomes a single entry.
const loadWholeFile = (path: string) =>
    file(path, { parser: (text) => [{ id: "main", content: JSON.parse(text) }] });

const site = defineCollection({
    loader: loadWholeFile("src/content/site.json"),
    schema: z.object({
        content: z.object({
            name: z.string(),
            tagline: z.string(),
            avatar: z.string(),
            socials: z.array(link),
            buttons: z.array(link.extend({ color: z.enum(["blue", "red", "green"]) })),
            contactUrl: z.url(),
            thumbnails: z.object({
                title: z.string(),
                subtitle: z.string(),
                deal: z.string(),
                notes: z.array(z.string()),
            }),
        }),
    }),
});

const ocDesigns = defineCollection({
    loader: loadWholeFile("src/content/oc-designs.json"),
    schema: z.object({
        content: z.object({
            title: z.string(),
            image: z.string(),
            imageAlt: z.string(),
            styles: z.array(
                z.object({
                    name: z.string(),
                    head: z.string(),
                    half: z.string(),
                    full: z.string(),
                }),
            ),
            notes: z.array(z.string()),
        }),
    }),
});

const thumbnails = defineCollection({
    loader: loadWholeFile("src/content/thumbnails.json"),
    schema: z.object({
        content: z.array(
            z.object({
                label: z.string(),
                badge: z.string().optional(),
                price: z.string(),
                items: z.array(z.object({ title: z.string(), image: z.string() })),
            }),
        ),
    }),
});

const reviews = defineCollection({
    loader: loadWholeFile("src/content/reviews.json"),
    schema: z.object({
        content: z.array(
            z.object({
                name: z.string(),
                subscribers: z.string(),
                quote: z.string(),
                avatar: z.string(),
            }),
        ),
    }),
});

export const collections = { site, ocDesigns, thumbnails, reviews };
