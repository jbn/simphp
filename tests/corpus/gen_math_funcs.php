<?php
error_reporting(E_ALL);
$bases = array(0, 1, 2, -2, 0.5, -0.5, 10, 2.5, "3");
$exps = array(0, 1, 2, -1, -2, 0.5, 3, 31, 32, 64, -0.5);
foreach ($bases as $b) {
    echo "$b:";
    foreach ($exps as $e) { $r = @pow($b, $e); echo " ", gettype($r), ":", $r; }
    echo "\n";
}
echo pow(2, 30), " ", pow(2, 31), " ", pow(-2, 31), " ", pow(-2, 63), " ", pow(10, 15), " ", pow(10, -15), " ", pow(0, 0), " ", pow(1.0, 0), "\n";
$xs = array(0, 0.5, 1, 2, 3.14159265358979, 10, 100, 1e-5, 1e10, -1, -0.5);
foreach ($xs as $x) {
    printf("%s: sqrt=%.10g exp=%.10g log=%.10g log10=%.10g sin=%.10f cos=%.10f tan=%.10f atan=%.10f\n", $x, @sqrt($x), exp($x), @log($x), @log10($x), sin($x), cos($x), tan($x), atan($x));
    if ($x >= -1 && $x <= 1) printf("   asin=%.10f acos=%.10f\n", asin($x), acos($x));
}
printf("%.12f %.12f %.12f %.12f\n", M_PI, M_E, pi(), atan2(1, 1));
printf("%.12f %.12f %.12f %.12f\n", atan2(-1, -1), atan2(0, -1), atan2(1, 0), atan2(0, 0));
foreach (array('sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'log1p', 'expm1', 'hypot', 'deg2rad', 'rad2deg') as $f) {
    if (!function_exists($f)) { echo "no $f\n"; continue; }
    if ($f == 'hypot') printf("hypot=%.10f %.10f\n", hypot(3, 4), hypot(5, 12));
    else printf("%s(0.5)=%.10f %s(2)=%.10f\n", $f, @$f(0.5), $f, @$f(2));
}
foreach (array('M_LOG2E', 'M_LOG10E', 'M_LN2', 'M_LN10', 'M_PI_2', 'M_PI_4', 'M_1_PI', 'M_2_PI', 'M_2_SQRTPI', 'M_SQRT2', 'M_SQRT1_2', 'M_SQRTPI', 'M_EULER', 'M_LNPI', 'M_SQRT3') as $c) {
    echo $c, "=", defined($c) ? sprintf("%.15f", constant($c)) : "undef", "\n";
}
echo sqrt(-1), " ", log(0), " ", -log(0), " ", log(-1), " ", exp(1000), " ", -exp(1000), " ", acos(2), "\n";
var_dump(sqrt(-1) == sqrt(-1), exp(1000) == exp(1000), exp(1000) > 1e308);
// max / min
var_dump(max(1, 2, 3), max(array(1, 5, 3)), max("apple", "banana"), max("10", "9"), max("10", "9a"), max(1, "1"), max("1", 1));
var_dump(min(1, -2.5, "0"), min(array()), min(array(0 => "a"), array(0 => "b")), max(array(1, 2), 99), min(array(1, 2), 99));
var_dump(max(null, false), min(null, false), max(true, 2), min("abc", 0), max("abc", 0), max(-0.0, 0));
var_dump(@max(5), max(array("a" => 3, "b" => 7)));
?>
