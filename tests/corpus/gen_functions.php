<?php
error_reporting(E_ALL);
function defs($a, $b = 2, $c = "three", $d = null, $e = array(1, 2)) {
    $all = func_get_args();
    echo "a=$a b=$b c=$c d=", var_s($d), " e=", count($e), " nargs=", func_num_args(), " args=", @implode("|", $all), "\n";
}
function var_s($v) { return is_null($v) ? "NULL" : (is_bool($v) ? ($v ? "T" : "F") : $v); }
defs(1); defs(1, 5); defs(1, 5, 6, 7); defs(1, 2, 3, 4, array(), 6, 7);
function varargs() { $n = func_num_args(); $s = 0; for ($i = 0; $i < $n; $i++) $s += func_get_arg($i); return "$n:$s"; }
echo varargs(), " ", varargs(1), " ", varargs(1, 2, 3.5, "4"), "\n";
function getarg() { return @func_get_arg(5); }
var_dump(getarg(1));
function counter() { static $n = 0; static $arr = array(); $n++; $arr[] = $n; return implode(",", $arr); }
echo counter(), " ", counter(), " ", counter(), "\n";
$g = "global value";
function useglobal() { global $g; $g .= "!"; return $g; }
function viaGLOBALS() { $GLOBALS['g'] .= "?"; return $GLOBALS['g']; }
function noglobal() { return isset($g) ? "set" : "unset"; }
echo useglobal(), " ", viaGLOBALS(), " ", noglobal(), "\n";
function fact($n) { return $n <= 1 ? 1 : $n * fact($n - 1); }
function fib($n) { return $n < 2 ? $n : fib($n - 1) + fib($n - 2); }
echo fact(10), " ", fact(20), " ", fib(20), "\n";
function addone(&$x) { $x++; }
$v = 5; addone($v); echo $v, "\n";
$arr = array(1, 2); addone($arr[0]); addone($arr[5]); print_r($arr);
function &getref(&$arr) { return $arr[0]; }
$data = array(10, 20); $r = &getref($data); $r = 99; echo implode(",", $data), "\n";
$fn = "strtoupper"; echo $fn("variable func"), "\n";
$fn = "fact"; echo $fn(5), "\n";
$cf = create_function('$x,$y', 'return $x * $y;');
echo $cf(6, 7), " ", call_user_func($cf, 2, 3), " ", substr($cf, 1), "\n";
$cf2 = create_function('', 'return "no args";'); echo $cf2(), "\n";
echo call_user_func("str_repeat", "ab", 3), " ", call_user_func_array("defsret", array(1, 2)), "\n";
function defsret($a, $b = 0) { return $a + $b; }
var_dump(function_exists("fact"), function_exists("FACT"), function_exists("strlen"), function_exists("nope"), function_exists("inner"));
function outer() { if (!function_exists("inner")) { function inner() { return "inner!"; } } return inner(); }
echo outer(), " ", outer(), " ", inner(), "\n";
if (true) { function condfn() { return "cond"; } }
echo condfn(), "\n";
function shut1() { echo "shutdown 1\n"; }
function shut2($a, $b) { echo "shutdown 2 $a $b\n"; }
register_shutdown_function("shut1");
register_shutdown_function("shut2", "x", "y");
register_shutdown_function("shut1");
function byval($a) { $a[] = 4; return count($a); }
$big = array(1, 2, 3); echo byval($big), count($big), "\n";
function nested_default($a = array("x" => array(1, 2))) { return $a["x"][1]; }
echo nested_default(), "\n";
function constdef($a = M_PI) { return round($a, 2); }
echo constdef(), "\n";
function recursive_sum($a) { $s = 0; foreach ($a as $v) $s += is_array($v) ? recursive_sum($v) : $v; return $s; }
echo recursive_sum(array(1, array(2, array(3, array(4))), 5)), "\n";
echo @call_user_func("nonexistent_fn"), "|\n";
defs();
echo "end of script\n";
?>
