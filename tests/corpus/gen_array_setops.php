<?php
error_reporting(E_ALL);
function p($a) { $o = array(); foreach ($a as $k => $v) $o[] = "$k=$v"; echo "{", implode(" ", $o), "}\n"; }
$a = array("a" => "green", "red", "blue", "red", 1, "1", "01", 1.0);
$b = array("b" => "green", "yellow", "red", "1");
$c = array("red", "purple", 1);
p(array_diff($a, $b));
p(array_diff($b, $a));
p(array_diff($a, $b, $c));
p(array_intersect($a, $b));
p(array_intersect($a, $b, $c));
p(array_intersect($b, $a));
p(array_diff(array(), $a));
p(array_diff($a, array()));
p(array_intersect(array(1, 2, 3), array()));
p(array_diff(array("1.0", "1", 1, "01"), array(1)));
p(array_intersect(array("1.0", "1", 1, "01"), array("1")));
p(array_diff(array(null, false, 0, "", "0"), array("")));
p(array_intersect(array(null, false, 0, "", "0"), array("0")));
p(@array_diff(array(1), "x"));
echo function_exists('array_diff_assoc') ? "has diff_assoc\n" : "no diff_assoc\n";
echo function_exists('array_intersect_assoc') ? "has int_assoc\n" : "no int_assoc\n";
echo function_exists('array_reduce') ? "has reduce\n" : "no reduce\n";
function sum($c, $i) { return $c + $i; }
function cat($c, $i) { return $c . "-" . $i; }
if (function_exists('array_reduce')) {
    var_dump(array_reduce(array(1, 2, 3, 4), "sum"));
    var_dump(array_reduce(array(1, 2, 3, 4), "sum", 10));
    var_dump(array_reduce(array(), "sum"));
    var_dump(array_reduce(array(), "sum", "init"));
    var_dump(array_reduce(array("a", "b"), "cat", "S"));
}
var_dump(array_sum(array(1, 2, 3.5, "4", "5x", "abc", true, null)));
var_dump(array_sum(array()));
var_dump(array_sum(array(2147483647, 1)));
var_dump(array_sum(array("1e3", " 2")));
// filter
function odd($v) { return $v & 1; }
function nonempty($v) { return !empty($v); }
p(array_filter(array(1, 2, 3, 4, 5, 6, 7), "odd"));
p(array_filter(array("a" => 0, "b" => 1, "c" => "", "d" => "0", "e" => "x", "f" => null, "g" => array())));
p(array_filter(array(5, 0, 6), "nonempty"));
// map
function dbl($v) { return $v * 2; }
function join2($a, $b) { return "$a:$b"; }
function join3($a, $b, $c) { return "$a/$b/$c"; }
p(array_map("dbl", array(1, 2, "x" => 3)));
p(array_map("join2", array(1, 2, 3), array("a", "b")));
p(array_map("join3", array(1), array(2, 3), array("k" => 4)));
p(array_map("strtoupper", array("k1" => "abc", "k2" => "def")));
p(array_map("trim", array(" a ", "\tb\n")));
p(@array_map("nosuchfunc", array(1)));
// walk
function w($v, $k) { echo "[$k:$v]"; }
function w2(&$v, $k, $pre) { $v = "$pre$k$v"; }
$arr = array("x" => 1, "y" => 2, 3);
array_walk($arr, "w"); echo "\n";
array_walk($arr, "w2", "P-"); p($arr);
$arr2 = array(1, 2); @array_walk($arr2, "nosuch"); p($arr2);
p(array_rand_seeded());
function array_rand_seeded() { srand(42); mt_srand(42); $r = array_rand(array("a" => 1, "b" => 2, "c" => 3, "d" => 4, "e" => 5), 3); return $r; }
srand(7); mt_srand(7); var_dump(array_rand(array(10, 20, 30)));
srand(1); mt_srand(1); $s = range(1, 10); shuffle($s); p($s);
srand(99); mt_srand(99); $s = array("a", "b", "c", "d"); shuffle($s); p($s);
var_dump(@array_rand(array(1, 2), 5));
?>
