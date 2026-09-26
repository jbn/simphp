<?php
error_reporting(E_ALL);
function t1() {
    $a = "orig";
    $arr = array("a" => "new", "b" => "bee", "1bad" => "x", "c d" => "y", "_u" => "under", "" => "empty");
    $n = extract($arr);
    echo "n=$n a=$a b=$b _u=$_u\n";
}
t1();
function t2($flag, $prefix = null) {
    $a = "orig"; $b = "origb";
    $arr = array("a" => "new", "c" => "cee", 0 => "zero", "1x" => "one");
    if ($prefix === null) $n = extract($arr, $flag); else $n = extract($arr, $flag, $prefix);
    $vars = get_defined_vars();
    unset($vars['arr'], $vars['flag'], $vars['prefix'], $vars['n']);
    ksort($vars);
    echo "flag=$flag n=", var_export2($n), " vars=";
    foreach ($vars as $k => $v) echo "$k=$v ";
    echo "\n";
}
function var_export2($x) { return is_null($x) ? "NULL" : (is_bool($x) ? ($x ? "T" : "F") : $x); }
t2(EXTR_OVERWRITE);
t2(EXTR_SKIP);
t2(EXTR_PREFIX_SAME, "p");
t2(EXTR_PREFIX_ALL, "p");
t2(EXTR_PREFIX_INVALID, "p");
if (defined('EXTR_IF_EXISTS')) t2(EXTR_IF_EXISTS); else echo "no EXTR_IF_EXISTS\n";
if (defined('EXTR_PREFIX_IF_EXISTS')) t2(EXTR_PREFIX_IF_EXISTS, "p"); else echo "no EXTR_PREFIX_IF_EXISTS\n";
if (defined('EXTR_REFS')) echo "has EXTR_REFS\n"; else echo "no EXTR_REFS\n";
echo EXTR_OVERWRITE, EXTR_SKIP, EXTR_PREFIX_SAME, EXTR_PREFIX_ALL, EXTR_PREFIX_INVALID, "\n";
function t3() { $r = @extract(array("a" => 1), 99); var_dump($r); $r = @extract("notarray"); var_dump($r); $r = @extract(array("a" => 1), EXTR_PREFIX_ALL); var_dump($r); }
t3();
function t4() {
    $city = "SF"; $state = "CA"; $event = "x"; $nested = array("q" => 1);
    $location = array("city", "state");
    $r = compact("event", "nothere", $location, array("nested", array("city")));
    ksort($r);
    foreach ($r as $k => $v) echo "$k=", is_array($v) ? "arr" : $v, " ";
    echo "\n";
    print_r(compact());
    print_r(compact("this"));
}
t4();
$GLOBALS['gv'] = "global";
function t5() { extract(array("gv" => "local")); echo $gv, " ", $GLOBALS['gv'], "\n"; }
t5();
extract(array("topv" => "set at top"));
echo $topv, "\n";
?>
