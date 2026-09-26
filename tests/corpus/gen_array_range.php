<?php
error_reporting(E_ALL);
function p($a) { $o = array(); foreach ($a as $k => $v) { if (is_float($v)) $v = "f$v"; $o[] = "$k=$v"; } echo "{", implode(" ", $o), "}\n"; }
p(range(0, 5));
p(range(5, 0));
p(range(-3, 3));
p(range("a", "e"));
p(range("e", "a"));
p(range("A", "z"));
p(range("aa", "zz"));
p(range(0, 1, 0.25));
p(range(1.2, 5.9));
p(range("0", "9"));
p(range(-5, -1));
p(range("z", "w"));
p(range(1, 1));
p(range("1", "3"));
p(range("5", "1"));
p(range(1.5, 4));
p(range(0, 0.5, 0.1));
p(range(-1.5, -3.5));
p(range(2147483640, 2147483643));
echo function_exists('array_fill') ? "has array_fill\n" : "no array_fill\n";
// keys/search
$arr = array("a" => 1, "b" => "1", "c" => 2, "d" => true, "e" => null, "f" => "x", "g" => 0, 5 => "1.0");
p(array_keys($arr));
p(array_keys($arr, 1));
p(array_keys($arr, "1"));
p(array_keys($arr, null));
p(array_keys($arr, 0));
p(array_keys($arr, "x"));
p(array_values($arr));
foreach (array(1, "1", "1.0", true, false, null, 0, "x", "0", 2.0, "a") as $needle) {
    $r1 = array_search($needle, $arr);
    $r2 = array_search($needle, $arr, true);
    echo var_str($needle), ": search=", var_str($r1), " strict=", var_str($r2), " in=", var_str(in_array($needle, $arr)), " instrict=", var_str(in_array($needle, $arr, true)), "\n";
}
function var_str($v) { if (is_bool($v)) return $v ? "T" : "F"; if (is_null($v)) return "N"; if (is_string($v)) return "'$v'"; return gettype($v) . "($v)"; }
$k = array("a" => null, "b" => 0, "c" => false, "d" => "", 1 => array());
foreach (array("a", "b", "c", "d", "e", 1, "1", 2) as $key) {
    echo "$key: ake=", var_str(array_key_exists($key, $k)), " isset=", var_str(isset($k[$key])), " empty=", var_str(empty($k[$key])), "\n";
}
var_dump(@array_search("a", "notarray"));
var_dump(@in_array("a", "b"));
var_dump(in_array(array(1), array(array(1), 2)));
var_dump(in_array("abc", array(0)));
var_dump(in_array(null, array("")));
var_dump(in_array(null, array(""), true));
var_dump(array_search("1e1", array("10")));
?>
