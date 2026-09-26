<?php
error_reporting(E_ALL);
$vals = array(0, 1, -1, 42, -42, 3.14159, -2.5, 255, 2147483647, -2147483647, "123abc", "abc", "", true, false, null, 1e10, 0.000123);
$fmts = array("%d", "%5d", "%-5d|", "%05d", "%+d", "%u", "%x", "%X", "%o", "%b", "%c", "%e", "%.2e", "%f", "%.0f", "%.3f", "%10.4f", "%-10.2f|", "%010.2f", "%s", "%10s", "%-10s|", "%'*10s", "%'010d", "%.2s", "%5.1s|");
foreach ($fmts as $f) {
    echo str_pad($f, 9), ":";
    foreach ($vals as $v) {
        $r = sprintf($f, $v);
        if ($f == "%c") $r = bin2hex($r);
        echo " [", $r, "]";
    }
    echo "\n";
}
?>
