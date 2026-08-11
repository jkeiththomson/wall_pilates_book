#target indesign

(function () {

    if (app.documents.length === 0) {
        alert("Open the base INDD file first.");
        return;
    }

    var baseDoc = app.activeDocument;

    var targetFolder = Folder("/Users/keith/dev/ww/wall_pilates_book/assets/templates");
    if (!targetFolder.exists) {
        targetFolder.create();
    }

    for (var i = 1; i <= 6; i++) {

        var hFile = File(targetFolder.fsName + "/template-" + i + "-h.indd");
        var vFile = File(targetFolder.fsName + "/template-" + i + "-v.indd");

        baseDoc.saveACopy(hFile);
        baseDoc.saveACopy(vFile);
    }

    alert("12 template files created in assets/templates.");

})();