var convertButton = document.getElementById("convert");
var fileInput = document.getElementById("fileInput");
var reverseTypeface = document.getElementById("reverseTypeface");
var filetypeJson = document.getElementById("filetypeJson");
var restrictCharactersCheck = document.getElementById("restrictCharacters");
var restrictCharacterSetInput = document.getElementById("restrictCharacterSet");

window.onload = function (){
    restrictCharacterSetInput.disabled = !restrictCharactersCheck.checked;
}

convertButton.onclick = function(){

    [].forEach.call(fileInput.files,function(file){
        var reader = new FileReader();
        reader.addEventListener( 'load', function ( event ) {
            var font = opentype.parse(event.target.result);
            var result = convert(font);
            exportString(result,font.familyName + "_" + font.styleName + ( filetypeJson.checked ? ".json" : ".js" ) );
        }, false );
        reader.readAsArrayBuffer( file );
    });
};

restrictCharactersCheck.onchange = function(){
    restrictCharacterSetInput.disabled = !restrictCharactersCheck.checked;
};

var exportString = function ( output, filename ) {

		var blob = new Blob( [ output ], { type: 'text/plain' } );
		var objectURL = URL.createObjectURL( blob );

		var link = document.createElement( 'a' );
		link.href = objectURL;
		link.download = filename || 'data.json';
		link.target = '_blank';
		//link.click();
		
		var event = document.createEvent("MouseEvents");
			event.initMouseEvent(
				"click", true, false, window, 0, 0, 0, 0, 0
				, false, false, false, false, 0, null
			);
			link.dispatchEvent(event);

	};

var convert = function(font){

    console.log(font);

    var scale = (1000 * 100) / ( (font.unitsPerEm || 2048) *72);
    var result = {};
    result.glyphs = {};

	var restriction = {
		range : null,
		set : null
	};
	
	if (restrictCharactersCheck.checked) {
		var restrictContent = restrictCharacterSetInput.value;
		var rangeSeparator = '-';
		if (restrictContent.indexOf (rangeSeparator) != -1) {
			var rangeParts = restrictContent.split (rangeSeparator);
			if (rangeParts.length === 2 && !isNaN (rangeParts[0]) && !isNaN (rangeParts[1])) {
				restriction.range = [parseInt (rangeParts[0]), parseInt (rangeParts[1])];
			}
		}
		if (restriction.range === null) {
			restriction.set = restrictContent;
		}
	}
	
    font.glyphs.forEach(function(glyph){
        if (glyph.unicode !== undefined) {
			var glyphCharacter = String.fromCharCode (glyph.unicode);
			var needToExport = true;
			if (restriction.range !== null) {
				needToExport = (glyph.unicode >= restriction.range[0] && glyph.unicode <= restriction.range[1]);
			} else if (restriction.set !== null) {
				needToExport = (restrictCharacterSetInput.value.indexOf (glyphCharacter) != -1);
			}
            if (needToExport) {

				var token = {};
				token.ha = Math.round(glyph.advanceWidth * scale);
				token.x_min = Math.round(glyph.xMin * scale);
				token.x_max = Math.round(glyph.xMax * scale);
				token.o = ""
				if (reverseTypeface.checked) {glyph.path.commands = reverseCommands(glyph.path.commands);}
				var tokenOArr = [];
				var curToken = null;
				glyph.path.commands.forEach(function(command,i){
					if (command.type.toLowerCase() === "c") {command.type = "b";}
					if (command.type.toLowerCase() === "m") {
						curToken = {o: "", posList:[], isHole: false};
						tokenOArr.push(curToken);
					}
					curToken.o += command.type.toLowerCase();
					curToken.o += " "
					if (command.x !== undefined && command.y !== undefined){
						curToken.o += Math.round(command.x * scale);
						curToken.o += " "
						curToken.o += Math.round(command.y * scale);
						curToken.o += " "
						curToken.posList.push({
							x: Math.round(command.x * scale), 
							y: Math.round(command.y * scale)
 						})
					}
					if (command.x1 !== undefined && command.y1 !== undefined){
						curToken.o += Math.round(command.x1 * scale);
						curToken.o += " "
						curToken.o += Math.round(command.y1 * scale);
						curToken.o += " "
						curToken.posList.push({
							x: Math.round(command.x1 * scale), 
							y: Math.round(command.y1 * scale)
						})
					}
					if (command.x2 !== undefined && command.y2 !== undefined){
						curToken.o += Math.round(command.x2 * scale);
						curToken.o += " "
						curToken.o += Math.round(command.y2 * scale);
						curToken.o += " "
						curToken.posList.push({
							x: Math.round(command.x2 * scale), 
							y: Math.round(command.y2 * scale)
						})
					}
				});

				if(tokenOArr.length > 2) {
					let lastShapeIdx = -1;
					for(var kk = 0; kk < tokenOArr.length; kk++) {
						let isHole = !isClockWise(tokenOArr[kk].posList);
						tokenOArr[kk].isHole = isHole;
						if(!isHole) {
							lastShapeIdx = kk;
						}
					}
					if (lastShapeIdx != -1 && tokenOArr[tokenOArr.length - 1].isHole) {
						var lastShape = tokenOArr.splice(lastShapeIdx, 1);
						tokenOArr.push(lastShape[0]);
					}
				}

				for(var kk = 0; kk < tokenOArr.length; kk++) {
					token.o += tokenOArr[kk].o;
				}
				
				result.glyphs[String.fromCharCode(glyph.unicode)] = token;
			}
        };
    });
    result.familyName = font.familyName;
    result.ascender = Math.round(font.ascender * scale);
    result.descender = Math.round(font.descender * scale);
    result.underlinePosition = Math.round(font.tables.post.underlinePosition * scale);
    result.underlineThickness = Math.round(font.tables.post.underlineThickness * scale);
    result.boundingBox = {
        "yMin": Math.round(font.tables.head.yMin * scale),
        "xMin": Math.round(font.tables.head.xMin * scale),
        "yMax": Math.round(font.tables.head.yMax * scale),
        "xMax": Math.round(font.tables.head.xMax * scale)
    };
    result.resolution = 1000;
    result.original_font_information = font.tables.name;
    if (font.styleName.toLowerCase().indexOf("bold") > -1){
        result.cssFontWeight = "bold";
    } else {
        result.cssFontWeight = "normal";
    };

    if (font.styleName.toLowerCase().indexOf("italic") > -1){
        result.cssFontStyle = "italic";
    } else {
        result.cssFontStyle = "normal";
    };

    if(filetypeJson.checked) {
        return JSON.stringify(result);
    } else {
        return "if (_typeface_js && _typeface_js.loadFace) _typeface_js.loadFace("+ JSON.stringify(result) + ");"
    }
};

