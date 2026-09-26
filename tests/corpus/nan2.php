<?php
$nan = sqrt(-1); $inf = 1e308 * 10;
foreach (array('%f', '%.1f', '%.3f', '%.10f', '%.20f', '%.30f', '%e', '%.2e', '%10f', '%-10f|', '%010f', '%F', '%g', '%s', '%d', '%5.1f') as $fmt) {
  echo $fmt, ": [", sprintf($fmt, $nan), "] [", sprintf($fmt, $inf), "] [", sprintf($fmt, -$inf), "]\n";
}
echo number_format($nan), "|", number_format($inf), "|", number_format(-$inf, 2), "\n";
