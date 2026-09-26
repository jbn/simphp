<?php
error_reporting(E_ALL);
$vals = array(0.1, 0.2, 0.3, 0.1 + 0.2, 1/3, 2/3, 1/7, 1e14, 1e15, 1e16, 1e17, 123456789012345.0, 1234567890123456.0, 12345678901234567.0, 0.00001, 0.0001, 1e-5, 1.5e-7, 1e-10, 1e-300, 1e300, 1.7976931348623157e308, 4.9e-324, -0.0, 100.0, 1e2, 1.0, 3.0e0, 2.5, 99999999999999.9, 999999999999999.9, 0.1 * 3, 1 - 0.9, 1e22, 1e21, 1e20, 123e18, 5e-1, 1.23456789012345678, -1.5e-5, 314.15926e-2);
foreach (array(14, 1, 2, 5, 10, 12, 15, 16, 17, 20, 0, 40) as $prec) {
    ini_set("precision", $prec);
    echo "precision=", ini_get("precision"), ":";
    foreach ($vals as $v) echo " ", $v;
    echo "\n";
}
ini_set("precision", 14);
for ($i = 0; $i <= 20; $i++) echo $i / 10, " ";
echo "\n";
for ($i = 1; $i <= 12; $i++) echo $i / 3, " ";
echo "\n";
$f = 0.0; for ($i = 0; $i < 20; $i++) { $f += 0.1; echo $f, " "; }
echo "\n";
for ($e = 10; $e <= 22; $e++) echo pow(10, $e), " ", pow(10, $e) + 1, " ", -pow(10, $e), "\n";
for ($e = -1; $e >= -8; $e--) echo pow(10, $e), " ", 3 * pow(10, $e), "\n";
var_dump(0.1 + 0.2 == 0.3, 1e15 + 1, 1e16 + 1, (string)1e16, strval(0.00001), 7.0, -7.0, 1e100);
echo 1.0, " ", 2.50, " ", -0.0, " ", 0.0, " ", 1e0, " ", (float)"1e3", " ", 1.23e+2, "\n";
echo round(3.14159, 3) . "", " ", 10/3 . "", " ", 1e6 . "", " ", 1e15 . "x", "\n";
$s = serialize(array(0.1, 1/3, 1e100, -0.0, 1e-7)); echo $s, "\n";
print_r(array(0.1, 1/3, 1e20)); echo "\n";
echo intval(0.1 + 0.7) * 10, " ", (int)((0.1 + 0.7) * 10), " ", floor((0.1 + 0.7) * 10), "\n";
echo number_format(0.5), number_format(1.5), number_format(2.5), " ", number_format(1e20, 2), "\n";
echo 9007199254740993, " ", 9007199254740992.0 + 1, " ", 2147483647 + 0.5, "\n";
echo str_repeat("=", 10), "\n";
echo 5 . 5, " ", 5.5 . 5, " ", -5 . "", "\n";
?>
