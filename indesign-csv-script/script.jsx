#target indesign

var BODY_FRAME_LABEL = "body_frame";
var BODY_HEADER_STYLE_NAME = "BodyHeader";
var BODY_COPY_STYLE_NAME = "BodyCopy";

var BODY_SOURCE_FIELDS = ["placement", "movement", "breath"];
var BODY_SOURCE_FRAME_LABELS = ["placement_frame", "movement_frame", "breath_frame"];

var LEVEL_FRAME_LABEL = "level_frame";
var LEVEL_GRAPHIC_LABEL_PREFIX = "level_dot_";

function trim(str) {
    return (str || "").replace(/^\s+|\s+$/g, "");
}

function parseCSV(text) {
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
        var c = text.charAt(i);
        var next = (i + 1 < text.length) ? text.charAt(i + 1) : "";

        if (inQuotes) {
            if (c === '"' && next === '"') {
                field += '"';
                i++;
            } else if (c === '"') {
                inQuotes = false;
            } else {
                field += c;
            }
        } else {
            if (c === '"') {
                inQuotes = true;
            } else if (c === ",") {
                row.push(field);
                field = "";
            } else if (c === "\n") {
                row.push(field);
                rows.push(row);
                row = [];
                field = "";
            } else {
                field += c;
            }
        }
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows;
}

function readCSV(path) {
    var f = File(path);

    if (!f.exists) {
        throw new Error("File not found: " + path);
    }

    if (!f.open("r")) {
        throw new Error("Cannot open file: " + path);
    }

    var t = f.read();
    f.close();
    return parseCSV(t);
}

function findHeaderIndex(headers, fieldName) {
    for (var i = 0; i < headers.length; i++) {
        if (trim(headers[i]).toLowerCase() === trim(fieldName).toLowerCase()) {
            return i;
        }
    }
    return -1;
}

function getRowValue(headers, row, fieldName) {
    var idx = findHeaderIndex(headers, fieldName);
    if (idx < 0) {
        throw new Error("Field not found in data.csv header: " + fieldName);
    }
    return (idx < row.length) ? row[idx] : "";
}

function findTextFrameByLabel(page, label) {
    var items = page.allPageItems;

    for (var i = 0; i < items.length; i++) {
        try {
            if (
                items[i].label === label &&
                items[i].constructor &&
                items[i].constructor.name === "TextFrame"
            ) {
                return items[i];
            }
        } catch (e) {}
    }

    return null;
}

function removeFrameByLabelIfPresent(page, label) {
    var frame = findTextFrameByLabel(page, label);
    if (frame) {
        try {
            frame.remove();
        } catch (e) {}
    }
}

function getSwatchByNameOrThrow(doc, swatchName) {
    try {
        var sw = doc.swatches.itemByName(swatchName);
        var name = sw.name;
        return sw;
    } catch (e) {
        throw new Error("Required swatch not found: " + swatchName);
    }
}

function parseLevelNumber(value) {
    var n = parseInt(trim(value), 10);

    if (isNaN(n) || n < 1) {
        n = 1;
    }
    if (n > 3) {
        n = 3;
    }

    return n;
}

function transformValue(fieldName, value) {
    // Level is drawn as vectors, not inserted as text.
    return value;
}

function isBodySourceField(fieldName) {
    var lowered = trim(fieldName).toLowerCase();
    for (var i = 0; i < BODY_SOURCE_FIELDS.length; i++) {
        if (lowered === BODY_SOURCE_FIELDS[i]) {
            return true;
        }
    }
    return false;
}

function buildMappings(headers, sourceFields, frameLabels) {
    var mappings = [];
    var maxLen = Math.max(sourceFields.length, frameLabels.length);

    for (var i = 0; i < maxLen; i++) {
        var fieldName = (i < sourceFields.length) ? trim(sourceFields[i]) : "";
        var frameLabel = (i < frameLabels.length) ? trim(frameLabels[i]) : "";

        if (fieldName === "" && frameLabel === "") {
            continue;
        }

        if (fieldName === "") {
            throw new Error("mappings.csv is missing a field name in column " + (i + 1));
        }

        if (frameLabel === "") {
            throw new Error("mappings.csv is missing a frame label in column " + (i + 1));
        }

        var col = findHeaderIndex(headers, fieldName);
        if (col < 0) {
            throw new Error("Field not found in data.csv header: " + fieldName);
        }

        mappings.push({
            fieldName: fieldName,
            frameLabel: frameLabel,
            columnIndex: col,
            useBodyFrameOnly: isBodySourceField(fieldName)
        });
    }

    if (mappings.length === 0) {
        throw new Error("No valid mappings found in mappings.csv.");
    }

    return mappings;
}

