#target "InDesign"

/*
  Validate active InDesign template against the label-based populate.jsx pipeline.

  This validator checks:
  1. data.csv exists at a hardcoded path.
  2. required headers exist in data.csv.
  3. every mapped frame label exists in the open INDD.
  4. duplicate labels in the INDD.
  5. required paragraph styles exist.

  IMPORTANT:
  - Open your master style template INDD first.
  - Edit ASSETS_FOLDER below.
  - This validator assumes labels are the canonical identifiers.
*/

(function () {
    if (app.documents.length === 0) {
        alert("Open your master style template INDD first, then run this script.");
        return;
    }

    var doc = app.activeDocument;

    // ============================================================
    // HARD-CODE YOUR ASSETS FOLDER HERE
    // Example:
    // "/Users/keith/dev/xx/wall_pilates_book/book_project/assets"
    // ============================================================
    var ASSETS_FOLDER = "/Users/keith/dev/xx/wall_pilates_book/book_project/assets";

    var base = Folder(ASSETS_FOLDER);
    if (!base.exists) {
        alert(
            "Assets folder not found.\r\n\r\n" +
            "Update ASSETS_FOLDER near the top of the script.\r\n\r\n" +
            "Current value:\r\n" + ASSETS_FOLDER
        );
        return;
    }

    var dataCSV = File(base.fsName + "/data.csv");
    if (!dataCSV.exists) {
        alert("Missing data.csv in hardcoded assets folder:\r\n" + dataCSV.fsName);
        return;
    }

    var map = {
        title: "TitleFrame",
        level_label: "LevelLabelFrame",
        level: "LevelFrame",
        reps_label: "RepsLabelFrame",
        reps: "RepsFrame",
        works: "WorksFrame",
        benefits: "BenefitsFrame",
        imagery: "ImageryFrame",
        thumb1: "Thumb1Frame",
        thumb2: "Thumb2Frame",
        thumb3: "Thumb3Frame",
        placement: "PlacementFrame",
        movement: "MovementFrame",
        breath: "BreathFrame",
        tips: "TipsFrame",
        caution: "CautionFrame",
        qr_code: "QRCodeFrame"
    };

    var requiredHeaders = [
        "title","level_label","level","reps_label","reps",
        "works","benefits","imagery",
        "thumb1","thumb2","thumb3",
        "placement","movement","breath",
        "tips","caution","qr_code"
    ];

    var requiredParagraphStyles = [
        "BodyHeader",
        "BodyCopy"
    ];

    function trim(s) {
        return String(s).replace(/^\s+|\s+$/g, "");
    }

    function normalizeHeader(s) {
        return trim(String(s).replace(/^\uFEFF/, ""));
    }

    function parseCSVLine(line) {
        var result = [], current = "", inQuotes = false;
        for (var i = 0; i < line.length; i++) {
            var ch = line.charAt(i), next = line.charAt(i + 1);
            if (ch === '"') {
                if (inQuotes && next === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === "," && !inQuotes) {
                result.push(current);
                current = "";
            } else {
                current += ch;
            }
        }
        result.push(current);
        return result;
    }

    function readTextFile(file) {
        file.encoding = "UTF-8";
        if (!file.open("r")) {
            throw new Error("Could not open file: " + file.fsName);
        }
        var txt = file.read();
        file.close();
        return txt;
    }

    function readCSVHeaders(file) {
        var raw = readTextFile(file);
        raw = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        var lines = raw.split("\n");
        var cleaned = [];
        for (var i = 0; i < lines.length; i++) {
            if (trim(lines[i]) !== "") cleaned.push(lines[i]);
        }
        if (cleaned.length < 1) {
            throw new Error("data.csv is empty: " + file.fsName);
        }

        var headers = parseCSVLine(cleaned[0]);
        var out = [];
        for (var j = 0; j < headers.length; j++) {
            out.push(normalizeHeader(headers[j]));
        }
        return out;
    }

    function uniqueSorted(arr) {
        var seen = {};
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var k = String(arr[i]);
            if (!seen.hasOwnProperty(k)) {
                seen[k] = true;
                out.push(k);
            }
        }
        out.sort();
        return out;
    }

    function getDocLabels(documentRef) {
        var items = documentRef.allPageItems;
        var labels = [];
        var duplicateLabels = {};
        var labelCounts = {};
        var blankLabelCount = 0;
        var i, item, lb;

        for (i = 0; i < items.length; i++) {
            item = items[i];
            try { lb = trim(item.label); } catch (e) { lb = ""; }

            if (lb !== "") {
                labels.push(lb);
                if (!labelCounts.hasOwnProperty(lb)) labelCounts[lb] = 0;
                labelCounts[lb]++;
            } else {
                blankLabelCount++;
            }
        }

        for (lb in labelCounts) {
            if (labelCounts.hasOwnProperty(lb) && labelCounts[lb] > 1) {
                duplicateLabels[lb] = labelCounts[lb];
            }
        }

        return {
            labels: uniqueSorted(labels),
            duplicateLabels: duplicateLabels,
            blankLabelCount: blankLabelCount
        };
    }

    function subtract(a, b) {
        var mapObj = {};
        var out = [];
        for (var i = 0; i < b.length; i++) mapObj[b[i]] = true;
        for (var j = 0; j < a.length; j++) {
            if (!mapObj[a[j]]) out.push(a[j]);
        }
        return out;
    }

    function collectionHasByName(collection, name) {
        try {
            var item = collection.itemByName(name);
            return item.isValid;
        } catch (e) {
            return false;
        }
    }

    function validateStyles(documentRef) {
        var missingParagraph = [];
        for (var i = 0; i < requiredParagraphStyles.length; i++) {
            if (!collectionHasByName(documentRef.paragraphStyles, requiredParagraphStyles[i])) {
                missingParagraph.push(requiredParagraphStyles[i]);
            }
        }
        return {
            missingParagraph: missingParagraph
        };
    }

    function getMappedFrameLabels(mapObj) {
        var out = [];
        for (var k in mapObj) {
            if (mapObj.hasOwnProperty(k)) out.push(mapObj[k]);
        }
        out.sort();
        return out;
    }

    function getMapKeys(mapObj) {
        var out = [];
        for (var k in mapObj) {
            if (mapObj.hasOwnProperty(k)) out.push(k);
        }
        out.sort();
        return out;
    }

    function formatList(title, arr) {
        var s = title + " (" + arr.length + ")\n";
        if (arr.length === 0) {
            s += "  - none\n\n";
            return s;
        }
        for (var i = 0; i < arr.length; i++) {
            s += "  - " + arr[i] + "\n";
        }
        s += "\n";
        return s;
    }

    function formatDuplicateMap(title, obj) {
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) keys.push(k);
        }
        keys.sort();

        var s = title + " (" + keys.length + ")\n";
        if (keys.length === 0) {
            s += "  - none\n\n";
            return s;
        }
        for (var i = 0; i < keys.length; i++) {
            s += "  - " + keys[i] + " [count=" + obj[keys[i]] + "]\n";
        }
        s += "\n";
        return s;
    }

    function buildReport(docRef, dataCsvRef, headers, docInfo, styleInfo) {
        var mapKeys = getMapKeys(map);
        var mappedLabels = getMappedFrameLabels(map);

        var missingHeaders = subtract(requiredHeaders, headers);
        var extraHeaders = subtract(headers, requiredHeaders);
        var missingMapKeysInHeaders = subtract(mapKeys, headers);
        var missingLabels = subtract(mappedLabels, docInfo.labels);
        var unusedLabels = subtract(docInfo.labels, mappedLabels);

        var problems = 0;
        if (missingHeaders.length) problems++;
        if (missingMapKeysInHeaders.length) problems++;
        if (missingLabels.length) problems++;
        if (styleInfo.missingParagraph.length) problems++;
        for (var k in docInfo.duplicateLabels) {
            if (docInfo.duplicateLabels.hasOwnProperty(k)) {
                problems++;
                break;
            }
        }

        var now = new Date();
        var report = "";
        report += "INDD VALIDATION REPORT FOR LABEL-BASED populate.jsx PIPELINE\n";
        report += "=========================================================\n\n";
        report += "Document: " + docRef.name + "\n";
        report += "Assets folder: " + base.fsName + "\n";
        report += "data.csv: " + dataCsvRef.fsName + "\n";
        report += "Generated: " + now.toString() + "\n\n";

        report += "WHAT THIS VALIDATOR CHECKS\n";
        report += "--------------------------\n";
        report += "Pipeline checked: data.csv -> hardcoded field/label map -> INDD labels\n";
        report += "Labels are the canonical identifiers.\n\n";

        report += "SUMMARY\n";
        report += "-------\n";
        report += "Required headers expected by script: " + requiredHeaders.length + "\n";
        report += "Headers found in data.csv: " + headers.length + "\n";
        report += "Mapped labels expected by script: " + mappedLabels.length + "\n";
        report += "Labelled page items in INDD: " + docInfo.labels.length + "\n";
        report += "Overall status: " + (problems === 0 ? "PASS" : "CHECK REPORT") + "\n\n";

        report += formatList("Required headers expected by populate.jsx", requiredHeaders);
        report += formatList("Headers actually found in data.csv", headers);
        report += formatList("Missing required headers in data.csv", missingHeaders);
        report += formatList("Extra headers in data.csv not used by requiredHeaders list", extraHeaders);
        report += formatList("Map keys missing from data.csv headers", missingMapKeysInHeaders);

        report += formatList("Mapped frame labels expected by populate.jsx", mappedLabels);
        report += formatList("Mapped frame labels missing from INDD", missingLabels);
        report += formatList("Unused labels in INDD (not referenced by map)", unusedLabels);

        report += formatDuplicateMap("Duplicate page-item LABELS in INDD", docInfo.duplicateLabels);

        report += "STYLE VALIDATION\n";
        report += "----------------\n\n";
        report += formatList("Required paragraph styles expected by populate.jsx", requiredParagraphStyles);
        report += formatList("Missing required paragraph styles", styleInfo.missingParagraph);

        report += "NEXT ACTIONS\n";
        report += "------------\n";
        report += "1. Fix any missing required headers in data.csv.\n";
        report += "2. Make sure every mapped frame label exists in the INDD.\n";
        report += "3. Remove duplicate labels in the INDD.\n";
        report += "4. Ensure BodyHeader and BodyCopy exist in the template.\n";

        return report;
    }

    function saveReport(reportText) {
        var reportFile = File(base.fsName + "/validation-report-populate-pipeline-labels.txt");
        reportFile.encoding = "UTF-8";
        if (!reportFile.open("w")) {
            throw new Error("Could not create report file: " + reportFile.fsName);
        }
        reportFile.write(reportText);
        reportFile.close();
        return reportFile;
    }

    try {
        var headers = readCSVHeaders(dataCSV);
        var docInfo = getDocLabels(doc);
        var styleInfo = validateStyles(doc);
        var report = buildReport(doc, dataCSV, headers, docInfo, styleInfo);
        var reportFile = saveReport(report);

        alert(
            "Validation complete.\r\n\r\n" +
            "Report saved here:\r\n" + reportFile.fsName
        );
    } catch (e) {
        alert("Validation failed:\r\n" + e.message);
    }

})();