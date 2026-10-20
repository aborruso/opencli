# Evaluation

## Contents

- [aster vs the ISTAT SDMX endpoint (opensdmx)](#aster-vs-sdmx)
  - [Question](#question)
  - [What was measured](#measured)
  - [Where the 313 ASTer datasets sit on SDMX](#mapping)
  - [Same numbers?](#values)
  - [Freshness](#freshness)
  - [What only ASTer has](#only-aster)
  - [Ready-made tables](#ready-made)
  - [Conclusion](#conclusion)
  - [Limits](#limits)

<a id="aster-vs-sdmx"></a>
## aster vs the ISTAT SDMX endpoint (opensdmx)

Written 2026-10-20. Working files in `tmp/aster/` (`mapping.db`, `mapping.csv`, `unmatched.tsv`, the compared CSVs).

<a id="question"></a>
### Question

ASTer (aster.istat.it) and the ISTAT SDMX endpoint (`esploradati.istat.it/SDMXWS`, used through opensdmx) both serve ISTAT data. Does the `aster` plugin add anything, or is it enough to use opensdmx well?

<a id="measured"></a>
### What was measured

- The 313 distinct dataflows of the six ASTer atlases (`opencli aster datasets`, Italian catalogs), against the 4953 dataflows of agency `IT1` on the SDMX endpoint (`GET dataflow/IT1`).
- ASTer has no public SDMX REST (`/rest`, `/SDMXWS/rest` redirect to the error page). Behind its hub there is very likely an SDMX service: responses carry a `BackEndTimers` header with an `nsiResponse` entry, and ids and codelists have SDMX form.
- ASTer's territorial codelist `CL_AST_ITTER` does not exist on the SDMX endpoint (`GET codelist/IT1/CL_AST_ITTER` → 404). Every ASTer dataset uses it; the SDMX side uses `CL_ITTER107`.

<a id="mapping"></a>
### Where the 313 ASTer datasets sit on SDMX

| Match | Datasets | How |
|---|---|---|
| Same id | 113 | `26_29` = `26_29` |
| Id plus suffix | 3 | `DF_COMP_FRA_IND_MUNICIPAL` → `DF_COMP_FRA_IND_MUNICIPAL_01`; `DF_DCIS_INDDEMOG1_1` → `22_293_DF_DCIS_INDDEMOG1_1` |
| Same name, domain numbers moved | 35 | `DF_DCCV_CAVE_MIN_9_951` → `9_951_DF_DCCV_CAVE_MIN_1…5`: one ASTer dataset groups a whole family of SDMX tables (up to 16+ for `DF_DCSP_ICT_6_39`) |
| Same theme, other naming | ~140 (not matched one to one) | urban environment (`609_1_DF_DCCV_URBANENV_*`, 23 on SDMX), daily life survey AVQ (206 on SDMX), BES of the territories (`DF_BES_TERRIT*`), museums, schools, labour force, household projections |
| No SDMX counterpart found | ~30 | see [What only ASTer has](#only-aster) |

The first three rows (151) were matched by rule; the fourth by searching the SDMX ids for the family name, without checking each dataset.

<a id="values"></a>
### Same numbers?

Every value compared was identical:

- `26_29` Decessi: 54 cells (Piemonte, Sicilia, Sardegna × 3 indicators × 3 sexes × 2023-2024).
- `DF_COMP_FRA_IND_MUNICIPAL` vs `DF_COMP_FRA_IND_MUNICIPAL_01`: 104 cells (Palermo, Agliè × 13 indicators × 2018, 2019, 2021, 2022). Same indicator codelist `CL_CFI_INDICATORS`.
- `DF_CARTA_IDENTITA` population on 1 January vs `22_289`: 12 values (Palermo, Agliè, 2019-2024).

<a id="freshness"></a>
### Freshness

ASTer lags behind in two of the cases looked at:

- Population on 1 January: ASTer stops at 2024, `22_289` reaches 2026.
- Household projections: ASTer `DF_165_1167_DCIS_PREVFAM` covers 2023-2043; SDMX `165_1167` is the 2025-2050 edition.

The other compared datasets had the same years on both sides.

<a id="only-aster"></a>
### What only ASTer has

- **Sub-municipal areas** (atlas PERIFERIE, 15 datasets plus a note): 708 territories, the neighbourhoods of the metropolitan capitals (`58091089` Roma: Grottarossa Ovest, parent `058091`). No SDMX dataflow or codelist for them was found.
- **ASTI**, the atlas of infrastructures (10 datasets): indicators per theme assembled from several surveys (`ASTI_1_AMB` holds wastewater indicators that on SDMX are in `12_323_DF_DCCV_IMPDEP_*`). A composition, not a new source.
- **Municipal area** in `DF_CARTA_IDENTITA` (km², yearly since 1991): not found among the SDMX dataflows with the searches tried ("superficie", "superficie territoriale", "superficie comuni", "densità abitativa", "kmq").
- **One territorial hierarchy** for all levels, Italy to municipality (and to neighbourhood), with `parent` on every code: "all municipalities of province 082" is one `values` call and one `data` call.
- **Grouping and default views**: one dataset for a family of SDMX tables, and the filter the web table opens with.
- Methodological notes, microdata files and test datasets (~8), not data series.

<a id="ready-made"></a>
### Ready-made tables

Where SDMX splits a topic into many dataflows, ASTer often serves it as one dataset, which spares the analyst the merge:

- `DF_DCSP_ICT_6_39` (ICT in enterprises): one ASTer dataset with 448 indicators. On SDMX the same topic is 20 dataflows `6_39_DF_DCSP_ICT_1…` (main indicators, artificial intelligence, robotics and 3D printing, …), same indicator codelist `CL_VARICT`. Getting the whole picture from SDMX means 20 queries and a union.
- `DF_CARTA_IDENTITA`: population and area of every municipality, side by side, yearly since 1991. On SDMX the population is in `22_289`; the area was not found.
- The 35 families in the mapping table follow the same pattern: one ASTer dataset per family of SDMX tables.

The structure of each ASTer dataset (`dataset`) also comes with the default view of the web table, a reasonable first filter for someone who does not know the cube.

<a id="conclusion"></a>
### Conclusion

For a figure that exists on SDMX, opensdmx is the first choice: same numbers where compared, newer editions, the full catalog (4953 dataflows vs 313). Most of ASTer is a thematic and territorial presentation of data that is also on SDMX.

The `aster` plugin is worth keeping for a narrower set of uses:

- the sub-municipal indicators of the metropolitan capitals, found only on ASTer;
- the ASTI infrastructure indicators and the municipal area, not found on SDMX;
- territorial work at municipal level, where `CL_AST_ITTER` with its parents gives every municipality of a province or region in one step;
- ready-made tables for analysts who do not want to merge: one dataset where SDMX has a family of tables (see [Ready-made tables](#ready-made));
- discovery: 313 curated datasets are an easier entry point than 4953 dataflows. The mapping table above is the bridge from an ASTer dataset to its SDMX family, where the newer edition may be.

Use ASTer for those, and check the year coverage against SDMX before using an ASTer series that also exists there.

<a id="limits"></a>
### Limits

- Values were compared on three datasets out of 313.
- About 140 datasets were matched by theme only, not one to one.
- Freshness was checked on four datasets.
- The SDMX titles are in English and the ASTer titles in Italian, so no title matching was possible: some of the ~30 "ASTer only" may exist on SDMX under names not tried.
