<?php
error_reporting(E_ALL);
function dump($x) { ob_start(); var_dump($x); $s = ob_get_contents(); ob_end_clean(); echo preg_replace('/\s+/', ' ', $s), "\n"; }
$tests = array(
    array('/(\d+)-(\d+)/', 'abc 123-456 def 78-9'),
    array('/^abc/i', 'ABCdef'),
    array('/^def/m', "abc\ndef"),
    array('/^def/', "abc\ndef"),
    array('/a.c/s', "a\nc"),
    array('/a.c/', "a\nc"),
    array('/a b c/x', "abc"),
    array('/a+?/', "aaa"),
    array('/a+/U', "aaa"),
    array('/a+?/U', "aaa"),
    array('/abc$/', "abc\n"),
    array('/abc$/D', "abc\n"),
    array('/bc/A', "abc"),
    array('/(?P<year>\d{4})/', "in 2002"),
    array('/(a)(b)?(c)/', "ac"),
    array('/(a)|(b)/', "b"),
    array('/[[:alpha:]]+/', "123abc456"),
    array('/\bword\b/', "a word here"),
    array('/(?i)MiXeD/', "mixed"),
    array('/(?<=a)b/', "ab cb"),
    array('/(\w)\1/', "hello"),
    array('#/path/#', "/a/path/b"),
    array('{x+}', "axxxb"),
    array('/\x41\101/', "AA"),
    array('/caf\xe9/', "caf\xe9"),
    array('/[^\x00-\x7f]/', "abc\xff"),
    array('/(?:a|b)+/', "abba"),
    array('/a{2,3}/', "aaaa"),
    array('//', "any"),
    array('/x*/', ""),
);
foreach ($tests as $t) {
    $m = array();
    $r = preg_match($t[0], $t[1], $m);
    echo $t[0], " => $r "; dump($m);
}
$s = "a1b22c333 d4444";
foreach (array(PREG_PATTERN_ORDER, PREG_SET_ORDER) as $flag) {
    $m = array();
    $n = preg_match_all('/([a-z])(\d+)/', $s, $m, $flag);
    echo "flag=$flag n=$n "; dump($m);
}
$m = array(); echo preg_match_all('/\d/', "", $m), " "; dump($m);
$m = array(); echo preg_match_all('/(x)?y/', "y xy", $m), " "; dump($m);
$m = array(); echo preg_match_all('//', "abc", $m), " "; dump($m);
echo defined('PREG_OFFSET_CAPTURE') ? "has offset capture\n" : "no offset capture\n";
echo defined('PREG_SPLIT_OFFSET_CAPTURE') ? "has split offset capture\n" : "no split offset capture\n";
// invalid patterns
$bad = array('abc', '/abc', '/(abc/', '/abc/Q', '/[a-/', '/a{2,1}/', '/(?<n/', '', '/\\/', 'aabca');
foreach ($bad as $b) { echo "[$b] => "; var_dump(preg_match($b, "abc")); }
dump(preg_match('/a/', array("a")));
dump(preg_match('/(\d)/', 12345));
?>
