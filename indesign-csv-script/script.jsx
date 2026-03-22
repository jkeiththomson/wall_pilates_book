#target indesign

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
        if (trim(headers[i]) === fieldName) {
            return i;
        }
    }
    return -1;
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
            columnIndex: col
        });
    }

    if (mappings.length === 0) {
        throw new Error("No valid mappings found in mappings.csv.");
    }

    return mappings;
}

function formatLevel(value) {
    var n = parseInt(trim(value), 10);

    if (isNaN(n) || n < 1) {
        n = 1;
    }
    if (n > 3) {
        n = 3;
    }

    var filled = "●";
    var empty = "○";
    var result = "";

    for (var i = 0; i < 3; i++) {
        result += (i < n) ? filled : empty;
    }

    return result;
}

function transformValue(mapping, value) {
    var fieldName = trim(mapping.fieldName).toLowerCase();

    if (fieldName === "level") {
        return formatLevel(value);
    }

    return value;
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

function assertMappedFramesAreUnthreaded(page, mappings, pageIndex) {
    for (var i = 0; i < mappings.length; i++) {
        var mapping = mappings[i];
        var frame = findTextFrameByLabel(page, mapping.frameLabel);

        if (!frame) {
            throw new Error("Frame not found on page " + pageIndex + ": " + mapping.frameLabel);
        }

        if (isThreaded(frame)) {
            throw new Error(
                "Threaded frame not allowed on page " +
                pageIndex +
                ": [" + mapping.frameLabel + "] for field [" + mapping.fieldName + "]"
            );
        }
    }
}

function fillPage(page, row, mappings, pageIndex) {
    assertMappedFramesAreUnthreaded(page, mappings, pageIndex);

    for (var i = 0; i < mappings.length; i++) {
        var mapping = mappings[i];
        var frame = findTextFrameByLabel(page, mapping.frameLabel);

        if (!frame) {
            throw new Error("Frame not found on page " + pageIndex + ": " + mapping.frameLabel);
        }

        var rawValue = (mapping.columnIndex < row.length) ? row[mapping.columnIndex] : "";
        frame.contents = transformValue(mapping, rawValue);
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

    assertMappedFramesAreUnthreaded(templatePage, mappings, 1);

    while (doc.pages.length > 1) {
        doc.pages[doc.pages.length - 1].remove();
    }

    for (var i = 1; i < dataCount; i++) {
        var newPage = templatePage.duplicate(LocationOptions.AFTER, doc.pages[doc.pages.length - 1]);
        assertMappedFramesAreUnthreaded(newPage, mappings, i + 1);
    }

    for (var p = 0; p < dataCount; p++) {
        fillPage(doc.pages[p], data[p + 1], mappings, p + 1);
    }

    alert("Success. Created and filled " + dataCount + " page(s).");
} catch (e) {
    alert("FAIL:\n" + e.message);
}
