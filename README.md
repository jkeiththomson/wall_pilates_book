# populate.jsx zero-base workflow

This script builds a new InDesign output document from `assets/data.csv`. For each CSV row, it selects one one-page template from `assets/templates`, imports that template page, and populates the page from mapped CSV fields.

## Project structure

```text
keith_project/
├── assets/
│   ├── data.csv
│   ├── mappings.csv
│   ├── placeholder.jpg
│   ├── qr_placeholder.png
│   ├── illustrations/
│   ├── QRcodes/                 optional
│   └── templates/
│       ├── template-1-h.indd
│       ├── template-1-v.indd
│       ├── template-2-h.indd
│       ├── template-2-v.indd
│       ├── template-3-h.indd
│       ├── template-3-v.indd
│       ├── template-4-h.indd
│       ├── template-4-v.indd
│       ├── template-5-h.indd
│       ├── template-5-v.indd
│       ├── template-6-h.indd
│       └── template-6-v.indd
└── scripts/
    └── populate.jsx
```

## Hardcoded project folder

At the top of `populate.jsx`:

```javascript
var PROJECT_FOLDER_PATH = "/Users/keith/dev/ww/wall_pilates_book/keith_project";
```

Change this only if the project folder moves.

## Template rules

Templates must be in:

```text
assets/templates/
```

Templates are not allowed directly inside:

```text
assets/
```

The required template names are exactly:

```text
template-1-h.indd ... template-6-h.indd
template-1-v.indd ... template-6-v.indd
```

Each template must contain exactly one page.

## data.csv columns

The header row must be exactly:

```csv
num,title,subtitle,level,reps_label,reps,works,benefits,imagery,placement,movement,breath,tips,caution,thumb1,thumb2,thumb3,thumb4,thumb5,thumb6,qr_code
```

The script is intentionally strict about these names.

## mappings.csv format

`mappings.csv` is vertical and must start with:

```csv
source,frame
```

Example:

```csv
source,frame
title,TitleFrame
level,LevelFrame
reps_label,RepsLabelFrame
reps,RepsFrame
works,WorksFrame
benefits,BenefitsFrame
imagery,ImageryTextFrame
tips,TipsFrame
caution,CautionFrame
thumb1,Thumbnail1Frame
thumb2,Thumbnail2Frame
thumb3,Thumbnail3Frame
thumb4,Thumbnail4Frame
thumb5,Thumbnail5Frame
thumb6,Thumbnail6Frame
qr_code,QRCodeFrame
placement,PlacementFrame
movement,MovementFrame
breath,BreathFrame
```

`num` and `subtitle` are not copied directly. `num` is control data. `subtitle` is combined with `title` in `TitleFrame`.

## Title behavior

The title is composed as:

```text
title | subtitle
```

Required character styles in the template/output document:

```text
ExerciseTitle
ExerciseSubtitle
```

The left title text uses `ExerciseTitle`. The separator and subtitle use `ExerciseSubtitle`.

## Instructions behavior

The script combines these source fields:

```text
placement
movement
breath
```

into the template frame:

```text
InstructionsFrame
```

It uses `PlacementFrame` and `BreathFrame` to set the bounds of `InstructionsFrame`.

Required paragraph styles:

```text
InstructionsHeader
InstructionsBodyPlain
```

Instruction sections are written as:

```text
Placement
<body lines>
Movement
<body lines>
Breath
<body lines>
```

Body lines beginning with `*` become bullets. Body lines beginning with `1.`, `2.`, etc. become numbered list items.

## Thumbnail behavior

Thumbnail filenames come from `thumb1` through `thumb6`.

Rules:

- Each row must have 1 to 6 thumbnails.
- Thumbnail cells must be consecutive starting at `thumb1`.
- Thumbnail files must live in `assets/illustrations`.
- The template is selected by thumbnail count and by the orientation of the first thumbnail.

Example:

- 3 thumbnails
- first thumbnail is horizontal

The script uses:

```text
assets/templates/template-3-h.indd
```

## QR behavior

If `qr_code` is blank or not found, the script uses:

```text
assets/qr_placeholder.png
```

If `qr_code` is present, the script looks first in `assets/`, then in `assets/QRcodes/`.

## Running the script

Open InDesign and run `populate.jsx`.

You do not need to open a template first. The script creates a new output document and imports the required template page for each CSV row.

## Output

The script creates a new unsaved InDesign document and reports how many rows were populated.

## Template preflight

`populate.jsx` runs template preflight automatically at startup. There is no separate validator to run.

The preflight enforces these rules:

- Templates must be in `assets/templates/`.
- The only `.indd` files allowed in `assets/templates/` are `template-1-h.indd` through `template-6-h.indd` and `template-1-v.indd` through `template-6-v.indd`.
- No `.indd` files are allowed directly inside `assets/`.
- Non-template InDesign files that need to be kept should go in `assets/Extra INDDs/`; Populate ignores that folder.

If preflight fails, Populate stops before creating pages and reports the missing or unexpected files.
