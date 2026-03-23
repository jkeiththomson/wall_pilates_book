#target indesign

/*
Create the current text-only frame layout on page 1, remove obsolete overlapping
instruction frames, then fill page 1 from data.csv using mappings.csv.

Rules:
- mappings.csv uses TWO-ROW MATRIX format:
  row 1 = data.csv field names
  row 2 = InDesign frame labels
- data.csv row 1 = header
- data.csv row 2 = page 1 content
- page 1 only
*/

(function () {
    if (app.documents.length === 0) {
        alert("Open your InDesign document first.");
        return;
    }

    var BASE_PATH = "~/dev/yy/wall_pilates_book/indesign-csv-script/";
    var DATA_PATH = BASE_PATH + "data.csv";
    var MAPPINGS_PATH = BASE_PATH + "mappings.csv";

    var doc = app.activeDocument;
    var page = doc.pages[0];

    var originalH = doc.viewPreferences.horizontalMeasurementUnits;
    var originalV = doc.viewPreferences.verticalMeasurementUnits;
    doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.INCHES;
    doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.INCHES;

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

    function readCSVFile(path) {
        var f = File(path);
        if (!f.exists) {
            throw new Error("File not found: " + path);
        }
        if (!f.open("r")) {
            throw new Error("Cannot open file: " + path);
        }
        var text = f.read();
        f.close();
        return parseCSV(text);
    }

    function findHeaderIndex(headers, fieldName) {
        for (var i = 0; i < headers.length; i++) {
            if (trim(headers[i]).toLowerCase() === trim(fieldName).toLowerCase()) {
                return i;
            }
        }
        return -1;
    }

    function buildMappings(mappingRows) {
        if (mappingRows.length !== 2) {
            throw new Error("mappings.csv must contain exactly 2 rows.");
        }

        var dataFields = mappingRows[0];
        var frameLabels = mappingRows[1];
        var maxLen = Math.max(dataFields.length, frameLabels.length);
        var mappings = [];

        for (var i = 0; i < maxLen; i++) {
            var dataField = (i < dataFields.length) ? trim(dataFields[i]) : "";
            var frameLabel = (i < frameLabels.length) ? trim(frameLabels[i]) : "";

            if (dataField === "" && frameLabel === "") {
                continue;
            }

            if (dataField === "" || frameLabel === "") {
                throw new Error("mappings.csv has a blank entry in column " + (i + 1) + ".");
            }

            mappings.push({
                dataField: dataField,
                frameLabel: frameLabel
            });
        }

        if (mappings.length === 0) {
            throw new Error("No usable mappings found in mappings.csv.");
        }

        return mappings;
    }

    function getOrCreateLayer(layerName) {
        try {
            var layer = doc.layers.itemByName(layerName);
            var n = layer.name;
            return layer;
        } catch (e) {
            return doc.layers.add({ name: layerName });
        }
    }

    var textLayer = getOrCreateLayer("Infographic Text");

    function itemBounds(x, y, w, h) {
        var MARGIN = 0.85;
        return [MARGIN + y, MARGIN + x, MARGIN + y + h, MARGIN + x + w];
    }

    function removeItemsByLabel(label) {
        var items = page.allPageItems;
        for (var i = items.length - 1; i >= 0; i--) {
            try {
                if (items[i].label === label) {
                    items[i].remove();
                }
            } catch (e) {}
        }
    }

    function removeObsoleteInstructionFrames() {
        removeItemsByLabel("instructions1_frame");
        removeItemsByLabel("instructions2_frame");
        removeItemsByLabel("instructions3_frame");
    }

    function makeTextFrame(label, x, y, w, h, placeholder) {
        removeItemsByLabel(label);
        var tf = page.textFrames.add(textLayer);
        tf.geometricBounds = itemBounds(x, y, w, h);
        tf.label = label;
        tf.contents = placeholder || " ";
        return tf;
    }

    function findTextFrameByLabel(label) {
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

    try {
        page.marginPreferences.top = 0.85;
        page.marginPreferences.left = 0.85;
        page.marginPreferences.bottom = 0.85;
        page.marginPreferences.right = 0.85;

        // Remove obsolete overlapping frames from earlier layout versions.
        removeObsoleteInstructionFrames();

        // Create current frame set.
        makeTextFrame("title_frame",     0.0,  0.0, 6.8, 0.6, "Title");

        makeTextFrame("level_frame",     0.0,  0.9, 1.4, 0.5, "Level");
        makeTextFrame("reps_frame",      0.0,  1.4, 1.4, 1.0, "Reps");
        makeTextFrame("works_frame",     1.6,  0.9, 3.0, 0.7, "Works");
        makeTextFrame("benefits_frame",  1.6,  1.6, 3.0, 0.8, "Benefits");
        makeTextFrame("imagery_frame",   4.8,  0.9, 2.4, 1.5, "Imagery");

        makeTextFrame("thumb_1",         0.0,  2.7, 2.6, 1.7, "Thumb 1");
        makeTextFrame("thumb_2",         0.0,  4.55, 2.6, 1.7, "Thumb 2");
        makeTextFrame("thumb_3",         0.0,  6.4, 2.6, 1.7, "Thumb 3");

        makeTextFrame("placement_frame", 2.8,  2.7, 4.0, 1.6, "Placement");
        makeTextFrame("movement_frame",  2.8,  4.55, 4.0, 1.6, "Movement");
        makeTextFrame("breath_frame",    2.8,  6.4, 4.0, 1.6, "Breath");

        makeTextFrame("tips_frame",      0.0,  8.3, 3.0, 1.0, "Tips");
        makeTextFrame("caution_frame",   3.1,  8.3, 2.8, 1.0, "Caution");
        makeTextFrame("qr_frame",        6.0,  8.3, 0.8, 0.8, "QR");

        // Fill from CSV.
        var dataRows = readCSVFile(DATA_PATH);
        var mappingsRows = readCSVFile(MAPPINGS_PATH);

        if (dataRows.length < 2) {
            throw new Error("data.csv must have a header row and at least one data row.");
        }

        var headers = dataRows[0];
        var page1Row = dataRows[1];
        var mappings = buildMappings(mappingsRows);

        for (var j = 0; j < mappings.length; j++) {
            var mapping = mappings[j];
            var colIndex = findHeaderIndex(headers, mapping.dataField);

            if (colIndex < 0) {
                throw new Error("Field '" + mapping.dataField + "' from mappings.csv was not found in data.csv.");
            }

            var frame = findTextFrameByLabel(mapping.frameLabel);
            if (!frame) {
                throw new Error("Text frame not found on page 1: " + mapping.frameLabel);
            }

            var value = (colIndex < page1Row.length) ? page1Row[colIndex] : "";
            frame.contents = value;
        }

        alert("Created frames, removed obsolete overlaps, and filled page 1.");
    } catch (e) {
        alert("FAIL:\n" + e.message);
    } finally {
        doc.viewPreferences.horizontalMeasurementUnits = originalH;
        doc.viewPreferences.verticalMeasurementUnits = originalV;
    }
})();
