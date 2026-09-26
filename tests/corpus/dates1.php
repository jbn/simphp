<?php
$t = 1009411200; // 2001-12-27 00:00:00 UTC
echo date("Y-m-d H:i:s", $t), "|", date("D, d M Y H:i:s T", $t), "|", date("l jS \of F Y h:i:s A", $t), "\n";
echo date("a A B g G h H i I j L m M n O r s S t T U w W y Y z Z", $t), "\n";
foreach (array(1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31) as $d) echo date("jS ", mktime(0, 0, 0, 1, $d, 2001));
echo "\n";
echo gmdate("Y-m-d H:i:s", 0), "|", gmdate("D, d M Y H:i:s", 2147483647), "|", date("Y-m-d", -86400), "\n";
echo mktime(0, 0, 0, 1, 1, 2000), " ", mktime(12, 30, 0, 6, 15, 2001), " ", mktime(0, 0, 0, 13, 1, 2001), " ", mktime(0, 0, 0, 2, 30, 2001), " ", mktime(0, 0, 0, 1, 1, 70), " ", mktime(0, 0, 0, 1, 1, 69), " ", mktime(0, 0, 0, 1, 1, 1969), " ", mktime(0, 0, 0, 1, 1, 2038), " ", mktime(0, 0, 0, 1, 1, 2039), "\n";
echo gmmktime(0, 0, 0, 1, 1, 2000), " ", gmmktime(1, 2, 3, 4, 5, 2006), "\n";
var_dump(checkdate(2, 29, 2000), checkdate(2, 29, 1900), checkdate(13, 1, 2000), checkdate(4, 31, 2001));
$strs = array("2001-12-27", "27 December 2001", "Dec 27 2001 10:00", "2001-12-27 10:30:45", "12/27/2001", "20011227", "10 September 2000", "+1 day", "now", "tomorrow", "1 week ago", "next Thursday", "last monday", "garbage", "", "2001-12-27T10:00:00Z", "Thu, 27 Dec 2001 10:00:00 GMT", "27-Dec-2001", "@1000");
foreach ($strs as $s) { $r = strtotime($s, $t); echo str_pad("'$s'", 36), " => ", var_export($r, true), $r > 0 ? " " . gmdate("Y-m-d H:i:s", $r) : "", "\n"; }
print_r(getdate($t)); print_r(localtime($t, true)); print_r(gmdate("U", $t));
echo "\n", strftime("%A %a %B %b %d %e %H %I %j %m %M %p %S %U %W %w %y %Y %Z %%", $t), "\n";
echo strftime("%c | %x | %X | %D | %T | %R | %h | %n|%t|", $t), "\n";
echo gmstrftime("%Y-%m-%d %H:%M:%S", $t), "\n";
putenv("TZ=America/New_York");
echo date("Y-m-d H:i:s T Z I O", $t), "|", date("Y-m-d H:i:s T I", 1000000000), "|", mktime(0, 0, 0, 7, 4, 2001), "|", mktime(2, 30, 0, 4, 1, 2001), "|", mktime(1, 30, 0, 10, 28, 2001), "\n";
echo gmmktime(0, 0, 0, 7, 4, 2001), " ", gmmktime(0, 0, 0, 1, 4, 2001), " ", strtotime("2001-07-04 12:00"), " ", strtotime("2001-07-04 12:00 GMT"), " ", strtotime("2001-07-04 12:00 PST"), "\n";
putenv("TZ=Europe/London"); echo date("Y-m-d H:i:s T", 1000000000), " ", date("T", $t), "\n";
putenv("TZ=Asia/Tokyo"); echo date("Y-m-d H:i:s T", $t), "\n";
putenv("TZ=EST5EDT"); echo date("Y-m-d H:i:s T", 1000000000), "\n";
putenv("TZ=CET-1CEST,M3.5.0,M10.5.0/3"); echo date("Y-m-d H:i:s T", 1000000000), " ", date("T", $t), "\n";
putenv("TZ=UTC"); echo date("Y-m-d H:i:s T", $t), "\n";
putenv("TZ=GMT"); echo date("T", $t), " ", strftime("%Z", $t), "\n";
putenv("TZ="); echo date("T", $t), "\n";
