<?php
error_reporting(E_ALL);
$vals = array(0, 1, -1, 0.5, -0.5, 1.5, -1.5, 2.5, -2.5, 1.4999999, 1.95583, 5.045, 5.055, 1234.5678, -1234.5678, 0.285, 1.005, 2.675, 1e15 + 0.5, 3, "3.7", "-3.2", "abc", null, true, 2147483647.5);
foreach ($vals as $v) {
    echo var_s($v), ": abs=", var_s(abs($v)), " ceil=", var_s(ceil($v)), " floor=", var_s(floor($v)), " round=", var_s(round($v));
    foreach (array(1, 2, 3, -1, -2) as $p) echo " r$p=", var_s(round($v, $p));
    echo "\n";
}
function var_s($v) { ob_start(); var_dump($v); $s = trim(ob_get_contents()); ob_end_clean(); return $s; }
echo var_s(abs(-2147483647 - 1)), var_s(abs(-2147483647)), var_s(abs("-5")), var_s(abs("-5.5")), "\n";
echo var_s(round(-0.4)), var_s(ceil(-0.5)), var_s(floor(-0.0)), "\n";
echo var_s(round(1234567.891, -3)), var_s(round(1234567.891, -7)), var_s(round(0.123456789, 8)), var_s(round(5, 2)), "\n";
// integer overflow
$m = 2147483647;
echo var_s($m + 1), var_s($m + $m), var_s($m * 2), var_s(-$m - 1), var_s(-$m - 2), var_s($m * $m), "\n";
$i = $m; $i++; echo var_s($i), "\n";
$i = -$m - 1; $i--; echo var_s($i), "\n";
$i = -$m - 1; echo var_s($i), var_s(-$i), var_s($i * -1), "\n";
echo var_s(2147483648), var_s(-2147483648), var_s(4294967296), var_s(0x7FFFFFFF), var_s(0xFFFFFFFF), var_s(017777777777), var_s(0x100000000), "\n";
echo var_s(7 / 2), var_s(6 / 2), var_s(-7 / 2), var_s(1 / 3), var_s(10 / 4), var_s("10" / "5"), "\n";
echo var_s(7 % 3), var_s(-7 % 3), var_s(7 % -3), var_s(-7 % -3), var_s(7.9 % 3), var_s("8" % "3"), var_s(2147483648 % 3), var_s(5 % 2147483648), "\n";
echo var_s(1 + "1"), var_s("1.5" + 1), var_s("1e2" + 0), var_s("0x10" + 0), var_s("010" + 0), var_s(" 42" + 0), var_s("42abc" + 0), var_s(".5" + 0), var_s("-.5e1" + 0), "\n";
// bitwise
foreach (array(array(5, 3), array(-1, 1), array(-8, 3), array(0x7FFFFFFF, -1), array(-2147483647 - 1, 1)) as $pr) {
    list($a, $b) = $pr;
    echo "$a,$b: & ", $a & $b, " | ", $a | $b, " ^ ", $a ^ $b, " ~a ", ~$a, " << ", $a << $b, " >> ", $a >> $b, "\n";
}
foreach (array(0, 1, 31, 32, 33, 63, 64, -1) as $s) echo "1<<$s=", 1 << $s, " -16>>$s=", -16 >> $s, " ";
echo "\n";
echo "12" & "10", "|", "abc" | "  ", "|", bin2hex("ab" ^ "  "), "|", bin2hex(~"abc"), "|", 12 & "10", "\n";
echo var_s(1.9 & 3), var_s(2147483648 | 0), var_s(3000000000 & 1), var_s(-1.5 | 0), "\n";
?>
