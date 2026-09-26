<?php
$vals = array(0, 1, -1, 1.5, 0.0, "", "0", "1", "abc", "1abc", " 1", "1 ", "1e3", ".5", "0x10", "010", null, true, false, array(), array(0));
foreach ($vals as $v) {
  echo str_pad(var_export($v, true), 12), " int=", @intval($v), " float=", @floatval($v), " bool=", $v ? 'T' : 'F', " str='", @strval($v), "' numeric=", is_numeric($v) ? 'Y' : 'N', "\n";
}
$a = array(); $a[1.9] = 'a'; $a["2"] = 'b'; $a["02"] = 'c'; $a[true] = 'd'; $a[null] = 'e'; $a["-5"] = 'f'; $a["1.5"] = 'g'; $a[" 3"] = 'h'; var_dump($a);
echo "Array to string: " . array(1) . "\n";
$o = new stdClass; echo "Object to string: " . $o . "\n";
var_dump((string) 0.1, (string) 1e6, (string) 1e21, (string) 0.00001, (string) -1.0E-10, (string) 1.23456789012345678);
var_dump(1 == 1.0, "1" == "1.0", "abc" == "ABC", null == 0, null == "", "" == 0, "a" == 0, array() == null, "1e3" == "1000", " 1" == 1, "1 " == 1);
var_dump(null < -1, false < -1, true > 10, array(1) > 5, "10" < "9", 10 < "9a", "abc" > "abcd");
var_dump(settype($s1, "integer"), $s1); $f = "3.7xyz"; settype($f, "float"); var_dump($f); $b = "yes"; settype($b, "bool"); var_dump($b); $ar = "x"; settype($ar, "array"); var_dump($ar);
var_dump(is_int("1"), is_string(1), is_float(1.0), is_bool(0), is_array(array()), is_object(new stdClass), is_scalar(null), is_numeric("1.5e3"), is_resource(fopen("php://stdin", "r")));
echo gettype(1 + 1.0), gettype("1" + 1), gettype("1.0" + 1), gettype("1e0" + 1), gettype(10 / 2), gettype(10 / 3), gettype(7 % 2), "\n";
