# Factorio Item Browser — static fork

> **This is an independent fork** of
> [`factorio-item-browser/portal-frontend`](https://github.com/factorio-item-browser/portal-frontend),
> the frontend of the original [Factorio Item Browser](https://www.factorio-item-browser.com/).
> It is not affiliated with or endorsed by the original project, and it is not
> expected to merge back upstream — treat it as an independent line of
> development.

The fork converts the frontend into a **fully static single-page app**: a fixed
set of pre-generated data packs replaces the original's PHP backend, database
and per-user mod-combination system. No server components remain — the app
fetches its pack data from published URLs at runtime.

- Item, recipe and machine data is currently provided by
  [FactorioLab](https://factoriolab.github.io/)'s published datasets.
- **No game-derived data or assets are committed to this repository.**
- The design record and progress tracker lives in
  [`docs/static-fork.md`](docs/static-fork.md); agent guidance in
  [`CLAUDE.md`](CLAUDE.md).

## Attribution & licenses

- The source code is licensed GPL-3.0-or-later (see [LICENSE.md](LICENSE.md));
  the original code is © BluePsyduck and the portal-frontend contributors.
- Factorio content and images are owned by
  [Wube Software](https://www.factorio.com/) and the respective
  [mod authors](https://mods.factorio.com/).
- Runtime data is fetched from [FactorioLab](https://factoriolab.github.io/)'s
  published packs (an MIT-licensed project; the underlying game data remains
  Wube's and the mod authors').

## Development

Node 22 (CI matches):

```bash
npm install

npm start          # dev server
npm test           # tsc + jest + eslint
npm run build      # production build (reads ./.env; cp .env.development .env first)
```
