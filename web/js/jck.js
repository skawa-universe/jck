// ==ClosureCompiler==
// @output_file_name default.js
// @compilation_level ADVANCED_OPTIMIZATIONS
// ==/ClosureCompiler==

const dropHandler = (element, callback) => {
    const api = {};

    function handleDataTransferFiles(dataTransfer, event) {
        var files = Array.prototype.slice.call(dataTransfer.files);
        var foundFiles = false;
        files.forEach(function(f) {
            foundFiles = true;
            callback(f, event);
        });
        return foundFiles;
    }

    function dragOver(e) {
		e.stopPropagation();
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
        e.currentTarget.classList.add("dragOver");
    }

    function drop(e) {
		e.stopPropagation();
		e.preventDefault();
		handleDataTransferFiles(e.dataTransfer, e);
		e.currentTarget.classList.remove("dragOver");
    }

    function dragEnter(e) {
        e.currentTarget.classList.add("dragOver");
    }
    
    function dragLeave(e) {
		e.currentTarget.classList.remove("dragOver");
    }

    var bound = false;
    api.bind = () => {
        bound = true;
        element.addEventListener("dragover", dragOver, false);
        element.addEventListener("drop", drop, false);
        element.addEventListener("dragenter", dragEnter, false);
        element.addEventListener("dragleave", dragLeave, false);
    };

    api.unbind = () => {
        if (!bound) return;
        element.removeEventListener("dragover", dragOver, false);
        element.removeEventListener("drop", drop, false);
        element.removeEventListener("dragenter", dragEnter, false);
        element.removeEventListener("dragleave", dragLeave, false);
        bound = false;
    };
    
    api.bind();

    return api;
};

/** @constructor */
function InvalidJson(pos) {
    this.position = pos;
}

const validEscapes = (function () {
    var a = {};
    Array.from("\"\\/bfnrtu").forEach(e => a[e] = true);
    return a;
})();
const hexChar = /[0-9a-fA-F]/;

function jsonPrefixEnd(input, startPos) {
	var pos = startPos || 0;
	if(typeof pos !== "number")
		pos = 0;
	
	function look(c) {
		return input.substring(pos, pos+c.length) === c;
	}
	
	function consume(c) {
		if(!look(c))
			throw new InvalidJson(pos);
		pos += c.length;
	}
	
	function consumeSpaces() {
		var re = /[^\s]/g;
		re.lastIndex = pos;
		var m = re.exec(input);
		if(m)
			pos = m.index;
		else
			pos = input.length;
	}
	
	function current() {
		return input.charAt(pos);
	}
	
	function advance() {
		++pos;
	}
	
	function next() {
		advance();
		return current();
	}
	
	const skip = {
		"s": function() {
			consume('"');
			var esc = false;
			while(input.charAt(pos) !== '"' || esc) {
                if (esc) {
                    if (current() === "u") {
                        advance();
                        for (var i = 0; i < 4; ++i) {
                            if (!hexChar.test(current()))
                                throw new InvalidJson(pos);
                            advance();
                        }
                    } else {
                        if (!validEscapes[current()]) {
                            throw new InvalidJson(pos);
                        } else {
                            advance();
                        }
                    }
                    esc = false;
                } else {
                    if(current() === "\\")
                        esc = true;
                    else
                        esc = false;
                    advance();
                }
			}
			consume('"');
		},
		"n": function() {
			var c = current();
			if(c === "-")
				c = next();
			while(c >= "0" && c <= "9")
				c = next();
			if(c === ".") {
				c = next();
				while(c >= "0" && c <= "9")
					c = next();
			}
			if(c === "e" || c === "E") {
				c = next();
				if(c === "+" || c === "-")
					c = next();
				while(c >= "0" && c <= "9")
					c = next();
			}
		},
		"k": function() {
			[true, false, null].map(String).find(function(e) {
				if(look(e)) {
					consume(e);
					return true;
				}
				return false;
			});
		},
		"o": function() {
			consume("{");
			consumeSpaces();
			while(!look("}")) {
				skip["s"]();
				consumeSpaces();
				consume(":");
				skip["_"]();
				consumeSpaces();
				if(look("}"))
					break;
				consume(",");
				consumeSpaces();
			}
			advance();
		},
		"a": function() {
			consume("[");
			consumeSpaces();
			while(!look("]")) {
				skip["_"]();
				consumeSpaces();
				if(look("]"))
					break;
				consume(",");
				consumeSpaces();
			}
			advance();
		},
		"_": function() {
			consumeSpaces();
			var c = current();
			var types = {
				"tfn": "k",
				"{": "o",
				"[": "a",
				"-0123456789": "n",
				"\"": "s"
			};
			for(var key in types) {
				if(key.length > 1) {
					for(var k of key)
						types[k] = types[key];
				}
			}
			var t = types[c];
			if(t && skip[t]) {
				skip[t].call(skip);
			} else {
				throw new InvalidJson(pos);
			}
		}
	}
	
	skip["_"]();
	
	return pos;
};

