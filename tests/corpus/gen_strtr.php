<?php
error_reporting(E_ALL);
echo strtr("Hello World", "lo", "01"), "\n";
echo strtr("Hello World", "lo", "0"), "\n";
echo strtr("Hello World", "l", "0123"), "\n";
echo strtr("abcabc", "abc", "cab"), "\n";
echo strtr("", "a", "b"), "|\n";
echo strtr("abc", "", "x"), "\n";
echo strtr("hi all", array("hi" => "hello", "hello" => "bye", "a" => "A")), "\n";
echo strtr("hi all", array("h" => "-", "hi" => "+")), "\n";
echo strtr("aaaa", array("a" => "b", "aa" => "c")), "\n";
echo strtr("abc", array()), "\n";
echo strtr("123", array(1 => "one", 2 => "two")), "\n";
echo strtr("\xe9t\xe9", "\xe9", "e"), "\n";
echo strtr("abc", "abc"), "\n";
// substr_replace
$s = "Hello, World";
$tests = array(
    array("X", 0), array("X", 5), array("X", -3), array("X", 50), array("X", -50),
    array("XY", 0, 0), array("XY", 2, 3), array("XY", 2, -3), array("XY", -5, 2),
    array("XY", -5, -8), array("", 3, 4), array("LONGER", 0, 1), array("Z", 12, 5),
);
foreach ($tests as $t) {
    if (count($t) == 2) $r = substr_replace($s, $t[0], $t[1]);
    else $r = substr_replace($s, $t[0], $t[1], $t[2]);
    echo implode(",", $t), " => [", $r, "]\n";
}
echo "[", substr_replace("", "abc", 0), "]\n";
echo "[", substr_replace("abc", "", 1, 1), "]\n";
echo "[", substr_replace(12345, 9, 2, 1), "]\n";
// substr_count
echo substr_count("hello hello hello", "hello"), "\n";
echo substr_count("aaaa", "aa"), "\n";
echo substr_count("abc", "d"), "\n";
echo substr_count("", "a"), "\n";
echo @substr_count("abc", ""), "|\n";
echo substr_count("a,b,,c,,,d", ","), "\n";
echo substr_count("a,b,,c,,,d", ",,"), "\n";
echo substr_count(1111, 1), "\n";
// strrev
foreach (array("", "a", "ab", "hello", "12321", "\x00\x01\x02", 123) as $v) {
    echo "[", bin2hex(strrev($v)), "]";
}
echo "\n";
// ucfirst / ucwords
foreach (array("hello world", "HELLO world", " leading", "a-b c_d e.f", "x\ty\nz", "", "1st place", "o'neil mc-donald", "\xe9cole", "hello    world") as $v) {
    echo "[", ucfirst($v), "][", ucwords($v), "][", strtolower($v), "][", strtoupper($v), "]\n";
}
echo function_exists('lcfirst') ? "has lcfirst\n" : "no lcfirst\n";
echo bin2hex(strtoupper("\xe9\xe0\xfc abc")), "\n";
echo bin2hex(strtolower("\xc9\xc0\xdc ABC")), "\n";
?>