function isThreaded(frame) {
    try {
        if (frame.previousTextFrame != null) {
            return true;
        }
    } catch (e) {}

    try {
        if (frame.nextTextFrame != null) {
            return true;
        }
    } catch (e) {}

    return false;
}

function assertFrameExistsAndIsUnthreaded(page, label, description, pageIndex) {
    var frame = findTextFrameByLabel(page, label);

    if (!frame) {
        throw new Error("Frame not found on page " + pageIndex + ": " + label + " (" + description + ")");
    }

    if (isThreaded(frame)) {
        throw new Error("Threaded frame not allowed on page " + pageIndex + ": " + label + " (" + description + ")");
    }

    return frame;
}

function assertRequiredFramesAreUnthreaded(page, mappings, pageIndex) {
    var needsBodyFrame = false;

    for (var i = 0; i < mappings.length; i++) {
        var mapping = mappings[i];

        if (mapping.useBodyFrameOnly) {
            needsBodyFrame = true;
        } else {
            assertFrameExistsAndIsUnthreaded(page, mapping.frameLabel, mapping.fieldName, pageIndex);
        }
    }

    if (needsBodyFrame) {
        assertFrameExistsAndIsUnthreaded(page, BODY_FRAME_LABEL, "concatenated body", pageIndex);
    }
}

function getParagraphStyleIfExists(doc, styleName) {
    try {
        var style = doc.paragraphStyles.itemByName(styleName);
        var name = style.name;
        return style;
    } catch (e) {
        return null;
    }
}

function startsWithHeader(text, header) {
    var normalizedText = trim(text).toLowerCase();
    var normalizedHeader = trim(header).toLowerCase();

    if (normalizedText.length < normalizedHeader.length) {
        return false;
    }

    return normalizedText.indexOf(normalizedHeader) === 0;
}

function ensureSectionStartsWithHeader(text, header) {
    var cleanText = trim(text);
    if (cleanText === "") {
        return header;
    }

    if (startsWithHeader(cleanText, header)) {
        return cleanText;
    }

    return header + "\r" + cleanText;
}

function buildBodySections(headers, row) {
    var placementText = getRowValue(headers, row, "placement");
    var movementText = getRowValue(headers, row, "movement");
    var breathText = getRowValue(headers, row, "breath");

    return [
        ensureSectionStartsWithHeader(placementText, "Placement"),
        ensureSectionStartsWithHeader(movementText, "Movement"),
        ensureSectionStartsWithHeader(breathText, "Breath")
    ];
}

function buildBodyText(headers, row) {
    var sections = buildBodySections(headers, row);
    return sections[0] + "\r\r" + sections[1] + "\r\r" + sections[2];
}

function applyBodyFrameStyles(frame, doc) {
    var headerStyle = getParagraphStyleIfExists(doc, BODY_HEADER_STYLE_NAME);
    var copyStyle = getParagraphStyleIfExists(doc, BODY_COPY_STYLE_NAME);

    if (!headerStyle && !copyStyle) {
        return;
    }

    var headerNames = {
        "placement": true,
        "movement": true,
        "breath": true
    };

    var paragraphs = frame.paragraphs;
    for (var i = 0; i < paragraphs.length; i++) {
        var para = paragraphs[i];
        var paraText = trim(para.contents).replace(/\r$/, "");
        var lowered = paraText.toLowerCase();

        try {
            para.clearOverrides();
        } catch (e) {}

        if (headerNames[lowered]) {
            if (headerStyle) {
                para.appliedParagraphStyle = headerStyle;
            } else {
                try {
                    para.fontStyle = "Bold";
                } catch (e) {}
            }
        } else {
            if (copyStyle) {
                para.appliedParagraphStyle = copyStyle;
            }
        }
    }
}

function removeUnusedBodySourceFrames(page) {
    for (var i = 0; i < BODY_SOURCE_FRAME_LABELS.length; i++) {
        removeFrameByLabelIfPresent(page, BODY_SOURCE_FRAME_LABELS[i]);
    }
}

function removeExistingLevelGraphics(page) {
    var items = page.allPageItems;
    var toRemove = [];

    for (var i = 0; i < items.length; i++) {
        try {
            if (items[i].label && items[i].label.indexOf(LEVEL_GRAPHIC_LABEL_PREFIX) === 0) {
                toRemove.push(items[i]);
            }
        } catch (e) {}
    }

    for (var j = 0; j < toRemove.length; j++) {
        try {
            toRemove[j].remove();
        } catch (e) {}
    }
}

