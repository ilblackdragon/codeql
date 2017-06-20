var autoCompleteList = [];
var lintList = [];
var importToClasses = {};
var classToImports = [];
var classToMethodsAndFields = {};
var methodFieldToType = {};
var variableToClasses = {};

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

console.log("Registering linter", CodeMirror);
CodeMirror.registerHelper("lint", "text/x-java", function(text) {
  return lintList;
});

});

var showIntelligentHint = function(editor) {
        var cursor = editor.getCursor();
        var currentLine = editor.getLine(cursor.line);
        var start = cursor.ch;
        var end = start;

        var list = [];

        if (!editor.justCompleted) {
            while (end < currentLine.length && /[\w$]+/.test(currentLine.charAt(end))) ++end;
            while (start && /[\w$]+/.test(currentLine.charAt(start - 1))) --start;
        }
        var curWord = start != end && currentLine.slice(start, end);
        var regex = new RegExp('^' + curWord, 'i');

        if (autoCompleteList.length > 0) {
            list = autoCompleteList;
        }
        else {
            var includeClasses = false;
            var includeVariables = false;

            var cl = currentLine.slice(0, start).trim();

            var typeName = '';
            var lastClass = null;

            if (cl.endsWith('new') || cl.endsWith("return") || cl.endsWith('<')) {
                includeClasses = true;
            }
            else if (cl.endsWith("\".")) {
                lastClass = "java.lang.String";
            }
            else if (cl.endsWith(';') || cl.endsWith('{') || cl.endsWith('}') || cl.endsWith('(') || cl.endsWith(')') || cl.endsWith('=') || cl.length == 0) {
                includeClasses = true;
                includeVariables = true;
            }
            else if (/[\w$]+/.test(cl[cl.length - 1])) {
                includeVariables = true;
            }
            else if (cl.endsWith('.')) {
                var pos = start;
                var balance = 0;
                while (pos) {
                    var ch = currentLine[pos - 1];

                    if (pos - 1 && pos != start && ch == ' ' && /[\w$]+/.test(currentLine[pos - 2]) && /[\w$]+/.test(currentLine[pos])) {
                        break;
                    }

                    if (balance > 0 || ch == ' ' || ch == '\t' || /[\w$]+/.test(ch) || ch == '.' || ch == ']' || ch == '>' || ch == ')') {
                        if (ch == ']' || ch == '>' || ch == ')') {
                            ++ balance;
                        }
                        else if (ch == '[' || ch == '<' || ch == '(') {
                            -- balance;
                            if (balance == 0 && ch == '[') {
                                typeName = '.[]' + typeName;
                            }
                        }
                        else if (balance == 0 && ch != ' ' && ch != '\t') {
                            typeName = ch + typeName;
                        }
                        -- pos;
                    }
                    else {
                        break;
                    }
                }
            }

            console.log(typeName, includeVariables, includeClasses);

            if (typeName != '') {
                var vars = typeName.split('.');
                var lastClass = null;
                var lastTemplate = null;
                var isStatic;
                if (variableToClasses[vars[0]] !== undefined) {
                    lastClass = variableToClasses[vars[0]];
                    isStatic = 0;
                }
                else if (classToImports[vars[0]] !== undefined) {
                    lastClass = classToImports[vars[0]].replace('*', vars[0]);
                    isStatic = 1;
                }

                if (lastClass) {
                    if (lastClass.indexOf('<') != -1 && !lastClass.endsWith(']')) {
                        var from = lastClass.indexOf('<');
                        var till = lastClass.indexOf('>');
                        lastTemplate = lastClass.substring(from + 1, till != -1 ? till : lastClass.length);
                        lastClass = lastClass.substring(0, from);
                    }

                    observeClass(lastClass, editor);
                }
                console.log("Starting with ", lastClass + (lastTemplate ? '!<' + lastTemplate + '>' : ''), isStatic);
                for (var i = 1; lastClass && i < vars.length; ++ i) {
                    if (vars[i].length == 0) {
                        continue;
                    }

                    if (vars[i] == '[]') {
                        if (lastClass.lastIndexOf('[') != -1) {
                            lastClass = lastClass.substring(0, lastClass.lastIndexOf('['));
                        }
                    }
                    else {
                        lastClass = methodFieldToType[lastClass][isStatic][vars[i]];
                    }

                    if (lastClass) {
                        if (lastClass.indexOf('<') != -1 && !lastClass.endsWith(']')) {
                            var from = lastClass.indexOf('<');
                            var till = lastClass.indexOf('>');
                            var newTemplate = lastClass.substring(from + 1, till != -1 ? till : lastClass.length);
                            lastClass = lastClass.substring(0, from);

                            if (newTemplate == 'E' || newTemplate == 'T') {
                                newTemplate = lastTemplate;
                            }
                            lastTemplate = newTemplate;
                        }
                        else {
                            if (lastTemplate != null && (lastClass == 'E' || lastClass == 'T')) {
                                lastClass = lastTemplate;
                            }
                            lastTemplate = null;
                        }

                        if (classToImports[lastClass] !== undefined) {
                            lastClass = classToImports[lastClass].replace('*', lastClass);
                        }
                        observeClass(lastClass, editor);

                        isStatic = 0;
                    }

                    console.log("Now ", lastClass + (lastTemplate ? '!<' + lastTemplate + '>' : ''), isStatic);
                }
            }

            if (lastClass) {
                if (lastClass.indexOf('[') != -1) {
                    list.push('length');
                }
                else if (classToMethodsAndFields[lastClass] !== undefined) {
                    for (var i = 0; i < classToMethodsAndFields[lastClass].length; ++ i) {
                        var x = classToMethodsAndFields[lastClass][i];
                        if (!isStatic || x['static']) {
                            list.push(x['name'] + (x['method'] ? '(' : ''));
                        }
                    }
                }
                else {
                    console.log("Have no idea what " + lastClass + " is");
                }
            }

            if (includeVariables) {
                for (var key in variableToClasses) {
                    list.push(key);
                }
            }

            if (includeClasses) {
                for (var key in importToClasses) {
                    var arr = importToClasses[key];
                    for (var i = 0; i < arr.length; ++ i) {
                        list.push(extractClassName(arr[i]));
                    }
                }
            }
        }

        var result = {
            list: (!curWord ? list : list.filter(function (item) {
                return item.trim().match(regex);
            })),
            from: CodeMirror.Pos(cursor.line, start),
            to: CodeMirror.Pos(cursor.line, end)
        };

        return result;
};

