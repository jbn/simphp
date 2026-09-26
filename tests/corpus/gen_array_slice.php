<?php
error_reporting(E_ALL);
function p($a) { $o = array(); foreach ($a as $k => $v) $o[] = "$k=" . (is_array($v) ? "[" . implode(",", $v) . "]" : $v); echo "{", implode(" ", $o), "}\n"; }
$a = array("a", "b", "c", "d", "e");
$h = array("x" => 1, 5 => 2, "y" => 3, 9 => 4, 10 => 5);
foreach (array(array(0), array(2), array(-2), array(10), array(-10), array(1, 2), array(1, -1), array(-3, 2), array(0, 0), array(3, -5), array(1, null)) as $args) {
    echo implode(",", $args), ": ";
    if (count($args) == 1) { p(array_slice($a, $args[0])); echo "   h: "; p(array_slice($h, $args[0])); }
    else { p(array_slice($a, $args[0], $args[1])); echo "   h: "; p(array_slice($h, $args[0], $args[1])); }
}
// splice
$cases = array(array(1), array(-2), array(1, 2), array(1, 0, "X"), array(1, 0, array("X", "Y")), array(-1, 1, array("Z")), array(0, -2), array(10, 1, "Q"), array(2, 100), array(-10, 1));
foreach ($cases as $c) {
    $x = $a;
    if (count($c) == 1) $r = array_splice($x, $c[0]);
    elseif (count($c) == 2) $r = array_splice($x, $c[0], $c[1]);
    else $r = array_splice($x, $c[0], $c[1], $c[2]);
    echo "splice: "; p($r); echo "  left: "; p($x);
    $y = $h;
    if (count($c) == 1) $r = array_splice($y, $c[0]);
    elseif (count($c) == 2) $r = array_splice($y, $c[0], $c[1]);
    else $r = array_splice($y, $c[0], $c[1], $c[2]);
    echo "  hsplice: "; p($r); echo "  hleft: "; p($y);
}
// merge and +
p(array_merge(array(1, 2), array(3, 4)));
p(array_merge(array("a" => 1, 5 => 2), array("a" => 3, 5 => 4, "b" => 5)));
p(array_merge(array(), array(10 => 'x', 20 => 'y')));
p(array_merge(array("1" => 'a', "01" => 'b')));
p(array(1, 2) + array(3, 4, 5));
p(array("a" => 1) + array("a" => 2, "b" => 3));
p(array(5 => 'a') + array(5 => 'b', 6 => 'c'));
$m = array_merge_recursive(array("a" => array(1), "b" => 2, 5 => 'x'), array("a" => array(3), "b" => 4, 5 => 'y'));
print_r($m);
print_r(array_merge_recursive(array("k" => "v1"), array("k" => "v2"), array("k" => array("v3"))));
p(@array_merge(array(1), "notarray"));
p(array_pad(array(1, 2), 5, 0));
p(array_pad(array(1, 2), -5, 0));
p(array_pad(array(1, 2), 1, 0));
p(array_pad(array("a" => 1, 5 => 2), 4, "z"));
p(array_pad(array(), 3, null));
p(array_reverse(array("a", "b", "x" => "c", 7 => "d")));
p(array_reverse(array("a", "b", "x" => "c", 7 => "d"), true));
p(array_flip(array("a", "b", "a", 1, "1", 2)));
p(@array_flip(array(1.5, true, null, "x")));
p(array_unique(array(1, "1", 2, 2.0, "a", "A", "a", "", null, 0, "0", false)));
p(array_count_values(array(1, "1", "a", "A", "a", 1.5, "hello", "hello")));
?>
