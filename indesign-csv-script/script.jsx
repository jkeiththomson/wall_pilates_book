#target indesign

/*
Creates the infographic frame layout from the locked spec.

This version uses ONLY the body source text frames:
- placement_frame
- movement_frame
- breath_frame

Tweaks:
- thumbnails are created as TEXT frames with visible placeholders
- qr_frame is created as a TEXT frame with visible placeholder text

Footer is a single row:
- tips_frame
- caution_frame
- qr_frame
*/

(function () {
    if (app.documents.length === 0) {
        alert("Open your InDesign document first.");
        return;
    }

    var doc = app.activeDocument;
    var page = doc.pages[0];

    var originalH = doc.viewPreferences.horizontalMeasurementUnits;
    var originalV = doc.viewPreferences.verticalMeasurementUnits;
    doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.INCHES;
    doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.INCHES;

    try {
        var MARGIN = 0.85;

        // Header
        var TITLE_X = 0.0, TITLE_Y = 0.0, TITLE_W = 6.8, TITLE_H = 0.6;

        // Info
        var LEVEL_X = 0.0, LEVEL_Y = 0.9, LEVEL_W = 1.4, LEVEL_H = 0.5;
        var REPS_X = 0.0, REPS_Y = 1.4, REPS_W = 1.4, REPS_H = 1.0;

        var WORKS_X = 1.6, WORKS_Y = 0.9, WORKS_W = 3.0, WORKS_H = 0.7;
        var BENEFITS_X = 1.6, BENEFITS_Y = 1.6, BENEFITS_W = 3.0, BENEFITS_H = 0.8;

        var IMAGERY_X = 4.8, IMAGERY_Y = 0.9, IMAGERY_W = 2.4, IMAGERY_H = 1.5;

        // Body
        var THUMB_W = 2.6, THUMB_H = 1.7;
        var THUMB1_X = 0.0, THUMB1_Y = 2.7;
        var THUMB2_X = 0.0, THUMB2_Y = 4.55;
        var THUMB3_X = 0.0, THUMB3_Y = 6.4;

        var INSTR_X = 2.8, INSTR_W = 4.0;
        var PLACEMENT_X = INSTR_X, PLACEMENT_Y = 2.7,  PLACEMENT_W = INSTR_W, PLACEMENT_H = 1.6;
        var MOVEMENT_X  = INSTR_X, MOVEMENT_Y  = 4.55, MOVEMENT_W  = INSTR_W, MOVEMENT_H  = 1.6;
        var BREATH_X    = INSTR_X, BREATH_Y    = 6.4,  BREATH_W    = INSTR_W, BREATH_H    = 1.6;

        // Footer: single row
        var FOOTER_Y = 8.3;
        var TIPS_X = 0.0, TIPS_Y = FOOTER_Y, TIPS_W = 3.0, TIPS_H = 1.0;
        var CAUTION_X = 3.1, CAUTION_Y = FOOTER_Y, CAUTION_W = 2.8, CAUTION_H = 1.0;
        var QR_X = 6.0, QR_Y = FOOTER_Y, QR_W = 0.8, QR_H = 0.8;

        function itemBounds(x, y, w, h) {
            return [MARGIN + y, MARGIN + x, MARGIN + y + h, MARGIN + x + w];
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

        function makeTextFrame(label, x, y, w, h, placeholder, layer) {
            removeItemsByLabel(label);
            var tf = page.textFrames.add(layer || textLayer);
            tf.geometricBounds = itemBounds(x, y, w, h);
            tf.label = label;
            tf.contents = placeholder || " ";
            return tf;
        }

        page.marginPreferences.top = MARGIN;
        page.marginPreferences.left = MARGIN;
        page.marginPreferences.bottom = MARGIN;
        page.marginPreferences.right = MARGIN;

        makeTextFrame("title_frame", TITLE_X, TITLE_Y, TITLE_W, TITLE_H, "Title");

        makeTextFrame("level_frame", LEVEL_X, LEVEL_Y, LEVEL_W, LEVEL_H, "Level");
        makeTextFrame("reps_frame", REPS_X, REPS_Y, REPS_W, REPS_H, "Reps");
        makeTextFrame("works_frame", WORKS_X, WORKS_Y, WORKS_W, WORKS_H, "Works");
        makeTextFrame("benefits_frame", BENEFITS_X, BENEFITS_Y, BENEFITS_W, BENEFITS_H, "Benefits");
        makeTextFrame("imagery_frame", IMAGERY_X, IMAGERY_Y, IMAGERY_W, IMAGERY_H, "Imagery");

        // Thumbnails as placeholder text frames for now
        makeTextFrame("thumb_1", THUMB1_X, THUMB1_Y, THUMB_W, THUMB_H, "Thumb 1");
        makeTextFrame("thumb_2", THUMB2_X, THUMB2_Y, THUMB_W, THUMB_H, "Thumb 2");
        makeTextFrame("thumb_3", THUMB3_X, THUMB3_Y, THUMB_W, THUMB_H, "Thumb 3");

        makeTextFrame("placement_frame", PLACEMENT_X, PLACEMENT_Y, PLACEMENT_W, PLACEMENT_H, "Placement");
        makeTextFrame("movement_frame", MOVEMENT_X, MOVEMENT_Y, MOVEMENT_W, MOVEMENT_H, "Movement");
        makeTextFrame("breath_frame", BREATH_X, BREATH_Y, BREATH_W, BREATH_H, "Breath");

        makeTextFrame("tips_frame", TIPS_X, TIPS_Y, TIPS_W, TIPS_H, "Tips");
        makeTextFrame("caution_frame", CAUTION_X, CAUTION_Y, CAUTION_W, CAUTION_H, "Caution");
        makeTextFrame("qr_frame", QR_X, QR_Y, QR_W, QR_H, "QR");

        alert("Infographic frames created on page 1.");
    } catch (err) {
        alert("Failed:\n" + err);
    } finally {
        doc.viewPreferences.horizontalMeasurementUnits = originalH;
        doc.viewPreferences.verticalMeasurementUnits = originalV;
    }
})();
