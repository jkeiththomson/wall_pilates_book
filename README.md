# Wall Pilates Book Generator

An Adobe InDesign automation project that builds exercise-book pages from CSV data. The ExtendScript program selects a one-page InDesign template for each record, inserts text and images into named frames, and creates a new InDesign document.

## Current status

This archive is a working-project snapshot, not a complete reproducible release.

- The project includes source CSVs, 12 page templates, placeholder and sample artwork, the `populate.jsx` script, older working files, and generated InDesign output.
- The newest included output log says a separate script generated a 120-page document (`119` populated pages and `1` blank page) on August 10, 2026.
- That exact generator is **missing**. Its log mentions output saving, log writing, blank-page handling, and level-circle handling that are not implemented by the included `scripts/populate.jsx`.
- The packaged `populate.jsx` had broken hardcoded paths. This copy now resolves the project folder automatically and uses the actual packaged `assets/csv`, `assets/placeholders`, and `assets/qr_codes` locations.
- The script has not been executed here because it requires desktop Adobe InDesign.

Keep the existing generated files until the current script has been tested in InDesign and the missing production generator has been recovered or rebuilt.

## Requirements

- Adobe InDesign with ExtendScript/JSX support
- The fonts, links, color profiles, and other resources used by the `.indd` templates
- Read/write access to the project folder

No Node, Python, package manager, build command, or web service is involved.

## Quick start

1. Make a backup of the entire project.
2. Open Adobe InDesign.
3. Open **Window → Utilities → Scripts** (the menu wording can vary by InDesign version).
4. Add or reveal `scripts/populate.jsx` in the Scripts panel.
5. For a first test, change `MAX_ROWS` near the top of the script from `null` to `1`.
6. Run `populate.jsx`.
7. Inspect the new unsaved document, fix missing fonts/links or overset text, and save it manually.
8. Restore `MAX_ROWS = null` only after the one-row test succeeds.

The included script creates a new document but does **not** choose an output filename, save it, or write a log.

## How it works

For every row in `assets/csv/data.csv`, the script:

1. Validates the exact CSV header and the source-to-frame mappings.
2. Counts consecutive image names in `thumb1` through `thumb6`.
3. Opens the first thumbnail briefly to determine horizontal (`h`) or vertical (`v`) orientation.
4. Chooses `assets/templates/template-<count>-<orientation>.indd`.
5. Duplicates that template's single page into a new output document.
6. Finds page items by their InDesign object name or script label.
7. Inserts mapped text, thumbnails, and a QR image.
8. Combines `title` and `subtitle` into the title frame.
9. Combines placement, movement, and breath content into `InstructionsFrame` and applies paragraph styles.
10. Removes InDesign's initial blank page when generation is complete.

## Project layout

```text
wall_pilates_book/
├── README.md
├── scripts/
│   ├── populate.jsx              current documented generator
│   └── copy12.jsx                small page-copy experiment; not part of the workflow
├── assets/
│   ├── csv/
│   │   ├── data.csv              book content (120 logical records in this snapshot)
│   │   ├── mappings.csv          CSV column → InDesign frame mapping
│   │   └── *.numbers             editable Apple Numbers source files
│   ├── illustrations/            thumbnail artwork referenced by data.csv
│   ├── placeholders/             fallback artwork and QR placeholder
│   ├── qr_codes/                 optional per-row QR artwork (currently empty)
│   ├── templates/                12 active one-page InDesign templates
│   └── ref1.png                  reference image; not used by populate.jsx
├── output/                       generated InDesign documents and historical logs
├── templates/                    older/experimental master files; not used by populate.jsx
└── extras/                       older InDesign/Photoshop/JPEG experiments; not used
```

Only `scripts/populate.jsx`, `assets/csv`, `assets/illustrations`, `assets/placeholders`, and `assets/templates` participate in the documented workflow.

## CSV contract

`data.csv` must contain these 21 columns in exactly this order:

```csv
num,title,subtitle,level,reps_label,reps,works,benefits,imagery,placement,movement,breath,tips,caution,thumb1,thumb2,thumb3,thumb4,thumb5,thumb6,qr_code
```

