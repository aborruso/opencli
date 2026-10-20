# Future ideas

## aster

- **Geometries**: `POST https://aster.istat.it/api/geoglossary/geometry/{node}?format=geojson&geoLevel=&year=&codelistId=` returns the boundaries the atlas uses for its maps (e.g. `geoLevel=1&year=2024&codelistId=IT1+CL_AST_ITTER+1.0`, ~1.5 MB for the regions). Out of v1 by decision of 2026-10-20; a `geometry` command could join on the `TERRITORIO` codes of `data`.
