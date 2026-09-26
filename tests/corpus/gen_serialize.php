<?php
error_reporting(E_ALL);
$vals = array(null, true, false, 0, 1, -1, 2147483647, -2147483647 - 1, 2147483648, 0.0, -0.0, 1.5, 0.1, 1/3, -1e100, 1e-300, 123456789.123, "", "a", "hello \"world\"", "multi\nline", "\0null\0", "\xe9\xff", "semi;colon:quote\"", array(), array(1, 2, 3), array("a" => 1, "b" => array("c" => null)), array(5 => "x", -3 => "y", "10" => "z", "1.5" => "w"), array(array(array())));
foreach ($vals as $v) {
    $s = serialize($v);
    echo str_replace("\0", "\\0", $s), "\n";
    $u = unserialize($s);
    if ($u !== $v && !(is_float($v) && is_float($u) && (string)$u === (string)$v)) { echo "  MISMATCH: "; var_dump($u); }
}
$a = array(1, 2);
$a[] = &$a[0];
echo serialize($a), "\n";
$x = "shared"; $arr = array(&$x, &$x, $x);
$s = serialize($arr); echo $s, "\n";
$u = unserialize($s); $u[0] = "changed"; echo implode(",", $u), "\n";
$bad = array("", "x", "i:", "i:5", "i:5;", "s:3:\"ab\";", "s:2:\"abc\";", "a:1:{i:0;i:1;", "a:1:{i:0;i:1;}", "b:2;", "b:1;", "d:1.5e3;", "d:INF;", "d:NAN;", "d:-INF;", "N;", "N", "a:-1:{}", "O:3:\"foo\":0:{}", "i:99999999999;", "s:-1:\"\";", "a:2:{i:0;i:1;i:0;i:2;}", "i:1;junk", "R:1;", "r:1;", " i:1;", "I:1;", "a:1:{d:1.5;i:1;}", "a:1:{b:1;i:1;}", "a:1:{N;i:1;}");
foreach ($bad as $b) {
    echo "[$b] => ";
    $r = @unserialize($b);
    ob_start(); var_dump($r); $o = ob_get_contents(); ob_end_clean();
    echo str_replace("\n", " ", $o), "\n";
}
echo serialize(1.0), serialize(100.0), serialize(1e20), serialize(1e21), serialize(-0.5), serialize(3.0e-5), "\n";
echo @serialize(), "|\n";
echo unserialize(serialize("\x00\x01\x02")) === "\x00\x01\x02" ? "binary ok\n" : "binary bad\n";
?>
