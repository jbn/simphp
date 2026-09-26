<?php
function f($a, $b = 2, $c = array(1)) { return func_num_args() . ":" . $a . $b . count($c); }
echo f(1), " ", f(1, 3), " ", f(1, 3, array(1, 2)), "\n";
function g() { $args = func_get_args(); return implode(",", $args) . "|" . func_get_arg(1); }
echo g(5, 6, 7), "\n";
function &getref(&$arr) { return $arr[0]; }
$x = array(1, 2); $r =& getref($x); $r = 99; echo $x[0], "\n";
function counter() { static $n = 0; return ++$n; }
counter(); counter(); echo counter(), "\n";
function fact($n) { return $n <= 1 ? 1 : $n * fact($n - 1); }
echo fact(10), " ", fact(20), "\n";
$GLOBALS['gv'] = 10;
function useglobal() { global $gv; $gv++; return $GLOBALS['gv']; }
echo useglobal(), "\n";
function byref(&$v) { $v .= "!"; }
$s = "hi"; byref($s); echo $s, "\n";
$t = "call"; byref(&$t); echo $t, "\n";
echo function_exists('fact') ? "yes" : "no", function_exists('FACT') ? "yes" : "no", function_exists('nope') ? "yes" : "no", "\n";
echo call_user_func('fact', 5), " ", call_user_func_array('f', array(9, 8, array())), "\n";
$fn = create_function('$a,$b', 'return $a * $b;');
echo $fn(6, 7), " ", substr($fn, 1), "\n";
function nested() { if (!function_exists('inner')) { function inner() { return "inner!"; } } return inner(); }
echo nested(), nested(), "\n";
function defaults($a = null, $b = PHP_VERSION) { return var_export($a, true) . $b; }
echo defaults(), "\n";
echo strlen(serialize(get_defined_functions())) > 100 ? "ok" : "bad", "\n";
$u = get_defined_functions(); print_r($u['user']);
function recurse($n) { return $n == 0 ? 0 : 1 + recurse($n - 1); }
echo recurse(5000), "\n";
register_shutdown_function('bye', 'arg');
function bye($a) { echo "shutdown $a\n"; }
echo "end\n";
