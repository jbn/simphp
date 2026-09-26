<?php
ini_set('precision', 17);
$pairs = array(array(88.24, 76.629), array(11.92, 39.864), array(51.61, 69.325), array(57.03, 25.65), array(12.71, 54.912), array(55.53, 36.297));
foreach ($pairs as $p) { $x = $p[0] * $p[1]; echo $p[0], "*", $p[1], " = ", $x, "\n"; }
var_dump(88.24 * 76.629 == 6761.74296, round(57.03 * 25.65, 3), floor(57.03 * 25.65 * 10000));
$a = 88.24; $a *= 76.629; echo $a, "\n";
ini_set('precision', 14); echo 88.24 * 76.629, "\n";
?>