var reverseCommands = function(commands){
    
    var paths = [];
    var path;
    
    commands.forEach(function(c){
        if (c.type.toLowerCase() === "m"){
            path = [c];
            paths.push(path);
        } else if (c.type.toLowerCase() !== "z") {
            path.push(c);
        }
    });
    
    var reversed = [];
    paths.forEach(function(p){
        var result = {"type":"m" , "x" : p[p.length-1].x, "y": p[p.length-1].y};
        reversed.push(result);
        
        for(var i = p.length - 1;i > 0; i-- ){
            var command = p[i];
            result = {"type":command.type};
            if (command.x2 !== undefined && command.y2 !== undefined){
                result.x1 = command.x2;
                result.y1 = command.y2;
                result.x2 = command.x1;
                result.y2 = command.y1;
            } else if (command.x1 !== undefined && command.y1 !== undefined){
                result.x1 = command.x1;
                result.y1 = command.y1;
            }
            result.x =  p[i-1].x;
            result.y =  p[i-1].y;
            reversed.push(result);
        }
        
    });
    
    return reversed;
    
};

var reverseCommands = function(commands){
    
    var paths = [];
    var path;
    
    commands.forEach(function(c){
        if (c.type.toLowerCase() === "m"){
            path = [c];
            paths.push(path);
        } else if (c.type.toLowerCase() !== "z") {
            path.push(c);
        }
    });
    
    var reversed = [];
    paths.forEach(function(p){
        var result = {"type":"m" , "x" : p[p.length-1].x, "y": p[p.length-1].y};
        reversed.push(result);
        
        for(var i = p.length - 1;i > 0; i-- ){
            var command = p[i];
            result = {"type":command.type};
            if (command.x2 !== undefined && command.y2 !== undefined){
                result.x1 = command.x2;
                result.y1 = command.y2;
                result.x2 = command.x1;
                result.y2 = command.y1;
            } else if (command.x1 !== undefined && command.y1 !== undefined){
                result.x1 = command.x1;
                result.y1 = command.y1;
            }
            result.x =  p[i-1].x;
            result.y =  p[i-1].y;
            reversed.push(result);
        }
        
    });
    
    return reversed;
    
};

function area( contour ) {

    const n = contour.length;
    let a = 0.0;

    for ( let p = n - 1, q = 0; q < n; p = q ++ ) {

        a += contour[ p ].x * contour[ q ].y - contour[ q ].x * contour[ p ].y;

    }

    return a * 0.5;

}

function isClockWise( pts ) {

    return area( pts ) < 0;

}
