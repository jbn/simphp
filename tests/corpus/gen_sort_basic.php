<?php
error_reporting(E_ALL);
function show($label, $a) {
    echo str_pad($label, 12), ":";
    foreach ($a as $k => $v) {
        if (is_bool($v)) $v = $v ? "T" : "F";
        elseif (is_null($v)) $v = "N";
        elseif (is_float($v)) $v = "f" . $v;
        elseif (is_string($v)) $v = "'" . $v . "'";
        echo " $k=>$v";
    }
    echo "\n";
}
$sets = array(
    "ints" => array(5, 3, -1, 10, 0, 3, 2147483647, -2147483647),
    "strs" => array("banana", "apple", "Cherry", "apple10", "apple9", "", "Apple", "_x"),
    "numstr" => array("10", "9", "2", "1", "010", "1e1", "0x1A", " 5", "5 ", "-3"),
    "mixed" => array(3, "3", "abc", 2.5, "2.5", true, null, "", 0, "0", "10", -1),
    "floats" => array(1.5, 1.25, -0.5, 1e10, 1e-10, 0.1, 0.3, 0.2),
    "assoc" => array("b" => 2, "a" => 3, "c" => 1, "10" => 5, "9" => 4, "x" => 2),
);
foreach ($sets as $name => $arr) {
    echo "== $name\n";
    $a = $arr; sort($a); show("sort", $a);
    $a = $arr; rsort($a); show("rsort", $a);
    $a = $arr; sort($a, SORT_STRING); show("sort str", $a);
    $a = $arr; sort($a, SORT_NUMERIC); show("sort num", $a);
    $a = $arr; sort($a, SORT_REGULAR); show("sort reg", $a);
    $a = $arr; asort($a); show("asort", $a);
    $a = $arr; arsort($a); show("arsort", $a);
    $a = $arr; asort($a, SORT_STRING); show("asort str", $a);
    $a = $arr; ksort($a); show("ksort", $a);
    $a = $arr; krsort($a); show("krsort", $a);
    $a = $arr; ksort($a, SORT_STRING); show("ksort str", $a);
    $a = $arr; natsort($a); show("natsort", $a);
    $a = $arr; natcasesort($a); show("natcase", $a);
}
$k = array("10" => 'a', "9" => 'b', "a" => 'c', "B" => 'd', "-1" => 'e', "01" => 'f', "" => 'g', "1.5" => 'h');
$a = $k; ksort($a); show("ksort mix", $a);
$a = $k; krsort($a); show("krsort mix", $a);
$a = $k; ksort($a, SORT_NUMERIC); show("ksort num", $a);
$e = array(); sort($e); show("empty", $e);
$x = "notarray"; var_dump(@sort($x));
sort($x);
$n = array(array(2, 1), array(1, 2), array(1), array(3)); sort($n);
foreach ($n as $v) echo implode(",", $v), ";";
echo "\n";
?>
