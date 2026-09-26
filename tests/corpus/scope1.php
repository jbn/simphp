<?php
$g = "global";
function no_global() { return isset($g) ? "set" : "unset"; }
function with_global() { global $g; return $g; }
function via_globals() { return $GLOBALS['g']; }
function set_global() { $GLOBALS['new_g'] = 'created'; global $another; $another = 'also'; }
echo no_global(), with_global(), via_globals(), "\n";
set_global(); echo $new_g, $another, "\n";
function stat_test() { static $a = 0, $b = array(); $a++; $b[] = $a; return count($b); }
stat_test(); stat_test(); echo stat_test(), "\n";
class S { function m() { static $c = 0; return ++$c; } }
$s1 = new S; $s2 = new S; $s1->m(); $s2->m(); echo $s1->m(), "\n";
$vn = 'dyn'; $$vn = 1; ${'dyn' . '2'} = 2; echo $dyn, $dyn2, "\n";
$arr = array('k' => 'v'); $key = 'arr'; echo ${$key}['k'], "\n";
$obj = new stdClass; $obj->p = 'prop'; $pn = 'p'; echo $obj->$pn, $obj->{'p'}, "\n";
echo isset($GLOBALS['g']) ? 'g in GLOBALS' : '', " ", count($GLOBALS) > 5 ? 'many' : 'few', "\n";
unset($g); echo isset($g) ? 'still' : 'gone', "\n";
function unset_global() { global $x; unset($x); } $x = 1; unset_global(); echo isset($x) ? "x survives\n" : "x gone\n";
$z = 1; function by_ref_global() { $GLOBALS['z']++; } by_ref_global(); echo $z, "\n";
$list = array(1, 2, 3); foreach ($list as $item) {} echo $item, "\n";
for ($i = 0; $i < 3; $i++) {} echo $i, "\n";
if (true) { $in_if = 'visible'; } echo $in_if, "\n";
echo empty($undefined) ? 'empty' : 'not', isset($undefined) ? 'isset' : 'notset', "\n";
$null = null; var_dump(isset($null), empty($null), is_null($null), isset($arr['k']), isset($arr['nope']), empty($arr['nope']));
$str = "abc"; var_dump(isset($str[1]), isset($str[5]), empty($str[0]));
$zero = "0"; var_dump(empty($zero), empty($zero2), empty(0.0), empty(array()), empty(new stdClass));
