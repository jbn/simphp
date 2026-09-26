<?php
error_reporting(E_ALL);
$s = "abcdefghij";
$starts = array(0, 1, 5, 9, 10, 11, 100, -1, -3, -10, -11, -100);
$lens = array(null, 0, 1, 3, -1, -3, -10, 100);
foreach ($starts as $st) {
    echo str_pad($st, 4), ":";
    foreach ($lens as $l) {
        $r = ($l === null) ? substr($s, $st) : substr($s, $st, $l);
        echo " ["; echo $r === false ? "F" : $r; echo "]";
    }
    echo "\n";
}
var_dump(substr("", 0), substr("", 0, 1), substr("a", 1), substr(12345, 1, 2), substr("abc", "1"), substr("abc", 1.9));
$t = "  \t\n\r\0\x0B xx hello xx \x0B\0\r\n\t  ";
echo "[", bin2hex(trim($t)), "]\n[", bin2hex(ltrim($t)), "]\n[", bin2hex(rtrim($t)), "]\n[", bin2hex(chop($t)), "]\n";
echo "[", trim("xxhelloxx", "x"), "][", trim("abchelloabc", "a..c"), "][", trim("123abc456", "0..9"), "]\n";
echo "[", trim("hello", "a..z"), "][", ltrim("0012300", "0"), "][", rtrim("0012300", "0"), "]\n";
echo "[", trim("[text]", "[]"), "][", trim("..dots..", "."), "][", @trim("abc", "z..a"), "]\n";
echo "[", trim("a..b", ".."), "][", trim("  x  ", ""), "][", trim(""), "][", trim(" 5 "), "]\n";
echo "[", rtrim("hello\n"), "][", ltrim("\t\ttabs"), "][", trim("xyz", "xyz"), "]\n";
echo "[", trim("abc.", "a."), "][", trim("A-Z", "A-Z"), "][", trim("mmmxmmm", "m..m"), "]\n";
echo "[", @trim("abc", "a.."), "][", @trim("abc", "..c"), "][", @trim("abc", "a...c"), "]\n";
echo "[", trim(123.0), "][", trim(null), "][", trim(true), "]\n";
// string offsets
$str = "hello";
echo $str[0], $str{1}, $str[4], "|", $str[strlen($str)-1], "\n";
$str[0] = 'J'; echo $str, "\n";
$str{5} = '!'; echo $str, "\n";
$str[8] = '?'; echo "[", str_replace(" ", "_", $str), "]\n";
$str2 = "abc"; $str2[1] = "XYZ"; echo $str2, "\n";
$str3 = "abc"; $str3[-1] = "Z"; echo $str3, "\n";
$e = ""; $e[0] = "a"; var_dump($e);
echo strlen("\0\0\0"), strlen(""), strlen(null), strlen(12.5), strlen(false), strlen(true), "\n";
echo str_replace("a", "b", "banana"), "|", str_replace(array("a", "n"), array("1"), "banana"), "|", str_replace(array("a", "b"), "x", "abcab"), "\n";
echo str_replace("", "x", "abc"), "|", str_replace("aa", "a", "aaaaaa"), "|", str_replace(array("a","b"), array("b","c"), "ab"), "\n";
print_r(str_replace("o", "0", array("foo", "bar", "boo")));
echo str_replace(1, 2, 111), "\n";
?>
