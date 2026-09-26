<?php
error_reporting(E_ALL);
putenv("TZ=UTC");
$specs = str_split2("aAbBcCdDeghHIjmMnprRStTuUVwWxXyYZ%");
function str_split2($s) { $o = array(); for ($i = 0; $i < strlen($s); $i++) $o[] = $s[$i]; return $o; }
$stamps = array(0, 951782400, 1000000000, 1009843199, 1009843200, 1041379200, 1234567890, 1104451200, 1293753600, -86400);
foreach ($stamps as $ts) {
    echo $ts, ":";
    foreach ($specs as $c) {
        $r = strftime("%$c", $ts);
        echo " %$c=[", str_replace(array("\n", "\t"), array("\\n", "\\t"), $r), "]";
    }
    echo "\n";
    echo "  gm: ", gmstrftime("%Y-%m-%d %H:%M:%S %j %U %W %V %G %u %w", $ts), "\n";
}
echo strftime("", 0), "|", strftime("plain text", 0), "|", strftime("%", 0), "|", strftime("%Q %5d %-d %Ey %Od", 0), "|\n";
echo strftime("%A %B", 1000000000), "\n";
echo setlocale(LC_TIME, "C"), "\n";
echo strftime("%c | %x | %X", 1000000000), "\n";
echo var_dump(setlocale(LC_ALL, "xx_NOPE")), "\n";
echo strftime(str_repeat("%Y", 50), 0), "\n";
putenv("TZ=Europe/Berlin");
echo strftime("%Y-%m-%d %H:%M:%S %Z", 1000000000), " ", gmstrftime("%H:%M %Z", 1000000000), "\n";
putenv("TZ=Asia/Tokyo");
echo strftime("%Y-%m-%d %H:%M:%S %Z", 1000000000), " ", strftime("%z", 1000000000), "\n";
?>
