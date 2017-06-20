var updateTestsEditor = function(input_spec, elem, tests, callback_) {
    var callback = function() {
        var err = "";

        var verify = function(v, tp, prefix) {
            if (tp < 2) {
                if (parseInt(v) != v) return prefix + " is not a valid integer\n"
            }
            if (tp == 2) {
                if (isNaN(v)) return prefix + " is not a valid float\n"
            }
            return "";
        }

        for (var i = 0; i < tests.length; ++ i) {
           for (var j = 0; j < input_spec.length; ++ j) {
               var v = tests[i][input_spec[j].name];
               var tp = input_spec[j].type;

               if (tp >= 4) {
                   if (!v || v[0] != '[') {
                       err += "`" + input_spec[j].name + '` in test #' + (i + 1) + ' is not a valid array\n';
                       continue;
                   }
                   try {
                       var arr = JSON.parse(v);
                       for (var k = 0; k < arr.length; ++ k) {
                           err += verify(arr[k], tp - 4, "`" + input_spec[j].name + '[' + k + ']` in test #' + (i + 1));
                       }
                   }
                   catch (e) {
                       err += "`" + input_spec[j].name + '` in test #' + (i + 1) + ' is not a valid array (' + e + ')\n';
                       continue;
                   }
               }
               else {
                   err += verify(v, tp, "`" + input_spec[j].name + '` in test #' + (i + 1));
               }
           }
        }

        callback_(err ? err : null);
    }
    elem.html('');
    var table = $('<table>');
    var tbody = $('<tbody>').appendTo(table);
    for (var i = 0; i < tests.length; ++ i) {
        var tr = $('<tr>');
        $('<td valign=middle>').css('padding-right', '10px').append($('<b>').html(i + 1 + ":")).appendTo(tr);

        var td_del = $('<td valign=top>');
        var del = $('<button>').text('Delete').on('click', (function(idx){ return function() { tests.splice(idx, 1); callback(); } })(i))

        for (var j = 0; j < input_spec.length; ++ j) {
            var td = $('<td valign=middle>').css('padding-right', '5px').css('padding-left', '15px').appendTo(tr);
            td.text(' ' + input_spec[j].name + ': ');
            var td = $('<td valign=top>').css('padding-bottom', '5px').appendTo(tr);
            var inp = $('<input>').val(tests[i][input_spec[j].name] || '');
            inp.on('change', (function(test, name, inp) {
                return function() {
                    test[name] = inp.val();
                    callback();
                }
            })(tests[i], input_spec[j].name, inp));
            td.append(inp);
        }

        if (input_spec.length == 0) {
            $('<td>').append($('<i></i>').text('(No input)')).appendTo(tr);
        }

        td_del.css('padding-left', '15px').append(del);
        tr.append(td_del);
        tbody.append(tr);
    }
    elem.append(table);
    if (tests.length < 10) {
        elem.append($('<button>').text('Add test').on('click', function(){ tests.push({}); callback(); }));
    }
}

