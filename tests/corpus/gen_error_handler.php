<?php
error_reporting(E_ALL);
function handler($no, $str, $file, $line) {
    echo "HANDLER: no=$no str=[$str] file=", basename($file), " line=$line\n";
    return true;
}
function handler2($no, $str) { echo "H2: $no $str\n"; }
$old = set_error_handler("handler");
var_dump($old);
echo $undefined_var, "\n";
$arr = array(); echo @$arr["nokey"], "|\n";
echo $arr["nokey2"], "|\n";
echo 1 / 0, "|\n";
trigger_error("custom notice");
trigger_error("custom warning", E_USER_WARNING);
trigger_error("custom notice2", E_USER_NOTICE);
user_error("user_error alias", E_USER_NOTICE);
@trigger_error("suppressed", E_USER_WARNING);
str_repeat();
$old2 = set_error_handler("handler2");
echo "old2=$old2\n";
echo UNDEF_CONSTANT_Y, "\n";
restore_error_handler();
echo $another_undefined, "\n";
restore_error_handler();
echo "after restoring all:\n";
echo $third_undefined, "|\n";
error_reporting(E_ALL & ~E_NOTICE);
echo $fourth_undefined, "|no notice\n";
echo error_reporting(), "\n";
echo error_reporting(E_ERROR | E_WARNING), " ", error_reporting(), "\n";
trigger_error("warning shown", E_USER_WARNING);
trigger_error("notice hidden", E_USER_NOTICE);
error_reporting(0);
trigger_error("nothing shown", E_USER_WARNING);
echo 5 % 0, "|\n";
error_reporting(E_ALL);
var_dump(@(5 % 0));
$php_errormsg = "unset";
ini_set("track_errors", 1);
@strpos();
echo "php_errormsg=", $php_errormsg, "\n";
@$x = 1 / 0;
echo "php_errormsg=", $php_errormsg, "\n";
set_error_handler("nonexistent_handler_fn");
echo $still_undefined, "|\n";
restore_error_handler();
trigger_error("bad level", 12345);
var_dump(assert(true), @assert(false));
assert_options(ASSERT_WARNING, 0);
var_dump(assert(1 == 2), assert("1 == 1"), assert_options(ASSERT_ACTIVE));
echo "fatal at end:\n";
trigger_error("custom fatal", E_USER_ERROR);
echo "not reached\n";
?>
