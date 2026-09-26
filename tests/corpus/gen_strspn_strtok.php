<?php
error_reporting(E_ALL);
$subjects = array("42 is the answer", "hello", "", "aaabbbccc", "  \t x", "123abc456");
$masks = array("1234567890", "abc", " \t", "", "helo", "a");
foreach ($subjects as $s) {
    foreach ($masks as $m) {
        echo strspn($s, $m), "/", strcspn($s, $m), " ";
    }
    echo "\n";
}
echo function_exists('strpbrk') ? "has strpbrk\n" : "no strpbrk\n";
// strtok sequences
$tok = strtok("This is\tan example\nstring", " \n\t");
while ($tok !== false) { echo "[$tok]"; $tok = strtok(" \n\t"); }
echo "\n";
$tok = strtok("a,,b,,,c,", ",");
while ($tok !== false) { echo "[$tok]"; $tok = strtok(","); }
echo "\n";
$tok = strtok("/path/to//file.txt", "/");
while ($tok !== false) { echo "[$tok]"; $tok = strtok("/."); }
echo "\n";
$tok = strtok("a0b0c", "0");
while ($tok !== false) { echo "[$tok]"; $tok = strtok("0"); }
echo "\n";
var_dump(strtok("", ","));
var_dump(strtok(",,,", ","));
$t = strtok("x y z", " "); echo $t; $t = strtok(","); echo "|$t"; $t = strtok(" "); var_dump($t);
// strrchr, strstr, stristr, strrpos, strpos
$hay = "The quick brown fox jumps over the lazy dog";
foreach (array("o", "the", "The", "T", "z", "q", "dog", "xyz", " ") as $n) {
    echo "$n: ";
    var_dump(strstr($hay, $n));
    echo "  ri:"; var_dump(stristr($hay, $n));
    echo "  rc:"; var_dump(strrchr($hay, $n));
    echo "  p:"; var_dump(strpos($hay, $n));
    echo "  rp:"; var_dump(strrpos($hay, $n));
}
var_dump(strpos("abc", "c", 1), strpos("abc", "a", 1), strpos("abc", "a", 5));
var_dump(strstr("abc", 98));
var_dump(strpos("a1b2", 50));
var_dump(strrchr("a/b/c", "/x"));
var_dump(@strpos("abc", ""));
var_dump(@strstr("abc", ""));
?>