var intelligentHint = function(editor, options) {
    return showIntelligentHint(editor);
}

var extractClassName = function(className) {
    var v = className;
    if (v.indexOf('.') != -1) {
        v = v.split('.');
        v = v[v.length - 1];
    }
    return v;
}

var recomputeAutoComplete = function(editor) {
    if (editor.state.completionActive) {
        CodeMirror.commands.autocomplete(editor, null, { completeSingle: false });
    }
}

var observeClass = function(cl_, editor) {
    if (classToMethodsAndFields[cl_] === undefined) {
        classToMethodsAndFields[cl_] = [];
        methodFieldToType[cl_] = {0: {}, 1: {}};
        $.get('/complete/class/' + cl_,
                success = (function(cl_) {
                    return function(v) {
                        if (classToMethodsAndFields[cl_].length == 0) {
                            var arr = JSON.parse(v)
                            classToMethodsAndFields[cl_] = arr;
                            for (var i = 0; i < arr.length; ++ i) {
                                var x = arr[i];
                                methodFieldToType[cl_][x['static']][x['name']] = x['type'];
                            }
                            recomputeAutoComplete(editor);
                        }
                    }
                })(cl_));
    }
}

var recrawlImportsAndClasses = function(editor) {
    var extractImportsAndClasses = function(val) {
        // such a fancy state machine!
        //
        var importState = 0;
        var classState = 0;
        var classBalance = 0;
        var curImport = '';
        var curClass = '';
        var curVariable = '';

        var attrs = ["public", "private", "static", "protected"];
        var basics = ['int', 'long', 'double', 'char', 'boolean', 'float', 'void'];
        var attrStates = [0, 0, 0, 0];

        var lol = '';
        var imports = ["java.lang.*"];
        var classes = [];
        var variables = [];

        var checkBasic = function(val, i) {
            for (var idx = 0; idx < basics.length; ++ idx) {
                var ok = true;
                for (var j = 0; j < basics[idx].length; ++ j) {
                    if (i + j >= val.length || val[i + j] != basics[idx][j]) {
                        ok = false;
                        break;
                    }
                }
                if (ok) {
                    return true;
                }
            }
            return false;
        }

        for (var i = 0; i < val.length; ++ i) {
            if (importState >= 0 && importState < 6 && "import"[importState] == val[i]) {
                importState += 1;
            }
            else if (importState >= 6 && (val[i] == ' ' || val[i] == '\t')) {
                importState = 7;
            }
            else if (importState == 7 && (val[i] >= 'a' && val[i] <= 'z' || val[i] >= 'A' && val[i] <= 'Z' || val[i] >= '0' && val[i] <= '9' || val[i] == '.' || val[i] == '*')) {
                curImport += val[i];
            }
            else if (importState == 7 && (val[i] == ';')) {
                imports.push(curImport);
                importState = 0;
                curImport = "";
            }
            else {
                importState = 0;
                curImport = "";
            }

            var attrClosed = false;
            for (var j = 0; j < attrs.length; ++ j) {
                if (attrStates[j] >= 0 && attrStates[j] < attrs[j].length && val[i] == attrs[j][attrStates[j]]) {
                    ++ attrStates[j];
                }
                else {
                    attrStates[j] = 0;
                }

                if (classState == 0 && attrStates[j] == attrs[j].length) {
                    attrClosed = true;
                    classState = 1;
                    curClass = '';
                    curVariable = '';
                }
            }
            if (attrClosed) {
                continue;
            }

            if (classState == 0 && (val[i] == ';' || val[i] == '{' || val[i] == '}' || val[i] == '(')) {
                classState = 1;
                curClass = '';
                curVariable = '';
            }
            else if (val[i] == '.' && classBalance == 0 && (classState == 1 || classState == 0)) {
                curClass += val[i]
                classState = 1;
            }
            else if (classState == 1 && classBalance == 0 && checkBasic(val, i)) {
                curClass += val[i];
                classState = 2;
            }
            else if ((val[i] >= 'a' && val[i] <= 'z' || val[i] >= '0' && val[i] <= '9' || val[i] == '_') && classBalance == 0 && (classState == 1 || classState == 0)) {
                curClass += val[i]
                classState = 0;
            }
            else if (classState == 1 && (val[i] == ' ' || val[i] == '\n' || val[i] == '\t')) {
                ;
            }
            else if (classState == 1 && val[i] >= 'A' && val[i] <= 'Z') {
                curClass += val[i];
                classState = 2;
            }
            else if ((classState == 2 || classState == 3) && (val[i] == '[' || val[i] == '<')) {
                ++ classBalance;
                if (curVariable == '') classState = 2;
                curClass += val[i];
            }
            else if ((classState == 2 || classState == 3) && classBalance > 0 && (val[i] == ']' || val[i] == '>')) {
                -- classBalance;
                if (curVariable == '') classState = 2;
                curClass += val[i];
            }
            else if (classBalance > 0) {
                curClass += val[i];
            }
            else if (classState == 2 && (val[i] >= 'a' && val[i] <= 'z' || val[i] >= 'A' && val[i] <= 'Z' || val[i] >= '0' && val[i] <= '9' || val[i] == '_')) {
                curClass += val[i];
            }
            else if ((classState == 2 || classState == 3) && (val[i] == ' ' || val[i] == '\n' || val[i] == '\t')) {
                classState = 3;
            }
            else if (classState == 3 && (val[i] >= 'a' && val[i] <= 'z' || val[i] >= 'A' && val[i] <= 'Z' || val[i] >= '0' && val[i] <= '9' || val[i] == '_')) {
                curVariable += val[i];
            }
            else if (classState == 3) {
                var curClassFull = curClass;
                var extra = '';
                var templatePos = curClassFull.indexOf('<');
                if (templatePos != -1) {
                    curClass = curClassFull.substring(0, templatePos);
                    extra = curClassFull.substring(templatePos);
                }
                if (classToImports[curClass] !== undefined) {
                    curClass = classToImports[curClass].replace('*', curClass);
                }
                curClass = curClass + extra;
                console.log(curClass, curVariable);
                classes.push(curClass);
                variables.push({'className': curClass, 'name': curVariable});
                curClass = '';
                curVariable = '';
                classState = 0;
                classBalance = 0;
                if (classState == 0 && (val[i] == ';' || val[i] == '{' || val[i] == '}' || val[i] == '(')) {
                    classState = 1;
                }
            }
            else {
                curClass = '';
                curVariable = '';
                classState = 0;
                classBalance = 0;
            }

            lol += val[i] + "(" + classState + "|" + classBalance + ")";
        }

        //console.log(lol);
        return {'imports': imports, 'classes': classes, 'variables': variables};
    }
    var val = editor.getValue();
    var x = extractImportsAndClasses(val);
    //console.log(x);
    for (var i = 0; i < x['imports'].length; ++ i) {
        var im_ = x['imports'][i];
        if (importToClasses[im_] === undefined) {
            importToClasses[im_] = [];
            $.get('/complete/package/' + im_,
                    success = (function(im_) {
                        return function(v) {
                            if (importToClasses[im_].length == 0) {
                                var arr = JSON.parse(v)
                                //console.log("Received data for package " + im_);
                                importToClasses[im_] = arr;
                                for (var i = 0; i < arr.length; ++ i) {
                                    classToImports[extractClassName(arr[i])] = im_;
                                }
                                recomputeAutoComplete(editor);

                                recrawlImportsAndClasses(editor);
                            }
                        }
                    })(im_));
        }
    }

    for (var i = 0; i < x['classes'].length; ++ i) {
        var cl_ = x['classes'][i];
        observeClass(cl_, myCodeMirror);
    }

    for (var i = 0; i < x['variables'].length; ++ i) {
        var v = x['variables'][i];
        variableToClasses[v['name']] = v['className'];
    }
}

