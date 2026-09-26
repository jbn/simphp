<?php
error_reporting(E_ALL);
$zones = array("UTC", "America/New_York", "Europe/Berlin", "Asia/Tokyo", "Australia/Sydney", "America/Los_Angeles", "EST5EDT", "Asia/Kolkata");
$stamps = array(0, 986079599, 986079600, 986083200, 1004248800, 1004252400, 1017536400, 1017540000, 1035680400, 1035684000, 1234567890, 1000000000, -1000000000, 2147483647);
foreach ($zones as $z) {
    putenv("TZ=$z");
    echo "== $z\n";
    foreach ($stamps as $ts) {
        // legacy EST5EDT differs between tzdata releases before 1967
        if ($z == "EST5EDT" && $ts < 0) continue;
        echo "  $ts: ", date("Y-m-d H:i:s T I O Z U", $ts), " | g:", gmdate("H:i T", $ts), "\n";
    }
    echo "  mktime 2002-03-31 02:30 = ", mktime(2, 30, 0, 3, 31, 2002), "\n";
    echo "  mktime 2002-10-27 02:30 = ", mktime(2, 30, 0, 10, 27, 2002), "\n";
    echo "  mktime 2002-04-07 02:30 = ", mktime(2, 30, 0, 4, 7, 2002), "\n";
    echo "  mktime 2002-07-01 12:00 = ", mktime(12, 0, 0, 7, 1, 2002), " dst=-1:", mktime(12, 0, 0, 7, 1, 2002, -1), " dst=0:", mktime(12, 0, 0, 7, 1, 2002, 0), " dst=1:", mktime(12, 0, 0, 7, 1, 2002, 1), "\n";
    echo "  gmmktime 2002-07-01 12:00 = ", gmmktime(12, 0, 0, 7, 1, 2002), "\n";
    $lt = localtime(1000000000, true);
    ksort($lt);
    echo "  localtime: "; foreach ($lt as $k => $v) echo "$k=$v "; echo "\n";
    echo "  localtime idx: ", implode(",", localtime(1000000000)), "\n";
    $gd = getdate(1000000000);
    echo "  getdate: "; foreach ($gd as $k => $v) echo "$k=$v "; echo "\n";
    echo "  strftime: ", strftime("%Y-%m-%d %H:%M:%S %Z", 1000000000), "\n";
}
putenv("TZ=UTC");
echo date("Y-m-d H:i:s T", 1000000000), "\n";
?>
