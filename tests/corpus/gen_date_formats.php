<?php
error_reporting(E_ALL);
putenv("TZ=UTC");
$stamps = array(0, 1, -1, 86399, 951782400, 951868800, 1000000000, 1009843199, 1014768000, 1234567890, 2147483647, -86400, -2147483647, 68256000, 915148800, 1104537600, 1072915200, 1230768000, 1293753600);
$chars = str_split_compat("aABdDFgGhHiIjlLmMnOrsStTUwYyzZ");
function str_split_compat($s) { $o = array(); for ($i = 0; $i < strlen($s); $i++) $o[] = $s[$i]; return $o; }
foreach ($stamps as $ts) {
    echo $ts, ":";
    foreach ($chars as $c) echo " $c=", date($c, $ts);
    echo "\n";
}
foreach (array('t', 'W', 'S', 'L', 'I', 'O', 'r', 'B', 'u', 'N', 'c', 'e', 'P', 'o') as $c) {
    echo "$c: ";
    foreach (array(0, 951782400, 1009843199, 1234567890) as $ts) echo "[", date($c, $ts), "]";
    echo "\n";
}
echo date("D, d M Y H:i:s", 1000000000), "\n";
echo date("l jS \of F Y h:i:s A", 1000000000), "\n";
echo date("\\T\\o\\d\\a\\y \\i\\s l", 1000000000), "\n";
echo date('\\\\Y \Y Y', 1000000000), "\n";
echo date("", 1000000000), "|", date("xyz%!", 1000000000), "\n";
for ($d = 1; $d <= 31; $d++) echo date("jS ", mktime(0, 0, 0, 1, $d, 2002));
echo "\n";
for ($m = 1; $m <= 12; $m++) echo date("M F n t L|", mktime(0, 0, 0, $m, 1, 2000));
echo "\n";
foreach (array(1970, 1999, 2000, 2001, 2004, 2037, 1900, 2100, 1901) as $y) {
    echo $y, " dec31: ", date("z W t L D", gmmktime(0, 0, 0, 12, 31, $y)), " | jan1: ", date("z W D", gmmktime(0, 0, 0, 1, 1, $y)), "\n";
}
for ($i = 0; $i < 14; $i++) echo date("D W|", 1009843200 + $i * 86400);
echo "\n";
echo gmdate("Y-m-d H:i:s", 1234567890), " ", gmdate("U", 5), " ", gmdate("Z T I", 0), "\n";
echo date("Y-m-d", 0x7FFFFFFF), " ", date("Y-m-d", -0x7FFFFFFF), "\n";
echo date("B", 0), date("B", 3600), date("B", 43200), date("B", 86399), "\n";
?>