Important rules:

- `num` cannot be blank.
- Each row needs 1–6 thumbnails.
- Thumbnail names must be consecutive from `thumb1`; a value in `thumb3` is invalid if `thumb2` is blank.
- Thumbnail files are resolved under `assets/illustrations`.
- `title` and `subtitle` are combined as `title | subtitle`.
- Instruction lines beginning with `*` become bullets; lines beginning with `1.` through `9.` become numbered items.
- CSV files must be UTF-8 and use standard CSV quoting for commas, quotes, or line breaks inside cells.

`mappings.csv` begins with `source,frame`. Every non-control data column must have a mapping. A frame is found by either its InDesign object name or script label, and each required name must occur exactly once on the selected page.

## Template contract

`assets/templates` must contain exactly these files and no other `.indd` files:

```text
template-1-h.indd … template-6-h.indd
template-1-v.indd … template-6-v.indd
```

Every template must contain exactly one page and all frames required by `mappings.csv` for the fields used on that page. It must also provide:

- Character styles: `ExerciseTitle`, `ExerciseSubtitle`
- Paragraph styles: `InstructionsHeader`, `InstructionsBodyPlain`
- A uniquely named or labeled `InstructionsFrame`
- Named/labeled `PlacementFrame` and `BreathFrame`; their bounds define the combined instructions area

Templates with fewer than six image slots do not need unused thumbnail frames; the repaired script skips blank thumbnail fields.

## QR behavior

If `qr_code` has a value, the script searches first under `assets/`, then under `assets/qr_codes/`. If it is blank or not found, it uses `assets/placeholders/qr_placeholder.png`.

The `assets/qr_codes` folder is empty in this snapshot, so all current QR references should be checked before production.

## Known gaps and risks

1. **Missing production script.** `output/book_all_rows_v76_log.txt` could not have been produced by the included `populate.jsx`. Recover the exact v76 script from the machine or backup used on August 10, 2026.
2. **Unverified script execution.** A real InDesign run is still required. Binary `.indd` structure, template frame names, styles, fonts, image links, and overset text cannot be fully verified from the archive alone.
3. **The current data fails the included script's strict rules.** Record 7 (`combo 1`, physical CSV row 8) has no thumbnails, so generation stops there. The v76 generator instead created a blank page for it; that behavior is absent from the included script.
4. **Missing thumbnail assets.** Records 8–13 contain 21 references to literal filenames such as `thumb1` through `thumb6`, but no files with those names exist in `assets/illustrations`. These may be intended placeholder markers; the production behavior needs to be recovered or defined.
5. **Editorial cleanup.** The 120-record dataset contains 32 blank `level` values plus draft titles, spelling errors, duplicates, and production notes embedded in titles. The content needs editorial review before publication.
6. **No automated preflight outside InDesign.** There are no tests or standalone validator for CSV/image/template consistency.
7. **No versioned release notes.** Output names refer to v75/v76, but the corresponding source versions and change history are absent.
8. **No licensing or publishing metadata.** The archive does not state ownership/licensing for artwork, fonts, exercise content, QR destinations, or print/export specifications.

## Recommended next steps

1. Recover and archive the exact generator that created v76.
2. Decide whether the production source is the first 120 rows or all 1,155 rows.
3. Run a one-row InDesign smoke test with this repaired `populate.jsx`.
4. Add a read-only preflight tool that reports missing images, invalid levels, duplicate IDs/titles, zero-thumbnail rows, and unused assets before InDesign runs.
5. Clean and approve the CSV editorially.
6. Define a release process: source version, output filename, log, PDF export settings, fonts, bleed, color profile, and final QA checklist.
7. After validation, move historical experiments into a clearly labeled archive or remove them from the production package.

## Git status

The supplied ZIP contained no `.git` directories, submodule/worktree `.git` files, `.gitmodules`, or `.gitattributes`. This cleaned project copy also removes the original `.gitignore`, so it contains no Git metadata or Git control files. Plain words such as “Git” in this README are documentation only.
