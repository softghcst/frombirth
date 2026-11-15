# Pathways

A text life simulation. One life, one year at a time.

Static site: plain HTML, CSS and ES modules. No build step, no dependencies.

## Play

- **GitHub Pages:** Settings → Pages → deploy from the branch root. All paths are relative.
- **iPad / iPhone:** open the Pages link in Safari → Share → Add to Home Screen. It runs full-screen.
- **Locally:** ES modules need a web server (`python3 -m http.server`), not `file://`.

Lives save automatically to the browser's `localStorage`.

## Layout

```
index.html, manifest.json, sw.js, icons/
css/            base, layout, components, modals
js/main.js      boot and screen routing
js/state.js     live GameState store
js/save.js      save slots and graveyard
js/rng.js       seeded RNG (state is saved with the game)
js/types.js     master schemas (JSDoc)
js/engine/      year processor, event engine, effects, conditions, generation,
                health, education, finance, relationships, death
js/data/        countries, traits, illnesses, events/
js/ui/          shell, avatar, modals, screens/, tabs/
```

## Adding events

Add an object to a file in `js/data/events/` (or a new file registered in
`events/index.js`). See `js/types.js` for the `GameEvent` schema and
`events/helpers.js` for the effect constructors.

## Status

Phase 1 of 10 is built: core engine, saves, graveyard, UI shell, and 44 branching events.
