<?php
// Thousands of float operations whose last bit depends on x87 double rounding.
// (pow() is left out: its last bit also depends on the FPU's fyl2x/f2xm1 accuracy.)
ini_set('precision', 17);
mt_srand(1234);
$h = 0; $out = array();
for ($i = 0; $i < 4000; $i++) {
  $a = mt_rand(1, 999999) / 1000; $b = mt_rand(1, 99999) / 100; $c = mt_rand(-50, 50);
  $r = array($a * $b, $a / $b, $a + $b / 7, $a - $b * 3, ($a * $b) / 13, $a * $c + $b, $c / $b, $a * 1.1 * 1.1);
  foreach ($r as $v) { $s = (string) $v; $h = ($h * 31 + crc32($s)) & 0x7fffffff; }
  if ($i % 400 == 0) $out[] = implode(" ", $r);
}
echo implode("\n", $out), "\nhash=$h\n";
$sum = 0; for ($i = 1; $i <= 1000; $i++) $sum += 1 / $i; echo $sum, "\n";
$p = 1; for ($i = 1; $i <= 50; $i++) $p *= 1.07; echo $p, "\n";
echo round(1.955, 2), " ", round(2.675, 2), " ", round(1.005 * 1000) / 1000, " ", floor(0.7 * 100 + 0.1 * 100), " ", (int) (0.1 * 3 * 10), "\n";
echo deg2rad(33.3), " ", rad2deg(1.23), " ", 19.99 * 3, " ", 0.57 * 100, " ", intval(0.57 * 100), " ", 1 - 0.9, "\n";