function drawLevelGraphic(page, levelFrame, rawValue, doc) {
    removeExistingLevelGraphics(page);

    var n = parseLevelNumber(rawValue);
    var blackSwatch = getSwatchByNameOrThrow(doc, "Black");
    var noneSwatch = getSwatchByNameOrThrow(doc, "None");

    levelFrame.contents = "";

    var gb = levelFrame.geometricBounds; // [y1, x1, y2, x2]
    var y1 = gb[0];
    var x1 = gb[1];
    var y2 = gb[2];
    var x2 = gb[3];

    var width = x2 - x1;
    var height = y2 - y1;

    var diameter = Math.min(height * 0.8, width / 4.0);
    if (diameter <= 0) {
        throw new Error("level_frame has invalid geometry.");
    }

    var gap = diameter * 0.35;
    var totalWidth = (diameter * 3) + (gap * 2);
    var startX = x1 + ((width - totalWidth) / 2.0);
    var top = y1 + ((height - diameter) / 2.0);

    var created = [];

    for (var i = 0; i < 3; i++) {
        var left = startX + (i * (diameter + gap));
        var oval = page.ovals.add(levelFrame.itemLayer);
        oval.geometricBounds = [top, left, top + diameter, left + diameter];
        oval.label = LEVEL_GRAPHIC_LABEL_PREFIX + (i + 1);

        if (i < n) {
            oval.fillColor = blackSwatch;
            oval.strokeColor = noneSwatch;
        } else {
            oval.fillColor = noneSwatch;
            oval.strokeColor = blackSwatch;
            oval.strokeWeight = 1.25;
        }

        created.push(oval);
    }

    try {
        page.groups.add(created);
    } catch (e) {}
}

function fillPage(page, headers, row, mappings, pageIndex, doc) {
    assertRequiredFramesAreUnthreaded(page, mappings, pageIndex);

    var needsBodyFrame = false;

    for (var i = 0; i < mappings.length; i++) {
        var mapping = mappings[i];

        if (mapping.useBodyFrameOnly) {
            needsBodyFrame = true;
            continue;
        }

        var frame = findTextFrameByLabel(page, mapping.frameLabel);
        var rawValue = (mapping.columnIndex < row.length) ? row[mapping.columnIndex] : "";

        if (trim(mapping.fieldName).toLowerCase() === "level" && trim(mapping.frameLabel).toLowerCase() === LEVEL_FRAME_LABEL) {
            drawLevelGraphic(page, frame, rawValue, doc);
        } else {
            frame.contents = transformValue(mapping.fieldName, rawValue);
        }
    }

    if (needsBodyFrame) {
        var bodyFrame = findTextFrameByLabel(page, BODY_FRAME_LABEL);
        bodyFrame.contents = buildBodyText(headers, row);
        applyBodyFrameStyles(bodyFrame, doc);
        removeUnusedBodySourceFrames(page);
    }
}

try {
    var base = "~/dev/yy/wall_pilates_book/indesign-csv-script/";
    var data = readCSV(base + "data.csv");
    var map = readCSV(base + "mappings.csv");

    if (data.length < 2) {
        throw new Error("data.csv must have a header row and at least one data row.");
    }

    if (map.length < 2) {
        throw new Error("mappings.csv must have two rows.");
    }

    if (app.documents.length === 0) {
        throw new Error("Open your InDesign document first.");
    }

    var doc = app.activeDocument;

    if (doc.pages.length === 0) {
        throw new Error("The InDesign document has no pages.");
    }

    var headers = data[0];
    var sourceFields = map[0];
    var frameLabels = map[1];
    var mappings = buildMappings(headers, sourceFields, frameLabels);
    var dataCount = data.length - 1;

    var templatePage = doc.pages[0];

    assertRequiredFramesAreUnthreaded(templatePage, mappings, 1);

    while (doc.pages.length > 1) {
        doc.pages[doc.pages.length - 1].remove();
    }

    for (var i = 1; i < dataCount; i++) {
        var newPage = templatePage.duplicate(LocationOptions.AFTER, doc.pages[doc.pages.length - 1]);
        assertRequiredFramesAreUnthreaded(newPage, mappings, i + 1);
    }

    for (var p = 0; p < dataCount; p++) {
        fillPage(doc.pages[p], headers, data[p + 1], mappings, p + 1, doc);
    }

    alert("Success. Created and filled " + dataCount + " page(s).");
} catch (e) {
    alert("FAIL:\n" + e.message);
}
