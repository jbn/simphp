<?php
error_reporting(E_ALL);
$nums = array(0, 1, 2, 7, 8, 15, 16, 255, 256, 1000, 65535, 2147483647, -1, -255, 4294967295, 4294967296, 1.9, "42", "abc");
foreach ($nums as $n) {
    echo $n, ": bin=", decbin($n), " oct=", decoct($n), " hex=", dechex($n), "\n";
}
$hexes = array("0", "ff", "FF", "0xff", "7fffffff", "80000000", "ffffffff", "100000000", "g1", "1g", "", "-1", "deadbeef", "DeAdBeEf", " a", "123456789abcdef");
foreach ($hexes as $h) echo "[$h] hexdec=", var_s(hexdec($h)), "\n";
$bins = array("0", "1", "1010", "11111111111111111111111111111111", "111111111111111111111111111111111", "102", "b101", "", "-101", " 1");
foreach ($bins as $b) echo "[$b] bindec=", var_s(bindec($b)), "\n";
$octs = array("0", "7", "777", "8", "17777777777", "37777777777", "40000000000", "-7", "0777", "789");
foreach ($octs as $o) echo "[$o] octdec=", var_s(octdec($o)), "\n";
$bc = array(array("ff", 16, 10), array("255", 10, 16), array("255", 10, 2), array("zz", 36, 10), array("ZZ", 36, 2), array("1010", 2, 36), array("-ff", 16, 10), array("ff.8", 16, 10), array("4294967295", 10, 16), array("99999999999", 10, 36), array("0", 10, 2), array("", 10, 2), array("xyz", 10, 16), array("777", 8, 16), array("10", 1, 10), array("10", 10, 37), array("abc", 16, 16), array("7FFFFFFF", 16, 8));
foreach ($bc as $a) { echo implode(",", $a), " => [", @base_convert($a[0], $a[1], $a[2]), "]\n"; }
echo base_convert("10", 1, 10), "\n";
function var_s($v) { ob_start(); var_dump($v); $s = trim(ob_get_contents()); ob_end_clean(); return $s; }
// is_numeric and intval
$strs = array("0", "1", "-1", "+1", "1.5", ".5", "5.", "1e5", "1E5", "1e", "e5", "-1.5e-3", "0x1A", "0X1a", "012", " 12", "12 ", "\t12", "\n12", "12abc", "abc", "", " ", "-", "+", ".", "1..2", "--1", "1-", "0.0", "-0", "00", "1e500", "2147483648", "-2147483649", "999999999999999999999");
foreach ($strs as $s) {
    echo str_pad("[" . addcslashes($s, "\t\n") . "]", 24), " isnum=", is_numeric($s) ? "Y" : "N", " int=", var_s(intval($s)), " +0=", var_s($s + 0), " (float)=", var_s((float)$s), " (int)=", var_s((int)$s), "\n";
}
var_dump(is_numeric(1), is_numeric(1.5), is_numeric(null), is_numeric(true), is_numeric(array()));
var_dump(intval("42", 8), intval("42", 16), intval("0x1A", 16), intval("0x1A", 0), intval("012", 0), intval("z", 36), intval(42, 8), intval("101", 2));
var_dump(intval(1e10), intval(-1e10), intval(2147483647.9), intval(-2147483648.5), intval(1e19), intval(null), intval(array()), intval(array(0)));
$vars = array("12abc", "1.5", "0x1A", "", "abc", 3.9, -3.9, true, null, array(1));
foreach (array("integer", "double", "string", "boolean", "array", "null") as $t) {
    foreach ($vars as $v) { $c = $v; @settype($c, $t); echo str_replace("\n", "", var_s($c)), " "; }
    echo "\n";
}
$x = 5; var_dump(@settype($x, "nonsense"), $x);
?>