function loadBlob(f) {
    return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.onload = function() {
            resolve(reader.result);
        };
        reader.onerror = function() {
            reject("error loading file");
        };
        reader.readAsText(f, "UTF-8");
    });
}

function charDump(s, maxWidth, column) {
    column = column || 0;
    var result = [];
    var pos = 0;
    while (pos < s.length) {
        var step = maxWidth - column;
        column = 0;
        result.push(s.substring(pos, pos + step));
        pos += step;
    }
    return result;
}

function makeSpan(s, cls) {
    var span = document.createElement("span");
    if (cls) span.className = cls;
    span.textContent = s;
    return span;
}

function charSpan(s, cls, arr) {
    var span = document.createElement("span");
    span.className = cls;
    for (var c of Array.from(s)) {
        if (c >= ' ') {
            var n = makeSpan(c, null);
            arr.push(n);
            span.appendChild(n);
        } else {
            span.appendChild(document.createTextNode(c));
        }
    }
    span.normalize();
    return span;
}

function quoteCharacter(c) {
    if (c < ' ') return String.fromCharCode(0x2400 + c.charCodeAt(0));
    return c;
}

function commit(f) {
    loadBlob(f).then(source => {
        var pos = null;
        var spaces = /\s+/g;
        console.log("File size in characters: "+source.length);
        var numRecords = 0;
        var err = document.querySelector(".error.hidden");
        err.parentNode.appendChild(err.cloneNode(true));
        err.classList.remove("hidden");
        try {
            while (pos === null || pos < source.length) {
                spaces.lastIndex = pos;
                var m = spaces.exec(source);
                if (m.index === pos) pos += m[0].length;
                if (pos >= source.length) break;
                pos = jsonPrefixEnd(source, pos);
                ++numRecords;
            }
            console.log("Number of records: "+numRecords);
            var name = f.name;
            if (name) {
                err.textContent = name + " is correct";
            } else {
                err.textContent = "Correct";
            }
            err.classList.add("correct");
        } catch (e) {
            if (e instanceof InvalidJson) {
                console.log("Number of records before the error: "+numRecords);
                err.classList.remove("correct");
                var row = 0;
                var col = 0;
                var charSpans = [];
                for (var i = 0; i < e.position; ++i) {
                    if (source.charAt(i) === "\n") {
                        ++row;
                        col = 0;
                    } else {
                        ++col;
                    }
                }
                var name = f.name;
                var prefix = "Error";
                if (name) {
                    prefix += " in "+name;
                }
                err.textContent = prefix+" at position "+e.position+" row "+(row+1)+" column "+(col+1);
                var pre = document.createElement("pre");
                var start = e.position - 260;
                if (start < 0) start = 0;
                var end = start + 520;
                if (end > source.length) end = source.length;
                var snippet = source.substring(start, end);
                var before = charDump(snippet.substring(0, e.position - start), 40, 0);
                var after = charDump(snippet.substring(e.position - start), 40, (before[before.length - 1] || "").length);
                pre.appendChild(charSpan(before.map(e => Array.from(e).map(quoteCharacter).join("")).join("\n"), "before", charSpans));
                pre.appendChild(makeSpan("", "marker"))
                pre.appendChild(charSpan(after.map(e => Array.from(e).map(quoteCharacter).join("")).join("\n"), "after", charSpans));
                var outer = document.createElement("div");
                outer.classList.add("outer");
                outer.appendChild(pre);
                err.appendChild(outer);
                var maxWidth = Math.max(...charSpans.map(e => e.offsetWidth));
                if (maxWidth > 8) {
                    var maxWidthPx = maxWidth+"px";
                    charSpans.forEach(e => {
                        e.style.fontStretch = maxWidth * 100 / e.offsetWidth + "%";
                        e.style.width = maxWidthPx;
                    });
                }
            } else {
                throw e;
            }
        }
    }).catch(error => {
        console.error(error);
    });
}

dropHandler(document.body, commit);
document.querySelector("input[type=file]").addEventListener("change", e => Array.from(e.target.files).forEach(commit));
