<?php
error_reporting(E_ALL);
function dump($x) { ob_start(); var_dump($x); $s = ob_get_contents(); ob_end_clean(); echo preg_replace('/\s+/', ' ', $s), "\n"; }
$tests = array(
    array('([0-9]+)-([0-9]+)', 'call 555-1234 now'),
    array('^abc', 'abcdef'),
    array('^abc', 'xabc'),
    array('[[:alpha:]]+', '123abc456'),
    array('[[:digit:]]+', 'abc123'),
    array('[[:space:]]', "a\tb"),
    array('[[:upper:]][[:lower:]]+', 'hello World'),
    array('[[:punct:]]+', 'abc!?.def'),
    array('[[:alnum:]_]+', '--foo_bar1--'),
    array('[[:xdigit:]]+', 'xyz0fAg'),
    array('(a|b)+', 'xxababy'),
    array('a{2,3}', 'aaaa'),
    array('(.*)@(.*)\.(.*)', 'user@example.com'),
    array('x?y', 'y'),
    array('\.', 'a.b'),
    array('[.]', 'ab'),
    array('()', 'abc'),
    array('(((a)))', 'a'),
    array('(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)(k)', 'abcdefghijk'),
);
foreach ($tests as $t) {
    $r = array();
    $n = ereg($t[0], $t[1], $r);
    echo $t[0], " => "; dump($n); echo "   "; dump($r);
    $r = array();
    $n = eregi(strtoupper($t[0]), strtoupper($t[1]) . strtolower($t[1]), $r);
    echo "   i: "; dump($n);
}
var_dump(ereg('abc', 'ABC'), eregi('abc', 'ABC'), ereg('', 'x'), @ereg('(', 'x'), @ereg('[a', 'x'), @ereg('a{1', 'x'));
echo ereg_replace('([0-9]+)', '<\\1>', 'a1b22c333'), "\n";
echo ereg_replace('([a-z])([0-9])', '\\2\\1', 'a1b2c3'), "\n";
echo ereg_replace('[[:space:]]+', '_', "a  b\t\tc\nd"), "\n";
echo ereg_replace('^', '>', "abc"), "\n";
echo ereg_replace('$', '<', "abc"), "\n";
echo ereg_replace('x*', '-', "abc"), "\n";
echo ereg_replace('a', 'b', ''), "|\n";
echo ereg_replace('(a)', '\\0\\0\\1\\2\\\\', 'xax'), "\n";
echo ereg_replace(65, 'B', 'xAx'), "\n";
echo eregi_replace('HELLO', 'bye', 'Hello hello HELLO'), "\n";
echo eregi_replace('([a-z]+)', '[\\1]', 'Mixed CASE words'), "\n";
print_r(split('[/.-]', '2002-03/12.x'));
print_r(split(',', 'a,b,c,d', 2));
print_r(split(',', ''));
print_r(split(',', ',a,,b,'));
print_r(spliti('X', 'axbXc'));
print_r(split('[[:space:]]+', " lead and trail "));
print_r(split('-', 'a-b-c', -1));
print_r(split('-', 'a-b-c', 0));
echo sql_regcase("Foo bar 123!"), "\n";
echo sql_regcase(""), "|", sql_regcase("\xe9"), "\n";
?>
