# Future ideas

## aster

- **Geometries**: `POST https://aster.istat.it/api/geoglossary/geometry/{node}?format=geojson&geoLevel=&year=&codelistId=` returns the boundaries the atlas uses for its maps (e.g. `geoLevel=1&year=2024&codelistId=IT1+CL_AST_ITTER+1.0`, ~1.5 MB for the regions). Out of v1 by decision of 2026-10-20; a `geometry` command could join on the `TERRITORIO` codes of `data`.

## opentender

- **Download**: `POST https://api.opentender.eu/api/<cc>/tender/download/csv` (or `/json`) with a search body answers `{data:{id}}`; `GET /api/<cc>/download/id/<id>` within 60 s returns a gzip of a `;`-separated CSV, one row per tender, lot and bid (Palantir: 20 KB gzip, 143 KB). Out of v1 by decision of 2026-11-04.
- **Stats endpoints**: `tender/stats`, `company/stats`, `authority/stats`, `market/stats`, `region/stats`, `indicators/*` (POST, same filter body) give the aggregations the portal's dashboards draw. Not probed.
