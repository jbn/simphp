<?php
error_reporting(E_ALL);
printf("%1\$s %2\$s %1\$s\n", "a", "b");
printf("%2\$05d-%1\$'x8s\n", "hi", 42);
echo sprintf("%%"), "|", sprintf("100%%"), "|", sprintf("%5%"), "\n";
echo sprintf("%s %s", "only one"), "|\n";
echo sprintf("%d"), "|\n";
echo sprintf("no args"), "\n";
echo sprintf("%s", array(1,2)), "\n";
echo sprintf("%d %d %d", "12", "-7", "0x1A"), "\n";
echo sprintf("%.10f", 1/3), "\n";
echo sprintf("%.15f", 0.1), "\n";
echo sprintf("%.20f", 0.1), "\n";
echo sprintf("%.60f", 1.0), "\n";
echo sprintf("%f", 1e15), "|", sprintf("%f", 1e20), "|", sprintf("%f", -1e-10), "\n";
echo sprintf("%e", 0), "|", sprintf("%e", 123456789), "|", sprintf("%.10e", 1/7), "\n";
echo sprintf("%x %X %o %b", -1, -255, -8, -2), "\n";
echo sprintf("%u", -1), "|", sprintf("%u", -2147483648), "|", sprintf("%u", 3000000000), "\n";
echo sprintf("%d", 3000000000), "|", sprintf("%d", -3000000000), "|", sprintf("%d", 1e30), "\n";
echo sprintf("%c%c%c", 72, 105, 33), "|", bin2hex(sprintf("%c", 256 + 65)), "|", bin2hex(sprintf("%c", -1)), "\n";
echo sprintf("[%'#10.3f]", 3.14159), sprintf("[%-'#10.3f]", 3.14159), "\n";
echo sprintf("[%+05d]", 42), sprintf("[%+05d]", -42), sprintf("[%+.2f]", 0), "\n";
echo sprintf("[%5.2f]", 123456.789), sprintf("[%3s]", "abcdef"), "\n";
echo sprintf("[%-08d]", 42), sprintf("[%08.3f]", -1.5), "\n";
echo sprintf("%g", 0.00001234), "|", sprintf("%G", 1e20), "|", sprintf("%g", 100), "\n";
echo sprintf("%s", 1.0), "|", sprintf("%s", 0.1 + 0.2), "|", sprintf("%s", 1e100), "|", sprintf("%s", -0.0), "\n";
echo sprintf("%d", "  12"), "|", sprintf("%d", "1e3"), "|", sprintf("%f", "1e3"), "\n";
echo sprintf("%5.5s|%-5.5s|", "ab", "abcdefgh"), "\n";
echo sprintf("%'.10d|%'.-10d", 7, 7), "\n";
echo sprintf("%z %y"), "|\n";
echo vsprintf("%s-%s-%04d", array("a", "b", 7)), "\n";
echo vsprintf("%2\$s %1\$s", array("world", "hello")), "\n";
echo vsprintf("%d items", array()), "|\n";
vprintf("%s=%d\n", array("x", 99));
$n = printf("abc\n"); echo $n, "\n";
$n = printf("%s\n", "hello"); echo $n, "\n";
// number_format
$nums = array(0, 1, -1, 0.5, 1.5, 2.5, -2.5, 1234.5678, -1234.5678, 1234567.891, 0.005, 0.015, 0.125, 999.999, 1e15, 123456789012);
foreach ($nums as $n) {
    echo $n, ": ", number_format($n), " | ", number_format($n, 2), " | ", number_format($n, 3, ',', '.'), " | ", number_format($n, 1, '.', ' '), " | ", number_format($n, 0, '', ''), "\n";
}
echo number_format("1234.5"), "|", number_format("abc"), "|", number_format(-0.4), "|", number_format(1234.5, -2), "\n";
echo number_format(1234.5678, 2, '', ''), "|", number_format(1234.5678, 2, 'ab', 'cd'), "\n";
?>
