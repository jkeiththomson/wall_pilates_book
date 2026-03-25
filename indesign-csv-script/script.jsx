#target "InDesign"

(function () {

    if (app.documents.length === 0) {
        alert("Open your InDesign template document first.");
        return;
    }

    var doc = app.activeDocument;

    var base = Folder.selectDialog("Select folder with data + assets");
    if (!base) return;

    var dataCSV = File(base.fsName + "/data.csv");
    var mappingsCSV = File(base.fsName + "/mappings_updated.csv");
    var thumbPath = base.fsName + "/placeholder.jpg";
    var qrPath = base.fsName + "/qr_placeholder.png";

    function trim(s){ return String(s).replace(/^\s+|\s+$/g,""); }

    function requireMapping(map, key){
        if (!map[key] || trim(map[key]) === "") {
            throw "Missing mapping for source field: " + key;
        }
        return map[key];
    }

    function parseCSVLine(line){
        var result=[], current="", inQuotes=false;
        for (var i=0;i<line.length;i++){
            var ch=line[i], next=line[i+1];
            if(ch=='"'){
                if(inQuotes && next=='"'){current+='"'; i++;}
                else inQuotes=!inQuotes;
            } else if(ch=="," && !inQuotes){
                result.push(current); current="";
            } else current+=ch;
        }
        result.push(current);
        return result;
    }

    function readCSV(file){
        file.open("r");
        var raw=file.read();
        file.close();

        raw=raw.replace(/\r\n/g,"\n").replace(/\r/g,"\n");
        var lines=raw.split("\n");

        var headers=parseCSVLine(lines[0]);
        var rows=[];
        for(var i=1;i<lines.length;i++){
            if(trim(lines[i])==="") continue;
            rows.push(parseCSVLine(lines[i]));
        }

        return {headers:headers, rows:rows};
    }

    function readMappings(file){
        file.open("r");
        var raw=file.read();
        file.close();

        var lines=raw.split("\n");
        var map={}, start=0;

        if(lines[0].toLowerCase().indexOf("source")>-1) start=1;

        for(var i=start;i<lines.length;i++){
            if(trim(lines[i])==="") continue;
            var c=parseCSVLine(lines[i]);
            map[trim(c[0])] = trim(c[1]);
        }
        return map;
    }

    function getFrame(id){
        var items=doc.allPageItems;
        for(var i=0;i<items.length;i++){
            if(items[i].name==id || items[i].label==id) return items[i];
        }
        throw "Missing frame (name/label): "+id;
    }

    function setText(id,val){
        getFrame(id).contents = val;
    }

    function placeImage(id,path){
        var f=getFrame(id);
        while(f.allGraphics.length>0) f.allGraphics[0].remove();
        f.place(File(path));
    }

    function levelDots(n){
        n=parseInt(n,10);
        if(n==1) return "●○○";
        if(n==2) return "●●○";
        if(n==3) return "●●●";
        return "";
    }

    function val(headers,row,key){
        for(var i=0;i<headers.length;i++){
            if(trim(headers[i])==key) return row[i];
        }
        return "";
    }

    try{
        var data=readCSV(dataCSV);
        var map=readMappings(mappingsCSV);
        var r=data.rows[0];

        setText(requireMapping(map,"title"), val(data.headers,r,"title"));
        setText(requireMapping(map,"level_label"), val(data.headers,r,"level_label"));
        setText(requireMapping(map,"level"), levelDots(val(data.headers,r,"level")));
        setText(requireMapping(map,"reps_label"), val(data.headers,r,"reps_label"));
        setText(requireMapping(map,"reps"), val(data.headers,r,"reps"));

        placeImage(requireMapping(map,"thumb1"), thumbPath);
        placeImage(requireMapping(map,"thumb2"), thumbPath);
        placeImage(requireMapping(map,"thumb3"), thumbPath);
        placeImage(requireMapping(map,"qr_code"), qrPath);

        alert("SUCCESS (mapping validation enabled)");

    } catch(e){
        alert("ERROR:\n"+e);
    }

})();
