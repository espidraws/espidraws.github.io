# Espi Draws

Portfolio site built with [Astro](https://astro.build), published on GitHub Pages.

## Editing content

Go to [app.pagescms.org](https://app.pagescms.org), sign in with GitHub and open this repository.
Every save is a commit; the site updates about two minutes later.

| Section | File |
|---|---|
| Thumbnail carousels | `src/content/thumbnails.json` |
| Client reviews | `src/content/reviews.json` |
| OC designs | `src/content/oc-designs.json` |
| Site texts and links | `src/content/site.json` |

Images live in `public/uploads/`. Thumbnails should be 1280×720.

## Working on the code

Requires Node.js 22.23 or newer.

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # output in dist/
```
