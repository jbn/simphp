<?php
$inf = 1e308 * 10;
$tests = array(
  'sqrt(-1)' => sqrt(-1), 'log(-1)' => log(-1), 'log10(-1)' => log10(-1), 'acos(2)' => acos(2), 'asin(2)' => asin(2),
  'pow(-8,1/3)' => @pow(-8, 1/3), 'sin(inf)' => sin($inf), 'cos(inf)' => cos($inf), 'tan(inf)' => tan($inf),
  'inf-inf' => $inf - $inf, 'inf*0' => $inf * 0, 'inf/inf' => $inf / $inf, '-(inf-inf)' => -($inf - $inf),
  'exp(nan)' => exp(sqrt(-1)), 'atan2(nan,1)' => atan2(sqrt(-1), 1), 'abs(nan)' => abs(sqrt(-1)), 'round(nan)' => round(sqrt(-1)),
  'floor(nan)' => floor(sqrt(-1)), 'nan+1' => sqrt(-1) + 1, 'log(0)' => log(0), 'exp(1000)' => exp(1000), '-log(0)' => -log(0),
  'fmod?' => 0, 'deg2rad(nan)' => deg2rad(log(-1)), 'acos(-2)' => acos(-2), 'sqrt(-0.0)' => sqrt(-0.0), 'log(-0.0)' => log(-0.0),
);
foreach ($tests as $k => $v) {
  echo str_pad($k, 14), " echo=", $v, " var_dump=";
  var_dump($v);
}
printf("printf: %f %s %d %e\n", sqrt(-1), sqrt(-1), sqrt(-1), log(-1));
echo number_format(sqrt(-1)), " ", serialize(sqrt(-1)), " ", var_export(sqrt(-1), true), " ", (int) sqrt(-1), " ", intval($inf), " ", round($inf), " ", strval(-$inf), "\n";
var_dump(sqrt(-1) == sqrt(-1), sqrt(-1) < 1, sqrt(-1) > 1, $inf == $inf, -$inf < 0); ?>
