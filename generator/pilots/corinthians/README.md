# Corinthians parish pilot

Build the 1 and 2 Corinthians study game from the repository root.

```sh
node generator/pilots/corinthians/build-site.mjs
python -m http.server --directory generator/pilots/corinthians/_site 8000
```

The build starts with the shared engine and overlays the parish runtime in
`assets/` and the pilot pages in this directory. The generated `_site/` is the
Firebase Hosting directory for `bible-bowl-study`.

Question cards are stored in `questions.seed.json`. Pilot cards are visible
when `publicPilot` is enabled. The weekly reading plan and the parish lesson
are assembled into the site's data directory.
