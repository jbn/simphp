<?php
error_reporting(E_ALL);
putenv("TZ=UTC");
if (!function_exists('gregoriantojd')) { echo "no calendar\n"; exit; }
$gdates = array(array(1, 1, 1970), array(10, 15, 1582), array(10, 4, 1582), array(2, 29, 2000), array(3, 1, 1900), array(12, 31, 9999), array(1, 1, -4713), array(11, 24, -4714), array(1, 1, 1), array(7, 4, 1776), array(0, 0, 0), array(2, 30, 2002), array(1, 1, 2038));
foreach ($gdates as $g) {
    $jd = gregoriantojd($g[0], $g[1], $g[2]);
    echo implode("/", $g), " jd=$jd greg=", jdtogregorian($jd), " jul=", jdtojulian($jd), " dow=", jddayofweek($jd, 0), ",", jddayofweek($jd, 1), ",", jddayofweek($jd, 2);
    echo " mn=", jdmonthname($jd, 0), ",", jdmonthname($jd, 1), ",", jdmonthname($jd, 2), ",", jdmonthname($jd, 3), ",", jdmonthname($jd, 4), ",", jdmonthname($jd, 5);
    echo " jew=", jdtojewish($jd), " fr=", jdtofrench($jd), "\n";
}
foreach (array(array(1, 1, 1970), array(10, 5, 1582), array(2, 29, 1900), array(1, 1, 1)) as $j) echo "juliantojd ", implode("/", $j), "=", juliantojd($j[0], $j[1], $j[2]), "\n";
foreach (array(array(1, 1, 5760), array(7, 1, 5762), array(13, 29, 5762), array(6, 1, 5763), array(1, 1, 1)) as $j) echo "jewishtojd ", implode("/", $j), "=", jewishtojd($j[0], $j[1], $j[2]), "\n";
foreach (array(array(1, 1, 1), array(13, 5, 14), array(1, 1, 15), array(12, 30, 7)) as $j) echo "frenchtojd ", implode("/", $j), "=", frenchtojd($j[0], $j[1], $j[2]), "\n";
for ($y = 1970; $y <= 2037; $y++) {
    echo $y, ":", date("m-d", easter_date($y)), "/", easter_days($y), " ";
    if ($y % 8 == 1) echo "\n";
}
echo "\n";
foreach (array(1492, 1582, 1583, 1700, 1900, 2100, 2500) as $y) echo "ed($y)=", easter_days($y), " ";
echo "\n";
echo @easter_date(1969), "|", @easter_date(2038), "\n";
if (defined('CAL_EASTER_ROMAN')) echo easter_days(1582, CAL_EASTER_ROMAN), easter_days(1582, CAL_EASTER_ALWAYS_GREGORIAN), easter_days(1582, CAL_EASTER_ALWAYS_JULIAN), "\n";
foreach (array(0, 86400, 1000000000, 2147483647) as $ts) {
    $jd = unixtojd($ts); echo "unixtojd($ts)=$jd back=", jdtounix($jd), "\n";
}
echo jdtounix(2440587), " ", jdtounix(2400000), "\n";
if (function_exists('cal_days_in_month')) {
    foreach (array(1, 2, 4, 12) as $m) echo cal_days_in_month(CAL_GREGORIAN, $m, 2000), cal_days_in_month(CAL_GREGORIAN, $m, 1900), cal_days_in_month(CAL_JULIAN, $m, 1900), " ";
    echo "\n";
    print_r(cal_from_jd(2452345, CAL_GREGORIAN));
    echo cal_to_jd(CAL_GREGORIAN, 3, 12, 2002), " ", cal_to_jd(CAL_JEWISH, 1, 1, 5762), "\n";
    print_r(cal_info(0));
}
for ($i = -2; $i <= 8; $i++) echo jddayofweek($i, 1), " ";
echo "\n";
echo jdtogregorian(0), " ", jdtogregorian(-1), " ", jdtojulian(1), " ", jdtojewish(347997), " ", jdtojewish(347998), " ", jdtofrench(2375839), " ", jdtofrench(2380952), "\n";
?>
