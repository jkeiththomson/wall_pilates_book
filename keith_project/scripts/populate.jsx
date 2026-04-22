#target indesign


(function () {
    try {
        if (app.documents.length === 0) {
            alert("No document open.");
            return;
        }

        var doc = app.activeDocument;
        alert("populate.jsx starting on: " + doc.name);

        // 👉 your existing logic starts here


        alert("SUCCESS — script completed");

    } catch (e) {
        alert("ERROR:\n" + e + "\nLine: " + (e.line || "unknown"));
    }
})();


(function () {
    
    alert("Script entry OK");

    if (app.documents.length === 0) {
        alert("Open your InDesign template document first.");
        return;
    }

    var doc = app.activeDocument;

    // Select the ASSETS folder
    var base = Folder.selectDialog("Select the assets folder");
    if (!base) return;

    var dataCSV = File(base.fsName + "/data.csv");
    var placeholderPath = base.fsName + "/placeholder.jpg";
    var qrPath = base.fsName + "/qr_placeholder.png";
    var illustrationsFolder = Folder(base.fsName + "/illustrations");

    if (!dataCSV.exists) {
        alert("Missing data.csv in assets folder.");
        return;
    }
    if (!placeholderPath) {
        alert(
            "Missing thumbnail placeholder in assets/illustrations folder.\n",
            "Expected one of: placeholder.jpg, placeholder.jpeg, placeholder.png"
        );
        return;
    }
    if (!qrPath) {
        alert(
            "Missing QR placeholder in assets/QRcodes folder.\n",
            "Expected one of: qr_placeholder.jpg, qr_placeholder.jpeg, qr_placeholder.png"
        );
        return;
    }
    if (!illustrationsFolder.exists) {
        alert("Missing illustrations folder inside selected assets folder.");
        return;
    }

    // HARDCODED FRAME MAP
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

    function trim(s){ return String(s).replace(/^\s+|\s+$/g,""); }

    function parseCSVLine(line){
        var result=[], current="", inQuotes=false;
        for (var i=0;i<line.length;i++){
            var ch=line[i], next=line[i+1];
            if (ch=='"'){
                if (inQuotes && next=='"'){ current+='"'; i++; }
                else inQuotes=!inQuotes;
            } else if (ch=="," && !inQuotes){
                result.push(current); current="";
            } else {
                current+=ch;
            }
        }
        result.push(current);
        return result;
    }

    function readCSV(file){
        file.encoding = "UTF-8";
        if (!file.open("r")) throw "Could not open data.csv";
        var raw=file.read();
        file.close();

        raw=raw.replace(/\r\n/g,"\n").replace(/\r/g,"\n");
        var lines=raw.split("\n");

        var cleaned=[];
        for (var i=0;i<lines.length;i++){
            if (trim(lines[i])!=="") cleaned.push(lines[i]);
        }
        if (cleaned.length < 2) throw "data.csv must contain a header row and at least one data row.";

        var headers=parseCSVLine(cleaned[0]);
        var rows=[];
        for (var j=1;j<cleaned.length;j++){
            rows.push(parseCSVLine(cleaned[j]));
        }

        return {headers:headers, rows:rows};
    }

    function requireHeader(headers, key){
        for (var i=0;i<headers.length;i++){
            if (trim(headers[i]) == key) return;
        }
        throw "Missing column in data.csv: " + key;
    }

    function getFrame(id){
        var items=doc.allPageItems;
        for (var i=0;i<items.length;i++){
            try {
                if (items[i].label == id) return items[i];
            } catch (e) {}
        }
        throw "Missing frame label: " + id;
    }

    function clearAndSetText(id,val){
        var f=getFrame(id);
        f.contents="";
        f.contents=val;
    }

    function placeImage(id,path){
        var f=getFrame(id);
        try {
            while (f.allGraphics.length>0) f.allGraphics[0].remove();
        } catch (e) {}
        f.place(File(path));
        try {
            f.fit(FitOptions.PROPORTIONALLY);
            f.fit(FitOptions.CENTER_CONTENT);
        } catch (e2) {}
    }

    function levelDots(n){
        n=parseInt(n,10);
        if(n==1) return "●○○";
        if(n==2) return "●●○";
        if(n==3) return "●●●";
        return "";
    }

    function val(headers,row,key){
        for (var i=0;i<headers.length;i++){
            if (trim(headers[i])==key) return i < row.length ? row[i] : "";
        }
        return "";
    }

    function splitList(s){
        var parts=String(s).split(",");
        var out=[];
        for (var i=0;i<parts.length;i++){
            var t=trim(parts[i]);
            if (t!=="") out.push(t);
        }
        return out;
    }

    function buildInstructions(p,m,b){
        function section(title,val){
            var arr=splitList(val);
            if (arr.length===0 || trim(arr[0]).toLowerCase()!=title.toLowerCase()){
                arr.unshift(title);
            } else {
                arr[0]=title;
            }
            return arr;
        }

        var all=[section("Placement",p), section("Movement",m), section("Breath",b)];
        var lines=[];
        for (var i=0;i<all.length;i++){
            for (var j=0;j<all[i].length;j++){
                lines.push(all[i][j]);
            }
            if (i<all.length-1) lines.push("");
        }
        return lines.join("\r");
    }

    function findStyle(styleName){
        var ps = doc.paragraphStyles.itemByName(styleName);
        if (!ps.isValid) throw "Missing paragraph style: " + styleName;
        return ps;
    }

    function styleInstructionsFrame(tf){
        var bodyHeader=findStyle("BodyHeader");
        var bodyCopy=findStyle("BodyCopy");
        var paras=tf.parentStory.paragraphs;
        for (var i=0;i<paras.length;i++){
            var txt=trim(String(paras[i].contents).replace(/\r/g,""));
            if (txt=="Placement" || txt=="Movement" || txt=="Breath"){
                paras[i].appliedParagraphStyle=bodyHeader;
            } else {
                paras[i].appliedParagraphStyle=bodyCopy;
            }
        }
    }

    function removeIfExists(id){
        var items=doc.allPageItems;
        for (var i=items.length-1;i>=0;i--){
            try {
                if (items[i].label==id){
                    items[i].remove();
                    return;
                }
            } catch (e) {}
        }
    }

    function buildInstructionsFrame(headers,row){
        var movementFrame=getFrame(map.movement);
        var breathFrame=getFrame(map.breath);

        var mb=movementFrame.geometricBounds;
        var bb=breathFrame.geometricBounds;

        removeIfExists("InstructionsFrame");

        var tf=doc.textFrames.add();
        tf.label="InstructionsFrame";
        tf.geometricBounds=[mb[0], mb[1], bb[2], bb[3]];
        tf.contents=buildInstructions(
            val(headers,row,"placement"),
            val(headers,row,"movement"),
            val(headers,row,"breath")
        );
        styleInstructionsFrame(tf);
    }

    function resolveIllustrationPath(rawValue){
        var name = trim(rawValue);
        if (name === "") return placeholderPath;

        // If the CSV already includes an extension, try that first.
        var direct = File(illustrationsFolder.fsName + "/" + name);
        if (direct.exists) return direct.fsName;

        var jpg = File(illustrationsFolder.fsName + "/" + name + ".jpg");
        if (jpg.exists) return jpg.fsName;

        var jpeg = File(illustrationsFolder.fsName + "/" + name + ".jpeg");
        if (jpeg.exists) return jpeg.fsName;

        var png = File(illustrationsFolder.fsName + "/" + name + ".png");
        if (png.exists) return png.fsName;

        var tif = File(illustrationsFolder.fsName + "/" + name + ".tif");
        if (tif.exists) return tif.fsName;

        var tiff = File(illustrationsFolder.fsName + "/" + name + ".tiff");
        if (tiff.exists) return tiff.fsName;

        return placeholderPath;
    }

    try {
        var data=readCSV(dataCSV);

        // validate headers
        var requiredHeaders = [
            "title","level_label","level","reps_label","reps",
            "works","benefits","imagery",
            "thumb1","thumb2","thumb3",
            "placement","movement","breath",
            "tips","caution","qr_code"
        ];
        for (var h=0; h<requiredHeaders.length; h++){
            requireHeader(data.headers, requiredHeaders[h]);
        }

        var rowIndex = 3; // change this number
        var r = data.rows[rowIndex];

        clearAndSetText(map.title, val(data.headers,r,"title"));
        clearAndSetText(map.level_label, val(data.headers,r,"level_label"));
        clearAndSetText(map.level, levelDots(val(data.headers,r,"level")));
        clearAndSetText(map.reps_label, val(data.headers,r,"reps_label"));
        clearAndSetText(map.reps, val(data.headers,r,"reps"));
        clearAndSetText(map.works, val(data.headers,r,"works"));
        clearAndSetText(map.benefits, val(data.headers,r,"benefits"));
        clearAndSetText(map.imagery, val(data.headers,r,"imagery"));
        clearAndSetText(map.tips, val(data.headers,r,"tips"));
        clearAndSetText(map.caution, val(data.headers,r,"caution"));

        // thumb1 / thumb2 / thumb3 refer to illustration names from the CSV.
        placeImage(map.thumb1, resolveIllustrationPath(val(data.headers,r,"thumb1")));
        placeImage(map.thumb2, resolveIllustrationPath(val(data.headers,r,"thumb2")));
        placeImage(map.thumb3, resolveIllustrationPath(val(data.headers,r,"thumb3")));
        placeImage(map.qr_code, qrPath);

        buildInstructionsFrame(data.headers, r);

        alert("SUCCESS - LABELS VERSION");
    } catch(e){
        alert("ERROR:\n" + e);
    }

})();
