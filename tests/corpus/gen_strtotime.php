<?php
error_reporting(E_ALL);
putenv("TZ=UTC");
$base = 1015939800; // 2002-03-12 13:30:00 UTC (Tuesday)
echo date("Y-m-d H:i:s D", $base), "\n";
$strs = array(
    "now", "today", "tomorrow", "yesterday", "midnight", "noon",
    "+1 day", "-1 day", "+1 week", "-2 weeks", "+1 month", "-1 month", "+1 year", "+3 hours", "-90 minutes", "+30 seconds",
    "+1 week 2 days 4 hours 2 seconds", "next monday", "last friday", "next week", "last year", "this sunday", "monday", "sunday",
    "2002-01-01", "2002-01-01 12:34:56", "2002/01/15", "1/15/2002", "15 January 2002", "January 15, 2002", "Jan 15 2002", "15-Jan-2002",
    "2002-02-30", "2002-13-01", "10:00", "10:00pm", "10pm", "10:30:45", "23:59:59", "12am", "12pm",
    "@1000000000", "1 month ago", "3 days ago", "tomorrow noon", "first day", "last day", "next month", "third friday",
    "20020312", "20020312T101010", "2002-03-12T10:10:10Z", "Tue, 12 Mar 2002 10:10:10 GMT", "Tue, 12 Mar 2002 10:10:10 +0200",
    "12 Mar 2002 10:10:10 EST", "12 Mar 2002 10:10:10 PDT", "garbage", "", "  ", "+1", "1 fortnight", "next year", "+1 days",
    "2038-01-19 03:14:07", "2038-01-19 03:14:08", "1969-12-31 23:59:59", "1901-12-13 20:45:52", "0000-00-00", "02-03-12", "3/12",
    "March", "Mar 12", "12 March", "tuesday", "next tuesday", "last tuesday", "+0 day", "-0 days", "yesterday 14:00", "10 September 2000 +1 day",
);
foreach ($strs as $s) {
    $t = strtotime($s, $base);
    echo str_pad("[$s]", 40), " => ", $t, $t == -1 ? "" : " " . date("Y-m-d H:i:s D", $t), "\n";
}
?>
