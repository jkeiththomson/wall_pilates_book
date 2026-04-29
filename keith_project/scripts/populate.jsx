#target indesign

(function () {

    // ============================================================
    // populate.jsx - dynamic template version, mappings-driven, no pre-opened INDD required
    //
    // Expected project structure:
    //   keith_project/
    //     assets/
    //       data.csv
    //       mappings.csv
    //       placeholder.jpg
    //       qr_placeholder.png
    //       illustrations/
    //       templates/
    //         template-1-h.indd
    //         template-1-v.indd
    //         ...
    //         template-6-h.indd
    //         template-6-v.indd
    //     scripts/
    //       populate.jsx   (optional; script may also run from InDesign Scripts Panel)
    //
    // This script opens the needed one-page template files itself.
    // It does NOT require any InDesign document to be open first.
    // mappings.csv is the source-column to destination-frame map.
    // Thumbnail and QR source columns are mapped like everything else; their
    // cell values are resolved to files before placing into the mapped frame.
    // ============================================================

    // Change this only if the project folder moves.
    var PROJECT_FOLDER_PATH = "/Users/keith/dev/ww/wall_pilates_book/keith_project";

    // Set to null for the full run. Keep small while testing.
    var MAX_ROWS = 10;

    var activeOutputDoc = null;

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
        qr_code: true
    };

    var THUMB_FIELDS = {
        thumb1: true,
        thumb2: true,
        thumb3: true,
        thumb4: true,
        thumb5: true,
        thumb6: true
    };

    // Columns used for control/composition rather than copied directly by default.
    // Everything else, including thumb1..thumb6 and qr_code, is driven by mappings.csv.
    // If subtitle is explicitly present in mappings.csv, it will still be copied to its mapped frame.
    var CONTROL_FIELDS = {
        num: true
    };

    function die(msg) {
        throw new Error("__POPULATE_DIE__" + msg);
    }

    function trim(s) {
        return String(s === null || s === undefined ? "" : s).replace(/^\s+|\s+$/g, "");
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

        var header0 = trim(rows[0][0]).replace(/^\uFEFF/, "");
        var header1 = trim(rows[0][1]);
        if (header0 !== "source" || header1 !== "frame") {
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

            h = trim(header[i]).replace(/^\uFEFF/, "");
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
        var headers = {};

        for (i = 0; i < REQUIRED_HEADERS.length; i++) {
            headers[REQUIRED_HEADERS[i]] = true;
        }

        // mappings.csv is the authoritative source-to-destination map.
        // Every source named in mappings.csv must be an exact data.csv column.
        for (key in mappings) {
            if (mappings.hasOwnProperty(key)) {
                if (!headers[key]) {
                    die("mappings.csv contains unexpected source: " + key);
                }
            }
        }

        // Require mappings for all normally copied fields.
        // num is control data only. subtitle is allowed to be unmapped because it can be
        // consumed by the styled title composition: title + " | " + subtitle.
        for (i = 0; i < REQUIRED_HEADERS.length; i++) {
            key = REQUIRED_HEADERS[i];

            if (CONTROL_FIELDS[key]) continue;
            if (key === "subtitle" && !mappings[key]) continue;

            if (!mappings[key]) {
                die("Missing mapping for source: " + key);
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

    function resolveOptionalFrameOnPage(page, frameName, record) {
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

        if (matches.length > 1) {
            die("Duplicate frame matches on page " + page.name + ": " + frameName + "\nCSV num: " + record["num"]);
        }

        return matches.length === 1 ? matches[0] : null;
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
            die("Could not set text in frame: " + getFrameId(item));
        }
    }

    function getStyleDocument() {
        if (activeOutputDoc && activeOutputDoc.isValid) return activeOutputDoc;
        if (app.documents.length > 0) return app.activeDocument;
        die("No document is available for style lookup.");
    }

    function getCharacterStyle(styleName) {
        var doc = getStyleDocument();
        var style;

        try {
            style = doc.characterStyles.itemByName(styleName);
            if (style && style.isValid) {
                return style;
            }
        } catch (e) {}

        die(
            "Missing character style: " + styleName +
            "\nCreate this as a Character Style in the template document."
        );
    }

    function getParagraphStyle(styleName) {
        var doc = getStyleDocument();
        var style;

        try {
            style = doc.paragraphStyles.itemByName(styleName);
            if (style && style.isValid) {
                return style;
            }
        } catch (e) {}

        die(
            "Missing paragraph style: " + styleName +
            "\nCreate this as a Paragraph Style in the template document."
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
                "\nCheck that ExerciseTitle and ExerciseSubtitle are CHARACTER styles, not paragraph styles." +
                "\nDetails: " + e
            );
        }
    }

    function splitInstructionBodyLines(value) {
        var text = normalizeLineBreaks(value || "");
        var rawLines = text.split("\n");
        var lines = [];
        var i, line;

        for (i = 0; i < rawLines.length; i++) {
            line = String(rawLines[i]).replace(/\s+$/g, "");
            if (trim(line) !== "") {
                lines.push(line);
            }
        }

        return lines;
    }

    function createOrResolveInstructionsFrame(page, placementFrame, breathFrame, record) {
        var instructionsFrame = resolveOptionalFrameOnPage(page, "InstructionsFrame", record);
        var gb1, gb2, bounds;

        try {
            gb1 = placementFrame.geometricBounds;
            gb2 = breathFrame.geometricBounds;
            bounds = [gb1[0], gb1[1], gb2[2], gb2[3]];
        } catch (e) {
            die("Could not calculate InstructionsFrame bounds from PlacementFrame and BreathFrame.\nCSV num: " + record["num"] + "\nDetails: " + e);
        }

        if (!instructionsFrame) {
            try {
                instructionsFrame = page.textFrames.add();
                instructionsFrame.name = "InstructionsFrame";
                instructionsFrame.label = "InstructionsFrame";
            } catch (e2) {
                die("Could not create InstructionsFrame on page " + page.name + "\nCSV num: " + record["num"] + "\nDetails: " + e2);
            }
        }

        try {
            instructionsFrame.geometricBounds = bounds;
        } catch (e3) {
            die("Could not set InstructionsFrame bounds on page " + page.name + "\nCSV num: " + record["num"] + "\nDetails: " + e3);
        }

        return instructionsFrame;
    }

    function applyInstructionBullets(textFrame, bodyStyle) {
        var paras = textFrame.paragraphs;
        var i, p, text, bulletMatch, numberedMatch;

        for (i = 0; i < paras.length; i++) {
            p = paras[i];

            try {
                if (p.appliedParagraphStyle !== bodyStyle) {
                    continue;
                }
            } catch (e1) {
                continue;
            }

            text = p.contents || "";
            bulletMatch = text.match(/^\*/);
            numberedMatch = text.match(/^[1-9]\./);

            try {
                if (bulletMatch) {
                    p.contents = text.replace(/^\*\s*/, "");
                    p.bulletsAndNumberingListType = ListType.BULLET_LIST;
                } else if (numberedMatch) {
                    p.contents = text.replace(/^[1-9]\.\s*/, "");
                    p.bulletsAndNumberingListType = ListType.NUMBERED_LIST;
                } else {
                    p.bulletsAndNumberingListType = ListType.NO_LIST;
                }
            } catch (e2) {
                die("Could not apply instruction bullet/numbering in InstructionsFrame.\nParagraph text: " + text + "\nDetails: " + e2);
            }
        }
    }

    function populateInstructionsFrame(page, record, mappings) {
        var placementFrame = resolveFrameOnPage(page, mappings["placement"], record);
        var breathFrame = resolveFrameOnPage(page, mappings["breath"], record);
        var instructionsFrame = createOrResolveInstructionsFrame(page, placementFrame, breathFrame, record);
        var headerStyle = getParagraphStyle("InstructionsHeader");
        var bodyStyle = getParagraphStyle("InstructionsBodyPlain");
        var parts = [];
        var roles = [];

        function addSection(header, bodyValue) {
            var lines = splitInstructionBodyLines(bodyValue);
            var i;

            parts.push(header);
            roles.push("header");

            for (i = 0; i < lines.length; i++) {
                parts.push(lines[i]);
                roles.push("body");
            }
        }

        resolveFrameOnPage(page, mappings["movement"], record);

        addSection("Placement", record["placement"]);
        addSection("Movement", record["movement"]);
        addSection("Breath", record["breath"]);

        try {
            instructionsFrame.contents = parts.join("\r");

            for (var i = 0; i < roles.length && i < instructionsFrame.paragraphs.length; i++) {
                if (roles[i] === "header") {
                    instructionsFrame.paragraphs[i].appliedParagraphStyle = headerStyle;
                } else {
                    instructionsFrame.paragraphs[i].appliedParagraphStyle = bodyStyle;
                }
            }

            applyInstructionBullets(instructionsFrame, bodyStyle);
        } catch (e) {
            die("Could not populate InstructionsFrame on page " + page.name + "\nCSV num: " + record["num"] + "\nDetails: " + e);
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


    function getThumbnailNames(record) {
        var thumbs = [];
        var sawBlank = false;
        var i, key, val;

        for (i = 1; i <= 6; i++) {
            key = "thumb" + i;
            val = trim(record[key] || "");

            if (val === "") {
                sawBlank = true;
                continue;
            }

            if (sawBlank) {
                die(
                    "Thumbnail columns must be consecutive starting at thumb1.\n" +
                    "Found a blank thumbnail cell before " + key + ".\n" +
                    "CSV num: " + record["num"] + "\n" +
                    "Title: " + (record["title"] || "[untitled]")
                );
            }

            thumbs.push(val);
        }

        return thumbs;
    }

    function getThumbnailFile(baseFolder, filename, record, thumbIndex) {
        var v = trim(filename);
        var f;

        if (!v) {
            die("Blank thumbnail filename for thumb" + thumbIndex + ".\nCSV num: " + record["num"]);
        }

        f = File(baseFolder.fsName + "/illustrations/" + v);
        if (!f.exists) {
            die(
                "Missing thumbnail image file:\n" + f.fsName + "\n\n" +
                "Thumbnail filenames come from data.csv columns thumb1 through thumb6, " +
                "and files must live in assets/illustrations.\n" +
                "CSV num: " + record["num"] + "\n" +
                "Title: " + (record["title"] || "[untitled]")
            );
        }

        return f;
    }

    function placeThumbnails(page, record, base) {
        var thumbs = getThumbnailNames(record);
        var i, frameName, frameObj, imageFile;

        if (thumbs.length < 1 || thumbs.length > 6) {
            die(
                "Invalid thumbnail count. Expected 1 to 6 thumbnails.\n" +
                "Found: " + thumbs.length + "\n" +
                "CSV num: " + record["num"] + "\n" +
                "Title: " + (record["title"] || "[untitled]")
            );
        }

        for (i = 0; i < thumbs.length; i++) {
            frameName = "Thumbnail" + (i + 1) + "Frame";
            frameObj = resolveFrameOnPage(page, frameName, record);
            imageFile = getThumbnailFile(base, thumbs[i], record, i + 1);
            placeImage(frameObj, imageFile);
        }
    }

    function shouldSkipMappedField(key, record) {
        return CONTROL_FIELDS[key] === true;
    }

    function populatePage(page, record, mappings, base, placeholderFile, qrPlaceholderFile) {
        var key, frameName, frameObj;

        // Validate only the frames this page will use. The destination frame name
        // always comes from mappings.csv.
        for (key in mappings) {
            if (!mappings.hasOwnProperty(key)) continue;
            if (shouldSkipMappedField(key, record)) continue;

            frameName = mappings[key];
            resolveFrameOnPage(page, frameName, record);
        }

        for (key in mappings) {
            if (!mappings.hasOwnProperty(key)) continue;
            if (shouldSkipMappedField(key, record)) continue;

            frameName = mappings[key];
            frameObj = resolveFrameOnPage(page, frameName, record);

            // These three source columns are combined into InstructionsFrame below.
            // Their mappings are still used to locate the original template frames
            // that define/create the instructions area.
            if (key === "placement" || key === "movement" || key === "breath") {
                continue;
            }

            if (THUMB_FIELDS[key]) {
                placeImage(frameObj, getThumbnailFile(base, record[key], record, key.replace("thumb", "")));
            } else if (IMAGE_FIELDS[key]) {
                placeImage(frameObj, findQRFile(base, record[key], qrPlaceholderFile));
            } else {
                clearFrame(frameObj);

                if (key === "title") {
                    setStyledTitleFrame(frameObj, record["title"], record["subtitle"]);
                } else {
                    setTextFrame(frameObj, record[key]);
                }
            }
        }

        populateInstructionsFrame(page, record, mappings);
    }

    function getThumbnailNames_UNUSED_OLD(record) {
        var thumbs = [];
        var i, key, val;

        for (i = 1; i <= 6; i++) {
            key = "thumb" + i;
            val = trim(record[key] || "");
            if (val !== "") {
                thumbs.push(val);
            }
        }

        return thumbs;
    }

    function getStrictIllustrationFile(baseFolder, filename) {
        var f = File(baseFolder.fsName + "/illustrations/" + filename);
        if (!f.exists) {
            die("Missing illustration file:\n" + f.fsName);
        }
        return f;
    }

    function detectImageOrientationFromFirstThumb(baseFolder, filename) {
        var imageFile = getStrictIllustrationFile(baseFolder, filename);
        var tempDoc = app.documents.add(false);
        var rect, gb, w, h, orientation;

        try {
            rect = tempDoc.pages[0].rectangles.add();
            rect.place(imageFile);
            rect.fit(FitOptions.FRAME_TO_CONTENT);

            gb = rect.geometricBounds;
            w = gb[3] - gb[1];
            h = gb[2] - gb[0];

            orientation = (w > h) ? "h" : "v";
        } catch (e) {
            try { tempDoc.close(SaveOptions.NO); } catch (closeErr) {}
            die("Could not determine image orientation for:\n" + imageFile.fsName + "\n\n" + e);
        }

        tempDoc.close(SaveOptions.NO);
        return orientation;
    }


    function validateNoTemplatesDirectlyInAssets(baseFolder) {
        var rootInddFiles = baseFolder.getFiles("*.indd");
        if (rootInddFiles && rootInddFiles.length > 0) {
            var msg = "Template .indd files are not allowed directly in assets.\n\n" +
                "Move every template into:\n" + baseFolder.fsName + "/templates\n\n" +
                "Invalid file(s):";
            for (var i = 0; i < rootInddFiles.length; i++) {
                msg += "\n" + rootInddFiles[i].fsName;
            }
            die(msg);
        }
    }

    function validateTemplateNamingAndInventory(templatesFolder) {
        var expected = {};
        var missing = [];
        var invalid = [];
        var n, o, name, f, files, i;

        for (n = 1; n <= 6; n++) {
            for (o = 0; o < 2; o++) {
                name = "template-" + n + "-" + (o === 0 ? "h" : "v") + ".indd";
                expected[name] = true;
                f = File(templatesFolder.fsName + "/" + name);
                if (!f.exists) missing.push(name);
            }
        }

        files = templatesFolder.getFiles("*.indd");
        for (i = 0; i < files.length; i++) {
            name = files[i].name;
            if (!expected[name]) invalid.push(name);
        }

        if (missing.length > 0 || invalid.length > 0) {
            var msg = "Template folder must contain exactly these 12 files:\n" +
                "template-1-h.indd through template-6-h.indd\n" +
                "template-1-v.indd through template-6-v.indd\n\n" +
                "Folder checked:\n" + templatesFolder.fsName;
            if (missing.length > 0) {
                msg += "\n\nMissing:";
                for (i = 0; i < missing.length; i++) msg += "\n" + missing[i];
            }
            if (invalid.length > 0) {
                msg += "\n\nUnexpected .indd file(s):";
                for (i = 0; i < invalid.length; i++) msg += "\n" + invalid[i];
            }
            die(msg);
        }
    }

    function validateTemplateFileLocation(templateFile, templatesFolder) {
        if (!templateFile || !templateFile.exists) {
            die("Missing template file:\n" + (templateFile ? templateFile.fsName : "[undefined]"));
        }
        if (!templateFile.parent || templateFile.parent.fsName !== templatesFolder.fsName) {
            die(
                "Templates must live directly inside assets/templates.\n\n" +
                "Invalid template path:\n" + templateFile.fsName + "\n\n" +
                "Expected folder:\n" + templatesFolder.fsName
            );
        }
        if (!/^template-[1-6]-[hv]\.indd$/.test(templateFile.name)) {
            die(
                "Invalid template filename:\n" + templateFile.name + "\n\n" +
                "Expected format: template-1-h.indd through template-6-v.indd"
            );
        }
    }

    function getTemplateFileForRecord(baseFolder, record) {
        var thumbs = getThumbnailNames(record);
        var thumbCount = thumbs.length;

        if (thumbCount < 1 || thumbCount > 6) {
            die(
                "Invalid thumbnail count for row/title:\n" +
                (record["title"] || "[untitled]") +
                "\n\nExpected 1 to 6 non-empty thumbnail cells.\nFound: " + thumbCount
            );
        }

        var orientation = detectImageOrientationFromFirstThumb(baseFolder, thumbs[0]);
        var templateName = "template-" + thumbCount + "-" + orientation + ".indd";
        var templateFile = File(baseFolder.fsName + "/templates/" + templateName);

        if (!templateFile.exists) {
            die("Missing template file:\n" + templateFile.fsName);
        }

        return templateFile;
    }

    function importTemplatePage(outputDoc, templateFile) {
        var templateDoc = app.open(templateFile, false);
        var importedPage;

        try {
            if (templateDoc.pages.length !== 1) {
                die("Template must contain exactly one page:\n" + templateFile.fsName);
            }

            // Page.duplicate() requires the reference parameter to be a Page or Spread,
            // not a Document. Duplicate the template page after the current last page
            // in the output document, then remove the initial blank page after the run.
            if (outputDoc.pages.length < 1) {
                die("Output document has no pages; cannot import template page.");
            }

            importedPage = templateDoc.pages[0].duplicate(
                LocationOptions.AFTER,
                outputDoc.pages[-1]
            );
        } catch (e) {
            try { templateDoc.close(SaveOptions.NO); } catch (closeErr) {}
            die("Could not import template page:\n" + templateFile.fsName + "\n\n" + e);
        }

        templateDoc.close(SaveOptions.NO);
        return importedPage;
    }

    function removeInitialBlankPageIfSafe(outputDoc, initialPage) {
        try {
            if (outputDoc.pages.length > 1 && initialPage && initialPage.isValid) {
                initialPage.remove();
            }
        } catch (e) {
            // Non-critical. Leave the blank page rather than risk damaging output.
        }
    }

    function getProjectFolder() {
        var hardcoded = Folder(PROJECT_FOLDER_PATH);
        if (hardcoded.exists) {
            return hardcoded;
        }

        // Fallback 1: if a template is currently open from assets/templates,
        // infer keith_project from that path. This is valid in the new workflow:
        //   keith_project/assets/templates/template-1-v.indd
        try {
            if (app.documents.length > 0 && app.activeDocument.saved) {
                var docFolder = app.activeDocument.fullName.parent;
                var assetsFolder = null;

                if (docFolder && docFolder.name === "templates" && docFolder.parent && docFolder.parent.name === "assets") {
                    assetsFolder = docFolder.parent;
                } else if (docFolder && docFolder.name === "assets") {
                    die(
                        "Do not put or run template .indd files directly from the assets folder.

" +
                        "Current document folder:
" + docFolder.fsName + "

" +
                        "Templates must be in:
" + docFolder.fsName + "/templates"
                    );
                }

                if (assetsFolder && assetsFolder.parent && Folder(assetsFolder.fsName + "/templates").exists) {
                    return assetsFolder.parent;
                }
            }
        } catch (activeDocErr) {}

        // Fallback 2: if this script is stored in keith_project/scripts, infer the project folder.
        try {
            var scriptFile = File($.fileName);
            var scriptFolder = scriptFile.parent;
            if (scriptFolder && scriptFolder.name === "scripts") {
                var inferred = scriptFolder.parent;
                if (inferred && Folder(inferred.fsName + "/assets").exists) {
                    return inferred;
                }
            }
        } catch (e) {}

        die(
            "Project folder not found.\n\n" +
            "Hardcoded path is:\n" + PROJECT_FOLDER_PATH + "\n\n" +
            "Valid locations are now either:\n" +
            "1) the project folder named in PROJECT_FOLDER_PATH, or\n" +
            "2) an open template inside keith_project/assets/templates, or\n" +
            "3) this script inside keith_project/scripts."
        );
    }

    function main() {
        var projectFolder = getProjectFolder();
        var base = Folder(projectFolder.fsName + "/assets");
        var scriptsFolder = Folder(projectFolder.fsName + "/scripts");

        if (!base.exists) {
            die("Missing assets folder:\n" + base.fsName);
        }

        if (!scriptsFolder.exists) {
            die("Missing required scripts folder next to assets folder:\n" + scriptsFolder.fsName);
        }

        var dataCSV = File(base.fsName + "/data.csv");
        var mappingsCSV = File(base.fsName + "/mappings.csv");
        var placeholderFile = File(base.fsName + "/placeholder.jpg");
        var qrPlaceholderFile = File(base.fsName + "/qr_placeholder.png");
        var illustrationsFolder = Folder(base.fsName + "/illustrations");
        var templatesFolder = Folder(base.fsName + "/templates");

        if (!dataCSV.exists) die("Missing data.csv in assets folder:\n" + dataCSV.fsName);
        if (!mappingsCSV.exists) die("Missing mappings.csv in assets folder:\n" + mappingsCSV.fsName);
        if (!placeholderFile.exists) die("Missing placeholder.jpg in assets folder:\n" + placeholderFile.fsName);
        if (!qrPlaceholderFile.exists) die("Missing qr_placeholder.png in assets folder:\n" + qrPlaceholderFile.fsName);
        if (!illustrationsFolder.exists) die("Missing illustrations folder in assets folder:\n" + illustrationsFolder.fsName);
        if (!templatesFolder.exists) die("Missing templates folder in assets folder:\n" + templatesFolder.fsName);

        var mappings = loadMappings(mappingsCSV);
        validateMappingsAgainstHeaders(mappings);

        var records = loadDataRows(dataCSV);

        if (records.length > MAX_ROWS && MAX_ROWS !== null) {
            records = records.slice(0, MAX_ROWS);
        }

        var outputDoc = app.documents.add();
        activeOutputDoc = outputDoc;
        var initialBlankPage = outputDoc.pages[0];

        var currentPage;
        var templateFile;
        var i;
        var rowsCompleted = 0;

        app.scriptPreferences.enableRedraw = true;

        for (i = 0; i < records.length && (MAX_ROWS === null || rowsCompleted < MAX_ROWS); i++) {
            if (!records[i] || !records[i]["title"]) {
                throw new Error("Bad record at index " + i + ". Missing required title.");
            }

            $.writeln("Row " + (i + 1) + " -> " + records[i]["title"]);

            templateFile = getTemplateFileForRecord(base, records[i]);
            currentPage = importTemplatePage(outputDoc, templateFile);

            populatePage(currentPage, records[i], mappings, base, placeholderFile, qrPlaceholderFile);
            rowsCompleted++;
        }

        removeInitialBlankPageIfSafe(outputDoc, initialBlankPage);

        alert(
            "Populate complete.\n" +
            "Rows populated: " + rowsCompleted + "\n" +
            "Project folder:\n" + projectFolder.fsName
        );
    }

    try {
        main();
    } catch (e) {
        var msg = String(e && e.message ? e.message : e);
        if (msg.indexOf("__POPULATE_DIE__") === 0) {
            alert("Populate failed:\n\n" + msg.replace("__POPULATE_DIE__", ""));
        } else {
            alert("populate.jsx failed:\n" + msg);
        }
    }

})();
