<?php
error_reporting(E_ALL);
class CObj { var $a = 1; }
class CObj2 { var $a = 2; }
$vals = array(
    "null" => null, "true" => true, "false" => false, "0" => 0, "1" => 1, "-1" => -1, "0.0" => 0.0, "1.5" => 1.5,
    "'0'" => "0", "''" => "", "'1'" => "1", "'1.0'" => "1.0", "'abc'" => "abc", "'ABC'" => "ABC", "'1e1'" => "1e1", "'10'" => "10", "' 1'" => " 1",
    "'null'" => "null", "[]" => array(), "[1]" => array(1), "[0=>2]" => array(2), "['a'=>1]" => array("a" => 1), "obj" => new CObj, "obj2" => new CObj2,
);
$names = array_keys($vals);
echo "== (loose) ===(strict) <  >  in each cell: e s l g\n";
echo str_pad("", 9);
foreach ($names as $n) echo str_pad(substr($n, 0, 5), 6);
echo "\n";
foreach ($names as $an) {
    $a = $vals[$an];
    echo str_pad($an, 9);
    foreach ($names as $bn) {
        $b = $vals[$bn];
        $cell = ($a == $b ? "e" : ".") . ($a === $b ? "s" : ".") . ($a < $b ? "l" : ".") . ($a > $b ? "g" : ".");
        echo $cell, "  ";
    }
    echo "\n";
}
echo "== != <> !== <= >=\n";
foreach (array(array(1, "1"), array("abc", 0), array(null, 0), array("1e3", "1000"), array("10", "9"), array("10", "9a"), array(array(1, 2), array(2 => 1)), array(array("a" => 1, "b" => 2), array("b" => 2, "a" => 1))) as $p) {
    list($a, $b) = $p;
    echo var_dump_s($a), " vs ", var_dump_s($b), ": ", (int)($a != $b), (int)($a <> $b), (int)($a !== $b), (int)($a <= $b), (int)($a >= $b), "\n";
}
function var_dump_s($x) { ob_start(); var_dump($x); $s = ob_get_contents(); ob_end_clean(); return str_replace("\n", "", $s); }
// switch loose comparison
foreach (array(0, "0", "", null, "a", 1, "1", true, false, "1e0", 1.0) as $v) {
    echo var_dump_s($v), " -> ";
    switch ($v) {
        case "a": echo "case a"; break;
        case 1: echo "case 1"; break;
        case "": echo "case ''"; break;
        case 0: echo "case 0"; break;
        default: echo "default";
    }
    echo "\n";
}
?>