var ExcludedIntelliSenseTriggerKeys =
{
    "8": "backspace",
    "9": "tab",
    "13": "enter",
    "16": "shift",
    "17": "ctrl",
    "18": "alt",
    "19": "pause",
    "20": "capslock",
    "27": "escape",
    "33": "pageup",
    "34": "pagedown",
    "35": "end",
    "36": "home",
    "37": "left",
    "38": "up",
    "39": "right",
    "40": "down",
    "45": "insert",
    "46": "delete",
    "91": "left window key",
    "92": "right window key",
    "93": "select",
    "107": "add",
    "109": "subtract",
    "110": "decimal point",
    "111": "divide",
    "112": "f1",
    "113": "f2",
    "114": "f3",
    "115": "f4",
    "116": "f5",
    "117": "f6",
    "118": "f7",
    "119": "f8",
    "120": "f9",
    "121": "f10",
    "122": "f11",
    "123": "f12",
    "144": "numlock",
    "145": "scrolllock",
    "186": "semicolon",
    "187": "equalsign",
    "188": "comma",
    "189": "dash",
    "191": "slash",
    "192": "graveaccent",
    "220": "backslash",
    "222": "quote"
}

var setIntelligentHintEvents = function(myCodeMirror, endpoint) {
    if (endpoint != null) {
        $.ajax({
                'method': 'POST',
                'url': endpoint,
                'data': JSON.stringify({'tp': 'full', 'code': myCodeMirror.getValue(), 'position': myCodeMirror.getCursor(true)}),
                'success': function(v) { var j = JSON.parse(v); if (j['suggestions']) autoCompleteList = j['suggestions']; }
        });
    }

    var scheduleLinter = function() {
        setTimeout(
            function() {
                $.ajax({
                    'method': 'POST',
                    'url': endpoint + '/lint',
                    'success': function(v) { v = JSON.parse(v); console.log("Linter: ", v, typeof(v)); if (v === false) scheduleLinter(); else { lintList = v; myCodeMirror.setOption('lint', false); myCodeMirror.setOption('lint', true); } }
                });
            }
        , 500);
    }

    var justCompleted = false;
    var wasCtrl = false;
    myCodeMirror.on("keydown", function(editor, event) {
        if (editor.state.completionActive && event.keyCode == 13) {
            justCompleted = true;
        }
        else {
            justCompleted = false;
        }
        wasCtrl = (event.ctrlKey || event.metaKey);
        myCodeMirror.justCompleted = justCompleted;
    });

    myCodeMirror.on("keyup", function(editor, event)
    {
        var __Cursor = editor.getDoc().getCursor();
        var __Token = editor.getTokenAt(__Cursor).string.trim();

        var lastC = __Token.length > 0 ? __Token[__Token.length - 1] : ' ';

        if (!editor.state.completionActive &&
            !ExcludedIntelliSenseTriggerKeys[(event.keyCode || event.which).toString()] &&
            (lastC != "{" && lastC != '}' && lastC != ";" && lastC != '/' && lastC != ')') && !event.ctrlKey && !event.metaKey && !wasCtrl)
        {
            CodeMirror.commands.autocomplete(editor, null, { completeSingle: false });
        }

        if (event.altKey && event.keyCode == 13) {
            CodeMirror.commands.autocomplete(editor, null, { completeSingle: false });
        }
    });

    if (endpoint != null) {
        var lastValue = myCodeMirror.getValue();
        var pingTimer = null;
        var reconstruct = function(oldVal, prefix, suffix, newLength, newData) {
            if (prefix > newLength) {
                prefix = newLength;
            }
            if (prefix + suffix > newLength) {
                suffix = newLength - prefix;
            }
            return oldVal.substring(0, prefix) + newData + oldVal.substring(oldVal.length - suffix, oldVal.length);
        }
        var log = [];
        var lastLogPosSent = 0;
        var logPosOffset = 0;
        var lastTimeWholeCodeSent = new Date().getTime();
        myCodeMirror.on("change", function(editor, event) {
            // This appears to work fast enough, despite linear complexity per change
            //
            var val = editor.getValue();

            var smallerLength = Math.min(lastValue.length, val.length);
            var prefix = smallerLength;
            var suffix = smallerLength;
            for (var i = 0; i < smallerLength; ++ i) {
                if (val[i] != lastValue[i]) {
                    prefix = i;
                    break;
                }
            }

            for (var i = 0; i < smallerLength; ++ i) {
                if (val[val.length - i - 1] != lastValue[lastValue.length - i - 1]) {
                    suffix = i;
                    break;
                }
            }

            var nv = (val.length > suffix + prefix) ? val.substring(prefix, val.length - suffix) : "";
            //console.log(suffix, prefix, nv);

            if (nv.length > 2 && nv[0] != "{" && nv[nv.length - 1] == '}') {
                editor.execCommand("goCharLeft");
            }

            if (nv.length > 1 || nv == ";" || nv == ".") {
                recrawlImportsAndClasses(myCodeMirror);
            }

            //console.log("Reconstruction: ", val == reconstruct(lastValue, prefix, suffix, val.length, nv));
            log.push([prefix, suffix, val.length, nv, editor.getCursor(true), editor.getCursor(false)]);
            lastValue = val;

            var sendUpdate = function() {
                $.ajax({
                        'method': 'POST',
                        'url': endpoint,
                        'data': JSON.stringify({'tp': 'diff', 'log': log.slice(lastLogPosSent - logPosOffset), 'pos': lastLogPosSent}),
                        'success': function(v) { var j = JSON.parse(v); if (j['suggestions']) autoCompleteList = j['suggestions']; if (v['reset']) lastTimeWholeCodeSent = 0; if (j['linter']) scheduleLinter(); }
                });
                lastLogPosSent = log.length;
            }

            var sendFull = function() {
                $.ajax({
                        'method': 'POST',
                        'url': endpoint,
                        'data': JSON.stringify({'tp': 'full', 'code': val, 'position': myCodeMirror.getCursor(true)}),
                        'success': function(v) { var j = JSON.parse(v); if (j['suggestions']) autoCompleteList = j['suggestions']; if (j['linter']) scheduleLinter(); }
                });
                log = [];
                lastLogPosSent = 0;
            }

            if (pingTimer) {
                clearTimeout(pingTimer);
                pingTimer = null;
            }
            pingTimer = setTimeout(function() {
                // see if it makes sense to send the whole code
                var now = new Date().getTime();
                if (now - lastTimeWholeCodeSent > 1 * 60 * 1000) {
                    sendFull();
                    lastTimeWholeCodeSent = now;
                }
                else {
                    sendUpdate();
                }
            }, 2500);
        })
    }

    recrawlImportsAndClasses(myCodeMirror);
}
