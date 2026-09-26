<?php
error_reporting(E_ALL);
$s = "The year 2002, month 03, day 12. Also 1999-12-31.";
echo preg_replace('/(\d+)/', '[$1]', $s), "\n";
echo preg_replace('/(\d+)/', '[\\1]', $s), "\n";
echo preg_replace('/(\d+)/', '[\\0|$0]', $s), "\n";
echo preg_replace('/(\d)(\d+)/', '${1}x$2', $s), "\n";
echo preg_replace('/(\d)(\d+)/', '\\11', $s), "\n";
echo preg_replace('/(\d)(\d+)/', '${1}1', $s), "\n";
echo preg_replace('/(\d+)/', '$9|\\9|$', $s), "\n";
echo preg_replace('/(\d+)/', '\\\\1 \$1 $$1', $s), "\n";
echo preg_replace('/\d+/', '#', $s, 2), "\n";
echo preg_replace('/\d+/', '#', $s, 0), "\n";
echo preg_replace('/\d+/', '#', $s, -1), "\n";
echo preg_replace('/(\w+) (\w+)/e', 'strtoupper("\\2")." ".strrev("\\1")', "hello world foo bar"), "\n";
echo preg_replace('/(\d+)/e', '\\1*2', "a1 b22 c333"), "\n";
echo preg_replace('/(["\'])/e', '"<\\1>"', "say \"hi\" and 'bye'"), "\n";
echo preg_replace(array('/a/', '/b/', '/c/'), array('b', 'c', 'd'), "abc"), "\n";
echo preg_replace(array('/a/', '/b/'), 'X', "abcab"), "\n";
echo preg_replace(array('/a/', '/b/', '/c/'), array('1'), "abc"), "\n";
print_r(preg_replace('/o/', '0', array("foo", "k" => "boo", "bar")));
print_r(preg_replace(array('/o/', '/a/'), array('0', '4'), array("foo", "bar")));
echo preg_replace('/x*/', '-', "abc"), "\n";
echo preg_replace('/^/m', '> ', "line1\nline2\nline3"), "\n";
echo preg_replace('/\s+/', ' ', "  lots   of\n\n whitespace\t\there  "), "\n";
echo preg_replace('/(?<=\d)(?=(\d{3})+$)/', ',', "1234567890"), "\n";
echo preg_replace('/[aeiou]/i', '', "Programming In PHP"), "\n";
echo preg_replace('/(a)(b)?/', '[$2|$1]', "a ab"), "\n";
echo @preg_replace('/(/', 'x', "abc"), "|\n";
echo preg_replace('/a/', 'b', ""), "|\n";
// split
function sp($p, $s, $l = -1, $f = 0) { $r = preg_split($p, $s, $l, $f); echo count($r), ": [", implode("][", $r), "]\n"; }
sp('/[\s,]+/', "hypertext language, programming");
sp('//', 'string');
sp('//', 'string', -1, PREG_SPLIT_NO_EMPTY);
sp('/(-)/', 'a-b-c', -1, PREG_SPLIT_DELIM_CAPTURE);
sp('/(-)|(\+)/', 'a-b+c', -1, PREG_SPLIT_DELIM_CAPTURE);
sp('/-/', 'a-b-c-d', 2);
sp('/-/', 'a-b-c-d', 1);
sp('/-/', 'a-b-c-d', 0);
sp('/-/', '-a--b-', -1);
sp('/-/', '-a--b-', -1, PREG_SPLIT_NO_EMPTY);
sp('/(-)/', '-a--b-', -1, PREG_SPLIT_NO_EMPTY | PREG_SPLIT_DELIM_CAPTURE);
sp('/x/', '');
sp('/\d/', 'a1b2c3', 3, PREG_SPLIT_NO_EMPTY);
// quote & grep
echo preg_quote("Hello.World?(1+1=2)[x]{y}^\$|\\/#:-<>!"), "\n";
echo preg_quote("a/b#c", "/"), " ", preg_quote("a/b#c", "#"), " ", bin2hex(preg_quote("\0")), "\n";
print_r(preg_grep('/^\d+$/', array("1", "a", "22", "3b", 44, 5.5, "x" => "666")));
if (defined('PREG_GREP_INVERT')) print_r(preg_grep('/^\d+$/', array("1", "a"), PREG_GREP_INVERT)); else echo "no PREG_GREP_INVERT\n";
echo function_exists('preg_replace_callback') ? "has callback\n" : "no callback\n";
function cb($m) { return strtoupper($m[1]) . strlen($m[0]); }
if (function_exists('preg_replace_callback')) echo preg_replace_callback('/(\w)\w*/', 'cb', "one two three"), "\n";
?>
