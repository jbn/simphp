<?php
error_reporting(E_ALL);
$inputs = array("", "a", "abc", "hello world", "12345");
$lens = array(-1, 0, 1, 3, 5, 10, 13);
$pads = array(" ", "-", "xy", "123");
$types = array(STR_PAD_RIGHT, STR_PAD_LEFT, STR_PAD_BOTH);
foreach ($inputs as $s) {
    foreach ($lens as $l) {
        foreach ($types as $t) {
            echo "[", str_pad($s, $l, "*", $t), "]";
        }
        echo "\n";
    }
}
foreach ($pads as $p) {
    echo "[", str_pad("ab", 9, $p, STR_PAD_BOTH), "][", str_pad("ab", 8, $p, STR_PAD_LEFT), "][", str_pad("ab", 7, $p), "]\n";
}
echo "[", str_pad(5, 4, 0, STR_PAD_LEFT), "]\n";
echo "[", str_pad(3.5, 8, "0", STR_PAD_LEFT), "]\n";
echo "[", str_pad(true, 3, "_"), "]\n";
echo "[", str_pad(null, 3, "_"), "]\n";
echo "[", @str_pad("x", 5, ""), "]\n";
echo "[", str_pad("x", 5, "", STR_PAD_LEFT), "]\n";
echo "[", str_pad("x", 5, "ab", 7), "]\n";
echo "[", str_pad("x"), "]\n";
echo "[", str_pad("abc", "6"), "]\n";
echo "[", str_pad("abc", "6abc", ".", "1"), "]\n";
// str_repeat
foreach (array(0, 1, 2, 5) as $n) {
    echo "[", str_repeat("ab", $n), "]";
}
echo "\n";
echo "[", str_repeat("", 100), "]\n";
echo "[", str_repeat("x", -1), "]\n";
echo "[", str_repeat(12, 3), "]\n";
echo "[", str_repeat("=-", 20), "]\n";
echo strlen(str_repeat("abcd", 1000)), "\n";
echo "[", str_repeat("x"), "]\n";
echo "[", str_repeat(), "]\n";
echo "done\n";
?>
