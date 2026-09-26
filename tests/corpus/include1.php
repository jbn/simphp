<?php
$r = include 'inc/a.php'; echo $r, " ", $inc_var, " ", from_a(), "\n";
$r2 = include_once 'inc/a.php'; var_dump($r2);
include 'inc/b.php'; include 'inc/b.php'; echo "b_counter=$b_counter\n";
var_dump(include_once 'inc/b.php');
function scoped() { include 'inc/b.php'; return isset($b_counter) ? $b_counter : 'unset'; }
echo scoped(), "\n";
print_r(get_included_files()); print_r(get_required_files());
echo (include 'inc/missing.php') === false ? "false\n" : "other\n";
ini_set('include_path', '.:/t/inc'); include 'b.php'; echo ini_get('include_path'), "\n";
eval('echo "eval ok\n"; $ev = 5;'); echo $ev, "\n";
$ret = eval('return 1+2;'); var_dump($ret);
eval('echo "unterminated;');
echo "after bad eval\n";
require 'inc/missing2.php';
echo "not reached\n";
