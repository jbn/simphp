<?php
error_reporting(E_ALL);
$versions = array("1.0", "1.0.0", "1.0.1", "1.1", "4.1.1", "4.1.1RC1", "4.1.1rc1", "4.1.1-dev", "4.1.1a", "4.1.1b", "4.1.1pl1", "4.1.1p1", "4.1.10", "4.1.2", "5", "5.0", "1..1", "1-0", "1_0", "1+0", "abc", "4.1.1alpha", "4.1.1beta", "4.1.1#1");
foreach ($versions as $a) {
    echo str_pad("[$a]", 12);
    foreach ($versions as $b) {
        $r = version_compare($a, $b);
        echo $r < 0 ? "<" : ($r > 0 ? ">" : "=");
    }
    echo "\n";
}
foreach (array("<", "lt", "<=", "le", ">", "gt", ">=", "ge", "==", "eq", "!=", "<>", "ne", "bogus") as $op) {
    echo $op, ":", var_s(version_compare("4.1.1", "4.1.2", $op)), var_s(version_compare("4.1.1", "4.1.1", $op)), " ";
}
echo "\n";
function var_s($v) { return is_bool($v) ? ($v ? "T" : "F") : (is_null($v) ? "N" : "[$v]"); }
echo version_compare(PHP_VERSION, "4.1.0", ">=") ? "ge 4.1.0\n" : "lt 4.1.0\n";
echo phpversion(), " ", zend_version() != "" ? "has zend version" : "", "\n";
// pack / unpack
$packs = array(
    array("a5", "ab"), array("A5", "ab"), array("a*", "hello"), array("A*", "hi  "), array("h*", "abc1"), array("H*", "48656c6c6f"), array("H3", "fff"), array("h3", "123"),
    array("c", 65), array("c", -1), array("C", 255), array("C", 256), array("C", -1), array("s", -2), array("S", 65535), array("n", 258), array("v", 258),
    array("i", -1), array("I", 4294967295), array("l", -2147483647), array("L", 3000000000), array("N", 16909060), array("V", 16909060), array("f", 1.5), array("d", 1.5), array("d", -0.1),
    array("x", 0), array("x3", 0), array("n*", 1)
);
foreach ($packs as $p) { $r = @pack($p[0], $p[1]); echo $p[0], "(", $p[1], ")=", bin2hex($r), "\n"; }
echo bin2hex(pack("nvc*", 0x1234, 0x5678, 65, 66)), "\n";
echo bin2hex(pack("a3xa3X2a2@10a1", "abc", "def", "gh", "z")), "\n";
echo bin2hex(pack("N2", 1, 2)), " ", bin2hex(pack("C*", 1, 2, 3, 4, 5)), "\n";
echo bin2hex(@pack("C", 1, 2)), "\n";
function show($a) { ksort($a); $o = array(); foreach ($a as $k => $v) $o[] = "$k=" . (is_float($v) ? sprintf("%.6f", $v) : $v); echo implode(" ", $o), "\n"; }
show(unpack("nfirst/vsecond/c2chars", pack("nvc*", 0x1234, 0x5678, 65, -66)));
show(unpack("C*", "\x01\x02\xff"));
show(unpack("c*", "\x01\x02\xff"));
show(unpack("N", "\xff\xff\xff\xff"));
show(unpack("V", "\xff\xff\xff\xfe"));
show(unpack("L", "\x00\x00\x00\x80"));
show(unpack("l", "\x00\x00\x00\x80"));
show(unpack("s", "\xff\xff"));
show(unpack("S", "\xff\xff"));
show(unpack("a3x/A3y", "ab\0cd "));
show(unpack("a*", "rest\0\0"));
show(unpack("A*", "rest  \0"));
show(unpack("H*", "\x12\xab"));
show(unpack("h*", "\x12\xab"));
show(unpack("H3", "\x12\xab"));
show(unpack("f", pack("f", 3.14)));
show(unpack("d", pack("d", 2.718281828)));
show(unpack("x2/Cval", "\x01\x02\x03"));
show(unpack("C2a/C2b", "\x01\x02\x03\x04"));
show(unpack("@2/Cc", "\x01\x02\x03"));
echo "last line fatal:\n";
show(unpack("N", "\x01\x02"));
?>
