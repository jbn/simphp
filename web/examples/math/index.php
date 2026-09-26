<?php
header("Content-Type: text/plain");

echo "PHP_INT_MAX doesn't exist yet in 4.1.1; integers are 32-bit:\n";
$big = 2147483647;
var_dump($big, $big + 1, -$big - 2, 0x7FFFFFFF * 2);
var_dump((int) "2147483648", intval(3000000000.0), 7 / 2, 6 / 2, 7 % 3, -7 % 3);

echo "\nFloat printing uses precision=", ini_get('precision'), ":\n";
var_dump(0.1 + 0.2, 1/3, 1e15, 1e16, pi(), sqrt(2));
echo 0.1 + 0.7, " ", (0.1 + 0.7) * 10, " ", (int) ((0.1 + 0.7) * 10), "\n";

echo "\nArbitrary precision with bcmath:\n";
bcscale(30);
echo "2^100      = ", bcpow("2", "100", 0), "\n";
echo "1/7        = ", bcdiv("1", "7"), "\n";
echo "sqrt(2)    = ", bcsqrt("2"), "\n";

echo "\nBase conversion:\n";
echo "decbin(255)=", decbin(255), " dechex(48879)=", dechex(48879), " base_convert('zz',36,2)=", base_convert('zz', 36, 2), "\n";

echo "\nRandom numbers (seeded):\n";
mt_srand(42); echo "mt_rand: ", mt_rand(), " ", mt_rand(1, 6), "\n";
srand(42);    echo "rand:    ", rand(), " ", rand(1, 6), "\n";
echo "getrandmax: ", getrandmax(), "  mt_getrandmax: ", mt_getrandmax(), "\n";

echo "\nCalendar extension:\n";
echo "Easter 2002:    ", date("M d, Y", easter_date(2002)), "\n";
echo "Julian day:     ", gregoriantojd(12, 26, 2001), "\n";
echo "Jewish date:    ", jdtojewish(gregoriantojd(12, 26, 2001)), "\n";
echo "Day of week:    ", jddayofweek(gregoriantojd(12, 26, 2001), 1), "\n";
echo "Days in Feb 2000: ", cal_days_in_month(CAL_GREGORIAN, 2, 2000), "\n";

echo "\nDates at the edges of a 32-bit time_t:\n";
echo date("Y-m-d H:i:s", 2147483647), "\n";
var_dump(mktime(0, 0, 0, 1, 1, 2040));
var_dump(strtotime("1 January 2038"), strtotime("next monday"));
?>
