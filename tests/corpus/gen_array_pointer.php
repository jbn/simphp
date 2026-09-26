<?php
error_reporting(E_ALL);
function v($x) { if ($x === false) return "F"; if ($x === null) return "N"; if ($x === true) return "T"; if (is_array($x)) { $o = array(); foreach ($x as $k => $vv) $o[] = "$k=>" . v($vv); return "[" . implode(",", $o) . "]"; } return "'$x'"; }
$a = array("a" => 1, "b" => 2, "c" => 3, 10 => false, "e" => null);
echo v(current($a)), v(key($a)), v(next($a)), v(key($a)), v(next($a)), v(next($a)), v(key($a)), v(next($a)), v(key($a)), v(next($a)), v(key($a)), v(current($a)), "\n";
echo v(prev($a)), v(reset($a)), v(end($a)), v(key($a)), v(prev($a)), v(prev($a)), v(prev($a)), v(prev($a)), v(prev($a)), v(prev($a)), v(key($a)), "\n";
reset($a);
while (list($k, $val) = each($a)) echo "$k:", v($val), " ";
echo "\n";
echo v(each($a)), "\n";
reset($a);
echo v(each($a)), "\n";
$e = array();
echo v(current($e)), v(key($e)), v(next($e)), v(reset($e)), v(end($e)), v(each($e)), "\n";
// foreach resets and copies
$b = array(1, 2, 3);
next($b);
foreach ($b as $x) { }
echo v(current($b)), "\n";
$b = array(1, 2, 3);
foreach ($b as $k => $x) { if ($k == 0) { $b[] = 4; } echo $x; }
echo " ", count($b), "\n";
$c = $b; next($c); next($c); $d = $c; echo v(current($d)), "\n";
// list()
list($x, $y, $z) = array(1, 2, 3); echo "$x$y$z\n";
list($x, , $z) = array("a", "b", "c"); echo "$x$z\n";
list($x, list($y, $z)) = array(1, array(2, 3)); echo "$x$y$z\n";
@list($p, $q, $r) = array(1, 2); echo v($p), v($q), v($r), "\n";
list($m, $n) = array("k" => 1, 1 => "one"); echo v($m), v($n), "\n";
list($s1, $s2) = "ab"; echo v($s1), v($s2), "\n";
$arr = array();
list($arr[0], $arr[1], $arr[2]) = array("x", "y", "z");
echo v($arr), "\n";
list(, , $last) = array(1, 2, 3); echo $last, "\n";
list($aa, $bb) = array($bb = 5, 6); echo $aa, $bb, "\n";
// count
$n = array(1, array(2, 3, array(4, 5)), array());
echo defined("COUNT_RECURSIVE") ? "has COUNT_RECURSIVE " : "no COUNT_RECURSIVE ";
echo count($n), " ", count(null), " ", count("str"), " ", count(0), " ", count(array()), " ", sizeof($n), "\n";
// casting
echo v((array)"str"), v((array)5), v((array)null), v((array)true), v((array)1.5), v((array)array(1)), "\n";
class P { var $a = 1; var $b = array(2); }
echo v((array)new P), "\n";
$o = (object)array("x" => 1, "y" => 2); echo get_class($o), v(get_object_vars($o)), "\n";
$o = (object)"scalar"; echo v(get_object_vars($o)), "\n";
// references
$src = array(1, 2, 3);
$ref = &$src[1];
$copy = $src;
$copy[1] = 99;
echo v($src), v($copy), "\n";
unset($ref);
$z = array("a" => array("b" => 1));
$zz = &$z["a"]["b"]; $zz = 7; echo v($z), "\n";
$arrs = array(1, 2, 3); foreach ($arrs as $k => $vv) $arrs[$k] = $vv * 10; echo v($arrs), "\n";
?>
