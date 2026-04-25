#target indesign

(function () {
    // ============================================================
    // STRICT POPULATE BASELINE - V8 MULTI-ROW
    // - Exact CSV headers only
    // - Exact mappings only
    // - Exact frame names / script labels only
    // - Hard fail on missing columns, missing frames, duplicates
    // - Populates ONE PAGE PER DATA ROW
    // - Uses page-scoped frame resolution after duplicating pages
    // ============================================================

    var ASSETS_PATH = "/Users/keith/dev/xx/wall_pilates_book/keith_project/assets";

    var REQUIRED_HEADERS = [
        "num",
        "title",
        "subtitle",
        "level",
        "reps_label",
        "reps",
        "works",
        "benefits",
        "imagery",
        "placement",
        "movement",
        "breath",
        "tips",
        "caution",
        "thumb1",
        "thumb2",
        "thumb3",
        "thumb4",
        "thumb5",
        "thumb6",
        "qr_code"
    ];

    var IMAGE_FIELDS = {
        thumb1: true,
        thumb2: true,
        thumb3: true,
        qr_code: true
    };

    // Required in data.csv, but not placed into the InDesign document.
    var METADATA_FIELDS = {
        num: true,
        subtitle: true,
        thumb4: true,
        thumb5: true,
        thumb6: true
    };

    function die(msg) {
        alert("Populate failed:\n\n" + msg);
        throw new Error(msg);
    }

    function trim(s) {
        return String(s).replace(/^\s+|\s+$/g, "");
    }

    function normalizeLineBreaks(s) {
        return String(s).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    }

    function readTextFile(fileObj) {
        if (!fileObj.exists) {
            die("Missing file:\n" + fileObj.fsName);
        }
        fileObj.encoding = "UTF-8";
        if (!fileObj.open("r")) {
            die("Could not open file:\n" + fileObj.fsName);
        }
        var txt = fileObj.read();
        fileObj.close();
        return txt;
    }

    function parseCSV(text) {
        text = normalizeLineBreaks(text);
        var rows = [];
        var row = [];
        var cell = "";
        var inQuotes = false;
        var i, ch, nextCh;

        for (i = 0; i < text.length; i++) {
            ch = text.charAt(i);
            nextCh = i + 1 < text.length ? text.charAt(i + 1) : "";

            if (inQuotes) {
                if (ch === '"') {
                    if (nextCh === '"') {
                        cell += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    cell += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ",") {
                    row.push(cell);
                    cell = "";
                } else if (ch === "\n") {
                    row.push(cell);
                    rows.push(row);
                    row = [];
                    cell = "";
                } else {
                    cell += ch;
                }
            }
        }

        row.push(cell);
        rows.push(row);

        while (rows.length > 0) {
            var last = rows[rows.length - 1];
            var allEmpty = true;
            for (i = 0; i < last.length; i++) {
                if (trim(last[i]) !== "") {
                    allEmpty = false;
                    break;
                }
            }
            if (allEmpty) rows.pop();
            else break;
        }

        return rows;
    }

    function loadMappings(fileObj) {
        var rows = parseCSV(readTextFile(fileObj));
        if (rows.length < 2) {
            die("mappings.csv must contain a header row and at least one mapping row.");
        }

        var header = rows[0];
        if (trim(header[0]) !== "source" || trim(header[1]) !== "frame") {
            die("mappings.csv header must be exactly:\nsource,frame");
        }

        var mappings = {};
        var i, source, frame;

        for (i = 1; i < rows.length; i++) {
            if (rows[i].length < 2) {
                die("Invalid mappings.csv row " + (i + 1) + ": expected 2 columns.");
            }

            source = trim(rows[i][0]);
            frame = trim(rows[i][1]);

            if (!source || !frame) {
                die("Invalid mappings.csv row " + (i + 1) + ": blank source or frame.");
            }

            if (mappings[source]) {
                die("Duplicate source in mappings.csv: " + source);
            }

            mappings[source] = frame;
        }

        return mappings;
    }

    function validateHeader(header) {
        var i, h;

        for (i = 0; i < REQUIRED_HEADERS.length; i++) {
            if (i >= header.length) {
                die("Missing column in data.csv: " + REQUIRED_HEADERS[i]);
            }

            h = trim(header[i]);
            if (h !== REQUIRED_HEADERS[i]) {
                die(
                    "Header mismatch at column " + (i + 1) +
                    ".\nExpected: " + REQUIRED_HEADERS[i] +
                    "\nFound: " + h
                );
            }
        }

        if (header.length !== REQUIRED_HEADERS.length) {
            die(
                "data.csv has the wrong number of columns.\nExpected: " +
                REQUIRED_HEADERS.length + "\nFound: " + header.length
            );
        }
    }

    function loadDataRows(fileObj) {
        var rows = parseCSV(readTextFile(fileObj));
        if (rows.length < 2) {
            die("data.csv must contain a header row and at least one data row.");
        }

        validateHeader(rows[0]);

        var records = [];
        var r, i, dataRow, record, rowNum;

        for (r = 1; r < rows.length; r++) {
            dataRow = rows[r];

            if (dataRow.length < REQUIRED_HEADERS.length) {
                while (dataRow.length < REQUIRED_HEADERS.length) {
                    dataRow.push("");
                }
            }

            if (dataRow.length !== REQUIRED_HEADERS.length) {
                die("Data row " + (r + 1) + " has the wrong number of columns.");
            }

            record = {};
            for (i = 0; i < REQUIRED_HEADERS.length; i++) {
                record[REQUIRED_HEADERS[i]] = dataRow[i];
            }

            rowNum = trim(record["num"]);
            if (!rowNum) {
                die("Data row " + (r + 1) + " has a blank num value.");
            }

            records.push(record);
        }

        return records;
    }

    function validateMappingsAgainstHeaders(mappings) {
        var i, key;

        for (i = 0; i < REQUIRED_HEADERS.length; i++) {
            key = REQUIRED_HEADERS[i];

            if (!METADATA_FIELDS[key] && !mappings[key]) {
                die("Missing mapping for source: " + key);
            }
        }

        for (key in mappings) {
            if (mappings.hasOwnProperty(key)) {
                var found = false;
                for (i = 0; i < REQUIRED_HEADERS.length; i++) {
                    if (REQUIRED_HEADERS[i] === key) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    die("mappings.csv contains unexpected source: " + key);
                }
                if (METADATA_FIELDS[key]) {
                    die("mappings.csv should not contain metadata source: " + key);
                }
            }
        }
    }

    function getPageItems(page) {
        var items = [];
        var i;

        try {
            for (i = 0; i < page.allPageItems.length; i++) {
                items.push(page.allPageItems[i]);
            }
        } catch (e) {
            die("Could not read page items for page " + page.name);
        }

        return items;
    }

    function resolveFrameOnPage(page, frameName, record) {
        var items = getPageItems(page);
        var matches = [];
        var i, item, name, label;

        for (i = 0; i < items.length; i++) {
            item = items[i];
            name = "";
            label = "";

            try { name = item.name || ""; } catch (e1) {}
            try { label = item.label || ""; } catch (e2) {}

            if (name === frameName || label === frameName) {
                matches.push(item);
            }
        }

        if (matches.length === 0) {
            die("Frame not found on page " + page.name + ": " + frameName + "\nCSV num: " + record["num"]);
        }

        if (matches.length > 1) {
            die("Duplicate frame matches on page " + page.name + ": " + frameName + "\nCSV num: " + record["num"]);
        }

        return matches[0];
    }

    function clearFrame(item) {
        try {
            if (item.hasOwnProperty("contents")) {
                item.contents = "";
            }
        } catch (e) {}

        try {
            while (item.allGraphics.length > 0) {
                item.allGraphics[0].remove();
            }
        } catch (e2) {}
    }

    function setTextFrame(item, value) {
        try {
            item.contents = value;
        } catch (e) {
            die("Could not set text in frame: " + (item.name || item.label || "[unnamed]"));
        }
    }

    function getCharacterStyle(styleName) {
        var style;

        try {
            style = app.activeDocument.characterStyles.itemByName(styleName);
            if (style && style.isValid) {
                return style;
            }
        } catch (e) {}

        die(
            "Missing character style: " + styleName +
            "\nCreate this as a Character Style in the template document."
        );
    }

    function getFrameId(item) {
        try { return item.name || item.label || "[unnamed]"; } catch (e) { return "[unnamed]"; }
    }

    function assertTextCapableFrame(item, frameId) {
        try {
            if (!item.hasOwnProperty("contents")) {
                die("Title target is not a text-capable frame: " + frameId);
            }
        } catch (e) {
            die("Could not inspect title frame: " + frameId + "\nDetails: " + e);
        }
    }

    function setStyledTitleFrame(item, titleValue, subtitleValue) {
        var titleText = String(titleValue || "");
        var subtitleText = String(subtitleValue || "");

        // This is the visible separator character between title and subtitle.
        // It is styled with ExerciseSubtitle.
        var separatorText = " | ";

        var titleStyle = getCharacterStyle("ExerciseTitle");
        var subtitleStyle = getCharacterStyle("ExerciseSubtitle");
        var titleLen = titleText.length;
        var separatorLen = separatorText.length;
        var subtitleLen = subtitleText.length;
        var fullText = titleText + separatorText + subtitleText;
        var frameId = getFrameId(item);
        var story;

        assertTextCapableFrame(item, frameId);

        try {
            item.contents = fullText;
            story = item.parentStory;

            if (!story || !story.isValid) {
                die("Could not access parent story for title frame: " + frameId);
            }

            if (titleLen > 0) {
                story.characters.itemByRange(0, titleLen - 1).appliedCharacterStyle = titleStyle;
            }

            story.characters.itemByRange(titleLen, titleLen + separatorLen - 1).appliedCharacterStyle = subtitleStyle;

            if (subtitleLen > 0) {
                story.characters.itemByRange(
                    titleLen + separatorLen,
                    titleLen + separatorLen + subtitleLen - 1
                ).appliedCharacterStyle = subtitleStyle;
            }
        } catch (e) {
            die(
                "Could not compose styled title in frame: " + frameId +
                "\nFull title text: " + fullText +
                "\nTitle length: " + titleLen +
                "\nSeparator: " + separatorText +
                "\nSubtitle length: " + subtitleLen +
                "\nCheck that ExerciseTitle and ExerciseSubtitle are CHARACTER styles, not paragraph styles." +
                "\nDetails: " + e
            );
        }
    }
    function fitGraphicFrame(item) {
        try { item.fit(FitOptions.PROPORTIONALLY); } catch (e1) {}
        try { item.fit(FitOptions.CENTER_CONTENT); } catch (e2) {}
    }

    function findIllustrationFile(baseFolder, rawValue, placeholderFile) {
        var v = trim(rawValue);
        if (!v) return placeholderFile;

        var direct = File(baseFolder.fsName + "/illustrations/" + v);
        if (direct.exists) return direct;

        return placeholderFile;
    }

    function findQRFile(baseFolder, rawValue, qrPlaceholderFile) {
        var v = trim(rawValue);
        if (!v) return qrPlaceholderFile;

        var direct1 = File(baseFolder.fsName + "/" + v);
        if (direct1.exists) return direct1;

        var direct2 = File(baseFolder.fsName + "/QRcodes/" + v);
        if (direct2.exists) return direct2;

        return qrPlaceholderFile;
    }

    function placeImage(item, fileObj) {
        clearFrame(item);

        try {
            item.place(fileObj);
            fitGraphicFrame(item);
        } catch (e) {
            die("Could not place image:\n" + fileObj.fsName);
        }
    }

    function populatePage(page, record, mappings, base, placeholderFile, qrPlaceholderFile) {
        var key, frameName, frameObj;

        for (key in mappings) {
            if (mappings.hasOwnProperty(key)) {
                frameName = mappings[key];
                resolveFrameOnPage(page, frameName, record);
            }
        }

        for (key in mappings) {
            if (!mappings.hasOwnProperty(key)) continue;

            frameName = mappings[key];
            frameObj = resolveFrameOnPage(page, frameName, record);

            if (IMAGE_FIELDS[key]) {
                if (key === "qr_code") {
                    placeImage(frameObj, findQRFile(base, record[key], qrPlaceholderFile));
                } else {
                    placeImage(frameObj, findIllustrationFile(base, record[key], placeholderFile));
                }
            } else {
                clearFrame(frameObj);

                if (key === "title") {
                    setStyledTitleFrame(frameObj, record["title"], record["subtitle"]);
                } else {
                    setTextFrame(frameObj, record[key]);
                }
            }
        }
    }

    function clearExtraPages(doc) {
        while (doc.pages.length > 1) {
            doc.pages[-1].remove();
        }
    }

    function main() {
        if (app.documents.length === 0) {
            die("Open your InDesign template document first.");
        }

        var doc = app.activeDocument;
        var base = Folder(ASSETS_PATH);

        if (!base.exists) {
            die("Assets folder does not exist:\n" + base.fsName);
        }

        var dataCSV = File(base.fsName + "/data.csv");
        var mappingsCSV = File(base.fsName + "/mappings.csv");
        var placeholderFile = File(base.fsName + "/placeholder.jpg");
        var qrPlaceholderFile = File(base.fsName + "/qr_placeholder.png");

        if (!placeholderFile.exists) {
            die("Missing placeholder image:\n" + placeholderFile.fsName);
        }

        if (!qrPlaceholderFile.exists) {
            die("Missing QR placeholder image:\n" + qrPlaceholderFile.fsName);
        }

        var mappings = loadMappings(mappingsCSV);
        validateMappingsAgainstHeaders(mappings);

        var records = loadDataRows(dataCSV);

        clearExtraPages(doc);

        var templatePage = doc.pages[0];
        var currentPage;
        var i;

        for (i = 0; i < records.length; i++) {
            if (i === 0) {
                currentPage = templatePage;
            } else {
                currentPage = templatePage.duplicate(LocationOptions.AT_END);
            }

            populatePage(currentPage, records[i], mappings, base, placeholderFile, qrPlaceholderFile);
        }

        alert("Populate complete.\nRows populated: " + records.length + "\nDocument: " + doc.name);
    }

    main();
})();
