<?php
$a = array(1, 2, 3);
foreach ($a as $k => $v) { $a[$k] = $v * 2; }
print_r($a);
$b = array(1, 2, 3);
$ref =& $b[1];
$copy = $b;
$copy[1] = 'changed';
print_r($b);
var_dump($b);
$x = 1; $y =& $x; unset($y); $y = 2; echo "$x $y\n";
function modify($arr) { $arr[] = 4; return $arr; }
$orig = array(1); $new = modify($orig); echo count($orig), count($new), "\n";
$arr = array('a' => array('b' => 1));
$r =& $arr['a']['b']; $r = 5; echo $arr['a']['b'], "\n";
$list = array(1, 2, 3);
while (list($k, $v) = each($list)) { if ($k == 0) $list[] = 4; echo $v; }
echo "\n";
$g = array(); $g[] =& $g; echo count($g), "\n";
$s = 'str'; $t =& $s; $t .= 'ing'; echo $s, "\n";
$objs = array(); for ($i = 0; $i < 3; $i++) { $o = new stdClass; $o->i = $i; $objs[] = $o; } echo $objs[0]->i, $objs[2]->i, "\n";
$m = array(3, 1, 2); $n =& $m; sort($n); print_r($m);
function &find(&$h, $k) { return $h[$k]; }
$hash = array('x' => 1); $f =& find($hash, 'x'); $f = 'found'; echo $hash['x'], "\n";
$data = array(1, 2, 3); foreach ($data as $v) { $v = 0; } print_r($data);
$aa = array(); $aa['x'] = &$aa['y']; $aa['y'] = 5; var_dump($aa);
