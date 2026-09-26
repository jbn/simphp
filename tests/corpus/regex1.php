<?php
var_dump(preg_match('/(\d+)-(\d+)/', 'abc 123-456 def', $m)); print_r($m);
var_dump(preg_match_all('/\b(\w)(\w*)\b/', 'hello big world', $m)); print_r($m);
preg_match_all('/(a)(b)?/', 'ab a ab', $m, PREG_SET_ORDER); print_r($m);
echo preg_replace('/(\w+) (\w+)/', '$2 ${1}!', 'hello world'), "|", preg_replace('/a/i', 'x', 'AaBb', 1), "|", preg_replace(array('/a/', '/b/'), array('b', 'c'), 'ab'), "|", preg_replace('/\s+/', ' ', "a  \n\t b"), "\n";
echo preg_replace('/(\d+)/e', 'strlen("\\1")', 'a1b22c333'), "|", preg_replace('/x/', '\\\\', 'axb'), "|", preg_replace('/(.)/', '\\0\\0', 'ab'), "\n";
print_r(preg_split('//', 'abc', -1, PREG_SPLIT_NO_EMPTY)); print_r(preg_split('/(-)/', 'a-b-c', -1, PREG_SPLIT_DELIM_CAPTURE)); print_r(preg_split('/,/', 'a,b,,c', 2));
echo preg_quote("Hello.World?(1+1)*[x]^$ /#"), "|", preg_quote("a/b", "/"), "\n";
print_r(preg_grep('/^\d+$/', array('1', 'a', '22', 'b3'))); print_r(preg_grep('/^\d+$/', array('1', 'a'), PREG_GREP_INVERT));
var_dump(preg_match('/[[:alpha:]]+/', '123abc456', $m), $m, preg_match('/(?i)ABC/', 'xabcx'), preg_match('/^.*$/s', "a\nb"), preg_match('/^b$/m', "a\nb\nc"), preg_match('/a.c/U', 'abcabc', $m2), $m2);
var_dump(@preg_match('/unclosed(/', 'x'));
preg_match('/unclosed[/', 'x');
echo "\n";
var_dump(ereg("^([a-z]+)([0-9]*)$", "abc123", $r), $r, eregi("^ABC", "abcdef"), ereg("x", "abc"));
echo ereg_replace("([0-9]+)", "<\\1>", "a1b22"), "|", eregi_replace("B", "x", "abcB"), "|", ereg_replace("^", ">", "abc"), "|", ereg_replace("$", "<", "abc"), "\n";
print_r(split("[-/.]", "2001-12/27.x")); print_r(spliti("x", "aXbxc")); print_r(split(",", "a,b,c,d", 2));
echo sql_regcase("Foo bar"), "\n";
var_dump(ereg("[[:digit:]]{3}", "ab123"), ereg("(a|b)+c", "ababc", $rr), $rr);
echo preg_replace('/(?<=a)b/', 'X', 'abab cb'), " ", preg_match('/(\w+)(?=!)/', 'hey wow!', $la), $la[1], "\n";
echo function_exists("preg_replace_callback") ? "prc" : "no prc", "
"; ?>
