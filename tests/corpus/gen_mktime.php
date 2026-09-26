<?php
error_reporting(E_ALL);
putenv("TZ=UTC");
function d($ts) { return $ts === -1 ? "-1" : ($ts === false ? "false" : date("Y-m-d H:i:s", $ts) . " ($ts)"); }
$cases = array(
    array(0, 0, 0, 1, 1, 2002), array(0, 0, 0, 12, 32, 2002), array(0, 0, 0, 13, 1, 2002), array(0, 0, 0, 0, 1, 2002),
    array(0, 0, 0, -1, 1, 2002), array(0, 0, 0, 2, 29, 2001), array(0, 0, 0, 2, 29, 2000), array(0, 0, 0, 2, 30, 2000),
    array(25, 0, 0, 1, 1, 2002), array(-1, 0, 0, 1, 1, 2002), array(0, 60, 0, 1, 1, 2002), array(0, 0, 3600, 1, 1, 2002),
    array(0, 0, -1, 1, 1, 2002), array(0, 0, 0, 1, 0, 2002), array(0, 0, 0, 1, -30, 2002), array(0, 0, 0, 1, 1, 70),
    array(0, 0, 0, 1, 1, 69), array(0, 0, 0, 1, 1, 0), array(0, 0, 0, 1, 1, 1), array(0, 0, 0, 1, 1, 99), array(0, 0, 0, 1, 1, 100),
    array(0, 0, 0, 1, 1, 1969), array(0, 0, 0, 12, 31, 1969), array(0, 0, 0, 1, 1, 1901), array(0, 0, 0, 1, 1, 2038),
    array(3, 14, 7, 1, 19, 2038), array(3, 14, 8, 1, 19, 2038), array(0, 0, 0, 1, 1, 1900), array(12, 30, 45, 6, 15, 1985),
    array(0, 0, 0, 24, 1, 2002), array(0, 0, 0, 1, 400, 2002), array(1000, 1000, 1000, 1, 1, 2002),
);
foreach ($cases as $c) {
    echo implode(",", $c), " => ", d(mktime($c[0], $c[1], $c[2], $c[3], $c[4], $c[5])), " | gm ", d(gmmktime($c[0], $c[1], $c[2], $c[3], $c[4], $c[5])), "\n";
}
echo d(mktime(0, 0, 0, 1, 1, "2002")), " ", d(mktime("12", "0", "0", "6", "1", "02")), "\n";
echo d(mktime(0, 0, 0, 1.9, 1.9, 2002.9)), "\n";
echo d(mktime(0, 0, 0, 1, 1, 2002, 0)), " ", d(mktime(0, 0, 0, 1, 1, 2002, 1)), "\n";
$dates = array(array(2, 29, 2000), array(2, 29, 1900), array(2, 29, 2004), array(2, 29, 2001), array(1, 31, 2002), array(4, 31, 2002), array(13, 1, 2002), array(0, 1, 2002), array(1, 0, 2002), array(12, 31, 32767), array(1, 1, 32768), array(1, 1, 0), array(1, 1, 1), array(-1, 1, 2002), array(6, 30, 2002), array(9, 31, 2002));
foreach ($dates as $x) echo implode("/", $x), "=", checkdate($x[0], $x[1], $x[2]) ? "Y" : "N", " ";
echo "\n";
var_dump(checkdate("2", "28", "2002"), checkdate("x", 1, 2002));
?>
