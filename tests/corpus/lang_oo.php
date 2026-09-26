<?php
class Base {
    var $x = 1;
    var $arr = array('a' => 1);
    var $nul;
    function Base($x = 5) { $this->x = $x; echo "Base ctor\n"; }
    function who() { return "Base::" . get_class($this); }
    function stat() { return "static-ish " . (isset($this) ? "with this" : "no this"); }
}
class Child extends Base {
    var $y = 2;
    function who() { return "Child>" . parent::who(); }
}
class NoCtor extends Base { }
$c = new Child(7);
$n = new NoCtor();
echo $c->who(), " ", $c->x, " ", $n->x, "\n";
echo Base::stat(), " | ", $c->stat(), "\n";
var_dump($c);
print_r($c); echo "\n";
var_dump(get_class($c), get_parent_class($c), get_parent_class('child'), is_subclass_of($c, 'Base'), method_exists($c, 'WHO'), class_exists('child'), class_exists('Nope'));
print_r(get_class_vars('Child'));
print_r(get_object_vars($c));
print_r(get_class_methods('Child'));
$d = $c; $d->x = 100; echo $c->x, "\n";
$e =& $c; $e->x = 200; echo $c->x, "\n";
$o = new stdClass; $o->dyn = 1; $o->{'with space'} = 2; var_dump($o);
$arr = (array) $c; print_r($arr);
$obj = (object) array('a' => 1, 'b' => array(2)); var_dump($obj);
$str = serialize($c); echo $str, "\n";
$u = unserialize($str); var_dump($u == $c, get_class($u));
class Magic { var $v = 1; function __sleep() { echo "sleep\n"; return array('v'); } function __wakeup() { echo "wakeup\n"; } }
$m = unserialize(serialize(new Magic));
var_dump($c == $d, $c == $e);
$cls = 'Child'; $dyn = new $cls(3); echo get_class($dyn), "\n";
$meth = 'who'; echo $dyn->$meth(), "\n";
echo call_user_method('who', $dyn), "\n";
echo call_user_func(array($dyn, 'who')), " ", call_user_func(array('Base', 'stat')), "\n";
class Chain { var $v = 0; function add($n) { $this->v += $n; return $this; } }
$ch = new Chain; $r = $ch->add(1); $r->add(2); echo $ch->v, " ", $r->v, "\n";
class Counter { var $items = array(); function add($i) { $this->items[] = $i; } }
$list = array(new Counter, new Counter);
foreach ($list as $k => $v) { $v->add($k); }
echo count($list[0]->items), "\n";
foreach (array_keys($list) as $k) { $list[$k]->add($k); }
echo count($list[0]->items), "\n";
$a1 = new Base; $a2 = new Base; var_dump($a1 == $a2, $a1 === $a2);
