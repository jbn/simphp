<?php
error_reporting(E_ALL);
function upper($buf) { return strtoupper($buf); }
function wrap($buf) { return "[" . strlen($buf) . ":" . $buf . "]"; }
function nothing($buf) { return false; }
function rev($buf, $mode = null) { return strrev($buf); }
ob_start();
echo "level1 ";
ob_start("upper");
echo "level2 ";
ob_start("wrap");
echo "level3";
ob_end_flush();
echo " after3 ";
ob_end_flush();
$c = ob_get_contents();
ob_end_clean();
echo "captured: [$c]\n";
ob_start("wrap"); echo "abc"; echo " len=", ob_get_length(); ob_end_flush(); echo "\n";
ob_start("nothing"); echo "returned false keeps original"; ob_end_flush(); echo "\n";
ob_start("rev"); echo "reversed text"; ob_end_flush(); echo "\n";
ob_start(); echo "discard me"; ob_end_clean();
ob_start(); echo "one"; if (function_exists("ob_flush")) { ob_flush(); } else { echo "(no ob_flush)"; } echo "two"; $x = ob_get_contents(); ob_end_clean(); echo "\nx=$x\n";
ob_start(); echo "a"; if (function_exists("ob_clean")) { ob_clean(); } else { echo "(no ob_clean)"; } echo "b"; $y = ob_get_contents(); ob_end_clean(); echo "y=$y\n";
var_dump(@ob_end_flush(), @ob_end_clean(), ob_get_contents(), ob_get_length());
ob_start(); print "print returns "; $r = print ""; $z = ob_get_contents(); ob_end_clean(); echo $z, $r, "\n";
ob_start(); ob_start(); ob_start(); echo "deep"; ob_end_flush(); ob_end_flush(); $d = ob_get_contents(); ob_end_clean(); echo "deep=$d\n";
ob_start("ob_gzhandler_nope");
echo "invalid callback";
ob_end_flush();
echo "\n";
ob_start(array("Obc", "cb")); echo "static method cb"; ob_end_flush(); echo "\n";
class Obc { function cb($b) { return "<" . $b . ">"; } }
ob_start(); printf("%05d", 42); print_r(array(1)); var_dump(1.5); $all = ob_get_contents(); ob_end_clean();
echo strlen($all), ":", str_replace("\n", "|", $all), "\n";
ob_implicit_flush(1); ob_implicit_flush(0);
echo function_exists('ob_get_level') ? "has ob_get_level\n" : "no ob_get_level\n";
echo function_exists('ob_get_clean') ? "has ob_get_clean\n" : "no ob_get_clean\n";
echo function_exists('ob_list_handlers') ? "has ob_list_handlers\n" : "no ob_list_handlers\n";
ob_start("upper");
echo "unclosed buffer at end gets flushed through callback\n";
?>
