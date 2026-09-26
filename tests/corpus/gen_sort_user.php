<?php
error_reporting(E_ALL);
function cmp_len($a, $b) { $d = strlen($a) - strlen($b); if ($d == 0) return strcmp($a, $b); return $d; }
function cmp_rev($a, $b) { if ($a == $b) return 0; return ($a < $b) ? 1 : -1; }
function cmp_mod3($a, $b) { return ($a % 3) - ($b % 3); }
function cmp_bool($a, $b) { return $a > $b; }
function cmp_field($a, $b) { return strcmp($a['name'], $b['name']); }
$words = array("pear", "fig", "banana", "kiwi", "apple", "date", "a", "", "cherry");
$a = $words; usort($a, "cmp_len"); echo implode(",", $a), "\n";
$a = $words; usort($a, "cmp_rev"); echo implode(",", $a), "\n";
$a = $words; uasort($a, "cmp_len"); foreach ($a as $k => $v) echo "$k=$v "; echo "\n";
$a = array_flip($words); uksort($a, "cmp_len"); foreach ($a as $k => $v) echo "$k=$v "; echo "\n";
$a = array_flip($words); uksort($a, "cmp_rev"); echo implode(",", array_keys($a)), "\n";
$nums = array(9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 10, 11, 12);
$a = $nums; usort($a, "cmp_mod3"); echo implode(",", $a), "\n";
$a = $nums; usort($a, "cmp_bool"); echo implode(",", $a), "\n";
$a = $nums; uasort($a, "cmp_mod3"); foreach ($a as $k => $v) echo "$k=$v "; echo "\n";
$recs = array(array('name' => 'zed', 'age' => 3), array('name' => 'amy', 'age' => 30), array('name' => 'bob', 'age' => 3));
usort($recs, "cmp_field");
foreach ($recs as $r) echo $r['name'], ":", $r['age'], " "; echo "\n";
class Sorter { function by_age($a, $b) { return $a['age'] - $b['age']; } }
$s = new Sorter;
usort($recs, array($s, "by_age"));
foreach ($recs as $r) echo $r['name'], ":", $r['age'], " "; echo "\n";
usort($recs, array("Sorter", "by_age"));
foreach ($recs as $r) echo $r['name'], " "; echo "\n";
$f = create_function('$a,$b', 'return strcmp($b, $a);');
$a = $words; usort($a, $f); echo implode(",", $a), "\n";
$a = $words; @usort($a, "no_such_func"); echo count($a), "\n";
$a = array(1); usort($a, "cmp_rev"); echo implode(",", $a), "\n";
// array_multisort
$data1 = array(3, 1, 3, 2, 1);
$data2 = array("c", "b", "a", "d", "a");
array_multisort($data1, $data2);
echo implode(",", $data1), " | ", implode(",", $data2), "\n";
$data1 = array(3, 1, 3, 2, 1);
$data2 = array("c", "b", "a", "d", "a");
array_multisort($data1, SORT_DESC, $data2, SORT_ASC);
echo implode(",", $data1), " | ", implode(",", $data2), "\n";
$d1 = array("10", "9", "2", "1");
$d2 = array(1, 2, 3, 4);
array_multisort($d1, SORT_STRING, SORT_DESC, $d2);
echo implode(",", $d1), " | ", implode(",", $d2), "\n";
$d1 = array("10", 9, "2", 1); array_multisort($d1, SORT_NUMERIC); echo implode(",", $d1), "\n";
$ar = array("x" => 3, "y" => 1, 5 => 2, 7 => 0);
array_multisort($ar); foreach ($ar as $k => $v) echo "$k=$v "; echo "\n";
$a1 = array(1, 2); $a2 = array(1, 2, 3);
var_dump(@array_multisort($a1, $a2));
array_multisort($a1, $a2);
$a1 = array(3, 2, 1); var_dump(array_multisort($a1, SORT_ASC, SORT_DESC));
$a1 = array(3, 2, 1); array_multisort($a1, 99);
?>
