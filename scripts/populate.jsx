#target indesign

(function () {

    // ============================================================
    // populate.jsx - zero-base dynamic template version
    //
    // Agreed project contract:
    //   wall_pilates_book/
    //     assets/
    //       csv/data.csv
    //       csv/mappings.csv
    //       placeholders/placeholder.jpg
    //       placeholders/qr_placeholder.png
    //       illustrations/
    //       qr_codes/                optional, if qr_code names point there
    //       templates/
    //         template-1-h.indd
    //         template-1-v.indd
    //         ...
    //         template-6-h.indd
    //         template-6-v.indd
    //     scripts/
    //       populate.jsx
    //
    // The script creates a new output document.
    // It does not require a template document to be open.
    // It imports one template page per CSV row from assets/templates.
    // ============================================================

    // Resolve the project root from this file: <project>/scripts/populate.jsx.
    // This keeps the project portable when the folder is moved or shared.
    var PROJECT_FOLDER_PATH = File($.fileName).parent.parent.fsName;

    // Set to null for all rows. Keep small while testing.
    var MAX_ROWS = null;

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

    var CONTROL_FIELDS = { num: true, subtitle: true };
    var THUMB_FIELDS = { thumb1: true, thumb2: true, thumb3: true, thumb4: true, thumb5: true, thumb6: true };

    function fail(message) {
        throw new Error(message);
    }

    function trim(value) {
        return String(value === null || value === undefined ? "" : value).replace(/^\s+|\s+$/g, "");
    }

    function normalizeLineBreaks(value) {
        return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    }

    function readTextFile(fileObj) {
        if (!fileObj.exists) fail("Missing file:\n" + fileObj.fsName);
        fileObj.encoding = "UTF-8";
        if (!fileObj.open("r")) fail("Could not open file:\n" + fileObj.fsName);
        var text = fileObj.read();
        fileObj.close();
        return text;
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
            var empty = true;
            for (i = 0; i < last.length; i++) {
                if (trim(last[i]) !== "") {
                    empty = false;
                    break;
                }
            }
            if (empty) rows.pop();
            else break;
        }

        return rows;
    }

    function getProjectFolder() {
        var projectFolder = Folder(PROJECT_FOLDER_PATH);
        if (!projectFolder.exists) {
            fail("Project folder not found:\n" + PROJECT_FOLDER_PATH);
        }
        return projectFolder;
    }

    function requireFolder(path, label) {
        var folder = Folder(path);
        if (!folder.exists) fail("Missing " + label + ":\n" + folder.fsName);
        return folder;
    }

    function requireFile(path, label) {
        var fileObj = File(path);
        if (!fileObj.exists) fail("Missing " + label + ":\n" + fileObj.fsName);
        return fileObj;
    }

    function validateNoTemplatesDirectlyInAssets(assetsFolder) {
        var files = assetsFolder.getFiles("*.indd");
        if (files.length > 0) {
            fail(
                "Templates are not allowed directly inside assets.\n" +
                "Move all template .indd files into:\n" +
                assetsFolder.fsName + "/templates"
            );
        }
    }

    function validateTemplateFiles(templatesFolder) {
        var expected = {};
        var count, orient, name, fileObj;

        for (count = 1; count <= 6; count++) {
            for (var o = 0; o < 2; o++) {
                orient = o === 0 ? "h" : "v";
                name = "template-" + count + "-" + orient + ".indd";
                expected[name] = true;
                fileObj = File(templatesFolder.fsName + "/" + name);
                if (!fileObj.exists) fail("Missing template file:\n" + fileObj.fsName);
            }
        }

        var actual = templatesFolder.getFiles("*.indd");
        for (var i = 0; i < actual.length; i++) {
            name = actual[i].name;
            if (!expected[name]) {
                fail("Unexpected .indd file in templates folder:\n" + actual[i].fsName);
            }
        }
    }

    function loadMappings(mappingsCSV) {
        var rows = parseCSV(readTextFile(mappingsCSV));
        if (rows.length < 2) fail("mappings.csv must have a header row and at least one mapping row.");

        if (trim(rows[0][0]).replace(/^\uFEFF/, "") !== "source" || trim(rows[0][1]) !== "frame") {
            fail("mappings.csv header must be exactly:\nsource,frame");
        }

        var mappings = {};
        for (var i = 1; i < rows.length; i++) {
            var source = trim(rows[i][0]);
            var frame = trim(rows[i][1]);

            if (!source || !frame) fail("Invalid mappings.csv row " + (i + 1) + ": blank source or frame.");
            if (mappings[source]) fail("Duplicate source in mappings.csv: " + source);

            mappings[source] = frame;
        }

        return mappings;
    }

    function validateDataHeader(header) {
        if (header.length !== REQUIRED_HEADERS.length) {
            fail("data.csv has the wrong number of columns. Expected " + REQUIRED_HEADERS.length + ", found " + header.length + ".");
        }

        for (var i = 0; i < REQUIRED_HEADERS.length; i++) {
            var actual = trim(header[i]).replace(/^\uFEFF/, "");
            if (actual !== REQUIRED_HEADERS[i]) {
                fail(
                    "Header mismatch in data.csv at column " + (i + 1) + ".\n" +
                    "Expected: " + REQUIRED_HEADERS[i] + "\n" +
                    "Found: " + actual
                );
            }
        }
    }

    function loadRecords(dataCSV) {
        var rows = parseCSV(readTextFile(dataCSV));
        if (rows.length < 2) fail("data.csv must have a header row and at least one data row.");

        validateDataHeader(rows[0]);

        var records = [];
        for (var r = 1; r < rows.length; r++) {
            if (rows[r].length !== REQUIRED_HEADERS.length) {
                fail("data.csv row " + (r + 1) + " has the wrong number of columns.");
            }

            var record = {};
            for (var c = 0; c < REQUIRED_HEADERS.length; c++) {
                record[REQUIRED_HEADERS[c]] = rows[r][c];
            }

            if (trim(record.num) === "") fail("data.csv row " + (r + 1) + " has a blank num value.");
            records.push(record);
        }

        return records;
    }

    function validateMappings(mappings) {
        var headerMap = {};
        var i, key;

        for (i = 0; i < REQUIRED_HEADERS.length; i++) {
            headerMap[REQUIRED_HEADERS[i]] = true;
        }

        for (key in mappings) {
            if (mappings.hasOwnProperty(key) && !headerMap[key]) {
                fail("mappings.csv contains a source that is not an exact data.csv column: " + key);
            }
        }

        for (i = 0; i < REQUIRED_HEADERS.length; i++) {
            key = REQUIRED_HEADERS[i];
            if (CONTROL_FIELDS[key]) continue;
            if (!mappings[key]) fail("mappings.csv is missing source: " + key);
        }
    }

    function getPageItems(page) {
        var items = [];
        for (var i = 0; i < page.allPageItems.length; i++) {
            items.push(page.allPageItems[i]);
        }
        return items;
    }

    function getFrame(page, frameName, record) {
        var items = getPageItems(page);
        var matches = [];
        var item, name, label;

        for (var i = 0; i < items.length; i++) {
            item = items[i];
            name = "";
            label = "";
            try { name = item.name || ""; } catch (e1) {}
            try { label = item.label || ""; } catch (e2) {}

            if (name === frameName || label === frameName) matches.push(item);
        }

        if (matches.length === 0) {
            fail("Frame not found: " + frameName + "\nCSV num: " + record.num + "\nTitle: " + record.title);
        }
        if (matches.length > 1) {
            fail("Duplicate frame found: " + frameName + "\nCSV num: " + record.num + "\nTitle: " + record.title);
        }

        return matches[0];
    }

    function clearFrame(frame) {
        try { frame.contents = ""; } catch (e1) {}
        try {
            while (frame.allGraphics.length > 0) frame.allGraphics[0].remove();
        } catch (e2) {}
    }

    function getCharacterStyle(doc, styleName) {
        var style = doc.characterStyles.itemByName(styleName);
        if (!style || !style.isValid) fail("Missing character style in template/output document: " + styleName);
        return style;
    }

    function getParagraphStyle(doc, styleName) {
        var style = doc.paragraphStyles.itemByName(styleName);
        if (!style || !style.isValid) fail("Missing paragraph style in template/output document: " + styleName);
        return style;
    }

    function setStyledTitle(doc, frame, title, subtitle) {
        var titleText = String(title || "");
        var subtitleText = String(subtitle || "");
        var separator = " | ";
        var fullText = titleText + separator + subtitleText;

        var titleStyle = getCharacterStyle(doc, "ExerciseTitle");
        var subtitleStyle = getCharacterStyle(doc, "ExerciseSubtitle");

        clearFrame(frame);
        frame.contents = fullText;

        var story = frame.parentStory;
        var titleLen = titleText.length;
        var separatorLen = separator.length;
        var subtitleLen = subtitleText.length;

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
    }

    function setText(frame, value) {
        clearFrame(frame);
        frame.contents = String(value || "");
    }

    function fitPlacedGraphic(frame) {
        try { frame.fit(FitOptions.PROPORTIONALLY); } catch (e1) {}
        try { frame.fit(FitOptions.CENTER_CONTENT); } catch (e2) {}
    }

    function placeImage(frame, imageFile) {
        clearFrame(frame);
        frame.place(imageFile);
        fitPlacedGraphic(frame);
    }

    function getThumbnailNames(record) {
        var names = [];
        var foundBlank = false;

        for (var i = 1; i <= 6; i++) {
            var key = "thumb" + i;
            var value = trim(record[key]);

            if (value === "") {
                foundBlank = true;
                continue;
            }

            if (foundBlank) {
                fail(
                    "Thumbnail columns must be consecutive starting at thumb1.\n" +
                    "CSV num: " + record.num + "\nTitle: " + record.title
                );
            }

            names.push(value);
        }

        if (names.length < 1 || names.length > 6) {
            fail("Each row must have between 1 and 6 thumbnails.\nCSV num: " + record.num + "\nTitle: " + record.title);
        }

        return names;
    }

    function getThumbnailFile(assetsFolder, filename, record) {
        var fileObj = File(assetsFolder.fsName + "/illustrations/" + filename);
        if (!fileObj.exists) {
            fail("Missing thumbnail image:\n" + fileObj.fsName + "\nCSV num: " + record.num + "\nTitle: " + record.title);
        }
        return fileObj;
    }

    function getQRFile(assetsFolder, filename) {
        var value = trim(filename);
        var fileObj;

        if (value !== "") {
            fileObj = File(assetsFolder.fsName + "/" + value);
            if (fileObj.exists) return fileObj;

            fileObj = File(assetsFolder.fsName + "/qr_codes/" + value);
            if (fileObj.exists) return fileObj;
        }

        return File(assetsFolder.fsName + "/placeholders/qr_placeholder.png");
    }

    function detectOrientationFromImage(imageFile) {
        var tempDoc = app.documents.add(false);
        var rect, bounds, width, height;

        try {
            rect = tempDoc.pages[0].rectangles.add();
            rect.place(imageFile);
            rect.fit(FitOptions.FRAME_TO_CONTENT);
            bounds = rect.geometricBounds;
            width = bounds[3] - bounds[1];
            height = bounds[2] - bounds[0];
        } finally {
            tempDoc.close(SaveOptions.NO);
        }

        return width > height ? "h" : "v";
    }

    function getTemplateFile(assetsFolder, templatesFolder, record) {
        var thumbs = getThumbnailNames(record);
        var firstThumbFile = getThumbnailFile(assetsFolder, thumbs[0], record);
        var orientation = detectOrientationFromImage(firstThumbFile);
        var templateName = "template-" + thumbs.length + "-" + orientation + ".indd";
        var templateFile = File(templatesFolder.fsName + "/" + templateName);

        if (!templateFile.exists) fail("Missing template file:\n" + templateFile.fsName);
        return templateFile;
    }

    function importTemplatePage(outputDoc, templateFile) {
        var templateDoc = app.open(templateFile, false);
        var importedPage;

        try {
            if (templateDoc.pages.length !== 1) {
                fail("Template must contain exactly one page:\n" + templateFile.fsName);
            }

            importedPage = templateDoc.pages[0].duplicate(LocationOptions.AFTER, outputDoc.pages[-1]);
        } finally {
            templateDoc.close(SaveOptions.NO);
        }

        return importedPage;
    }

    function splitNonEmptyLines(value) {
        var raw = normalizeLineBreaks(value).split("\n");
        var lines = [];
        for (var i = 0; i < raw.length; i++) {
            var line = String(raw[i]).replace(/\s+$/g, "");
            if (trim(line) !== "") lines.push(line);
        }
        return lines;
    }

    function applyInstructionBullets(textFrame, bodyStyle) {
        for (var i = 0; i < textFrame.paragraphs.length; i++) {
            var para = textFrame.paragraphs[i];
            if (para.appliedParagraphStyle !== bodyStyle) continue;

            var text = para.contents || "";
            if (/^\*/.test(text)) {
                para.contents = text.replace(/^\*/, "");
                para.bulletsAndNumberingListType = ListType.BULLET_LIST;
            } else if (/^[1-9]\./.test(text)) {
                para.contents = text.replace(/^[1-9]\./, "");
                para.bulletsAndNumberingListType = ListType.NUMBERED_LIST;
            } else {
                para.bulletsAndNumberingListType = ListType.NO_LIST;
            }
        }
    }

    function populateInstructions(doc, page, record, mappings) {
        var placementFrame = getFrame(page, mappings.placement, record);
        var movementFrame = getFrame(page, mappings.movement, record);
        var breathFrame = getFrame(page, mappings.breath, record);

        var instructionsFrame = getFrame(page, "InstructionsFrame", record);
        var boundsTopLeft = placementFrame.geometricBounds;
        var boundsBottomRight = breathFrame.geometricBounds;
        instructionsFrame.geometricBounds = [boundsTopLeft[0], boundsTopLeft[1], boundsBottomRight[2], boundsBottomRight[3]];

        var headerStyle = getParagraphStyle(doc, "InstructionsHeader");
        var bodyStyle = getParagraphStyle(doc, "InstructionsBodyPlain");

        var parts = [];
        var roles = [];

        function addSection(label, text) {
            parts.push(label);
            roles.push("header");

            var lines = splitNonEmptyLines(text);
            for (var i = 0; i < lines.length; i++) {
                parts.push(lines[i]);
                roles.push("body");
            }
        }

        addSection("Placement", record.placement);
        addSection("Movement", record.movement);
        addSection("Breath", record.breath);

        instructionsFrame.contents = parts.join("\r");

        for (var i = 0; i < roles.length && i < instructionsFrame.paragraphs.length; i++) {
            instructionsFrame.paragraphs[i].appliedParagraphStyle = roles[i] === "header" ? headerStyle : bodyStyle;
        }

        applyInstructionBullets(instructionsFrame, bodyStyle);
    }

    function populatePage(outputDoc, page, record, mappings, assetsFolder) {
        for (var key in mappings) {
            if (!mappings.hasOwnProperty(key)) continue;
            if (CONTROL_FIELDS[key]) continue;
            if (key === "placement" || key === "movement" || key === "breath") continue;

            var frame = getFrame(page, mappings[key], record);

            if (key === "title") {
                setStyledTitle(outputDoc, frame, record.title, record.subtitle);
            } else if (THUMB_FIELDS[key] && trim(record[key]) !== "") {
                placeImage(frame, getThumbnailFile(assetsFolder, trim(record[key]), record));
            } else if (key === "qr_code") {
                placeImage(frame, getQRFile(assetsFolder, record.qr_code));
            } else {
                setText(frame, record[key]);
            }
        }

        populateInstructions(outputDoc, page, record, mappings);
    }

    function main() {
        var projectFolder = getProjectFolder();
        var assetsFolder = requireFolder(projectFolder.fsName + "/assets", "assets folder");
        var templatesFolder = requireFolder(assetsFolder.fsName + "/templates", "templates folder");
        requireFolder(assetsFolder.fsName + "/illustrations", "illustrations folder");

        validateNoTemplatesDirectlyInAssets(assetsFolder);
        validateTemplateFiles(templatesFolder);

        var dataCSV = requireFile(assetsFolder.fsName + "/csv/data.csv", "data.csv");
        var mappingsCSV = requireFile(assetsFolder.fsName + "/csv/mappings.csv", "mappings.csv");
        requireFile(assetsFolder.fsName + "/placeholders/placeholder.jpg", "placeholder.jpg");
        requireFile(assetsFolder.fsName + "/placeholders/qr_placeholder.png", "qr_placeholder.png");

        var mappings = loadMappings(mappingsCSV);
        validateMappings(mappings);

        var records = loadRecords(dataCSV);
        var outputDoc = app.documents.add();
        var initialPage = outputDoc.pages[0];
        var rowsDone = 0;

        app.scriptPreferences.enableRedraw = true;

        for (var i = 0; i < records.length; i++) {
            if (MAX_ROWS !== null && rowsDone >= MAX_ROWS) break;

            var templateFile = getTemplateFile(assetsFolder, templatesFolder, records[i]);
            var page = importTemplatePage(outputDoc, templateFile);
            populatePage(outputDoc, page, records[i], mappings, assetsFolder);
            rowsDone++;
        }

        if (outputDoc.pages.length > 1 && initialPage && initialPage.isValid) {
            initialPage.remove();
        }

        alert("Populate complete.\nRows populated: " + rowsDone);
    }

    try {
        main();
    } catch (e) {
        alert("Populate failed:\n\n" + String(e && e.message ? e.message : e));
    }

})();
