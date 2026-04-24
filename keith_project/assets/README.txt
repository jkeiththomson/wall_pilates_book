INDESIGN POPULATE SETUP (STRICT MODE)

REQUIRED FILES IN YOUR ASSETS FOLDER:

- data.csv (you provide)
- mappings.csv (included here)
- placeholder.jpg (you provide)
- qr_placeholder.png (you provide)

REQUIRED FOLDERS:
- illustrations/
- QRcodes/ (optional)

FOLDER STRUCTURE:

assets/
  data.csv
  mappings.csv
  placeholder.jpg
  qr_placeholder.png
  illustrations/
  QRcodes/

RULES:
- CSV headers must match EXACTLY
- mappings.csv must match EXACTLY
- InDesign frame names or labels must match EXACTLY
- No missing or extra columns
- No duplicate frames

SCRIPT:
Use populate_strict_baseline_v4.jsx
