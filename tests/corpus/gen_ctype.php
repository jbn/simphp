<?php
error_reporting(E_ALL);
if (!function_exists('ctype_alpha')) { echo "no ctype\n"; exit; }
$fns = array("ctype_alnum", "ctype_alpha", "ctype_cntrl", "ctype_digit", "ctype_graph", "ctype_lower", "ctype_print", "ctype_punct", "ctype_space", "ctype_upper", "ctype_xdigit");
$strs = array("", "abc", "ABC", "aBc", "123", "12.5", "-1", "abc123", " ", "\t\n\r", "\x0b\x0c", "!@#", "a b", "\x00", "\x7f", "\xe9", "\xff", "0xFF", "deadBEEF", "g", "\x01\x1f", "~", "Hello, World!", 5, 48, 65, 256, 1000, -1, -129, 3.5, null, true, array());
echo str_pad("", 18);
foreach ($fns as $f) echo substr($f, 6, 5), " ";
echo "\n";
foreach ($strs as $s) {
    $label = is_string($s) ? "'" . addcslashes($s, "\0..\37\177..\377") . "'" : gettype($s) . ":" . @(string)$s;
    echo str_pad($label, 18);
    foreach ($fns as $f) echo str_pad($f($s) ? "Y" : "-", 6);
    echo "\n";
}
$full = array();
foreach ($fns as $f) {
    $cnt = 0; $set = "";
    for ($i = 0; $i < 256; $i++) if ($f(chr($i))) { $cnt++; $set .= sprintf("%02x", $i); }
    echo $f, " count=", $cnt, " md5=", md5($set), "\n";
}
for ($i = -130; $i <= 260; $i += 13) { echo $i, ":", ctype_digit($i) ? "d" : "", ctype_alpha($i) ? "a" : "", ctype_space($i) ? "s" : "", ctype_punct($i) ? "p" : "", " "; }
echo "\n";
?>
