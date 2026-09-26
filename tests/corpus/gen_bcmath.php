<?php
error_reporting(E_ALL);
if (!function_exists('bcadd')) { echo "no bcmath\n"; exit; }
$pairs = array(array("1", "2"), array("123456789012345678901234567890", "987654321098765432109876543210"), array("-5", "3"), array("0.1", "0.2"), array("1.23456789", "-9.87654321"), array("0", "0"), array("abc", "5"), array("10", "0.0001"), array("-0.5", "-0.5"), array("99999999999999999999", "1"), array("1e5", "1"), array(" 5", "5"), array("+7", "3"));
foreach ($pairs as $p) {
    list($a, $b) = $p;
    echo "$a,$b:";
    foreach (array(0, 2, 10) as $sc) {
        echo " s", $sc, "[", bcadd($a, $b, $sc), " ", bcsub($a, $b, $sc), " ", bcmul($a, $b, $sc), " ", @bcdiv($a, $b, $sc), " ", @bcmod($a, $b), " ", bccomp($a, $b, $sc), "]";
    }
    echo "\n";
}
foreach (array("2", "3", "0", "-1", "0.5", "100", "1.44", "123456789", "-4") as $x) {
    echo "sqrt($x)=", @bcsqrt($x, 10), " pow($x,3)=", bcpow($x, "3", 4), " pow($x,-2)=", @bcpow($x, "-2", 6), "\n";
}
echo bcpow("2", "100"), "\n", bcpow("-3", "33"), "\n", bcpow("1.1", "20", 30), "\n", bcpow("10", "0"), "\n";
echo bcdiv("1", "3", 50), "\n", bcdiv("22", "7", 30), "\n", bcdiv("-1", "8", 5), "\n";
echo bcmul("-0.001", "1000", 2), " ", bcmul("123.456", "0", 5), " ", bcadd("-0", "0", 3), " ", bcsub("0.00", "0.001", 2), "\n";
bcscale(5);
echo bcadd("1", "2"), " ", bcdiv("10", "3"), " ", bcsqrt("2"), " ", bcmul("1.5", "1.5"), "\n";
bcscale(0);
echo bcadd("1.9", "0.1"), " ", bcdiv("7", "2"), " ", bcmod("-7", "3"), " ", bcmod("7", "-3"), " ", bcmod("10.5", "3"), "\n";
echo bccomp("1.0001", "1", 3), bccomp("1.0001", "1", 4), bccomp("-1", "1"), bccomp("abc", "0"), "\n";
echo bcadd("1", "2", -1), " ", bcsub("5"), "\n";
?>
