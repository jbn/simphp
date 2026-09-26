<?php
error_reporting(E_ALL);
class Animal {
    var $name = "generic";
    var $legs = 4;
    var $tags = array("a", "b");
    var $nothing;
    function Animal($name = "anon") { $this->name = $name; echo "Animal ctor($name)\n"; }
    function speak() { return $this->name . " makes a sound"; }
    function describe() { return get_class($this) . ":" . $this->name . ":" . $this->legs; }
    function __construct() { echo "__construct is a normal method\n"; }
    function staticish($x) { return isset($this) ? "has this " . get_class($this) : "no this $x"; }
}
class Dog extends Animal {
    var $legs = 4;
    var $breed = "mutt";
    function Dog($name, $breed = "lab") { parent::Animal($name); $this->breed = $breed; echo "Dog ctor\n"; }
    function speak() { return parent::speak() . " (woof)"; }
    function fetch() { return Animal::speak() . " fetches"; }
}
class Puppy extends Dog { var $legs = 3; }
class NoCtor extends Animal { }
$a = new Animal("cat");
$d = new Dog("rex");
$p = new Puppy("bit", "pug");
$n = new NoCtor;
$n2 = new NoCtor("given");
echo $a->speak(), "\n", $d->speak(), "\n", $d->fetch(), "\n", $p->speak(), "\n", $p->describe(), "\n", $n->describe(), "\n";
$a->__construct();
echo Animal::staticish(1), "\n", $d->staticish(2), "\n", Dog::staticish(3), "\n";
echo get_class($p), " ", get_parent_class($p), " ", get_parent_class("puppy"), " ", var_export_s(get_parent_class($a)), "\n";
function var_export_s($v) { ob_start(); var_dump($v); $s = ob_get_contents(); ob_end_clean(); return trim($s); }
echo implode(",", get_class_methods("Dog")), "\n";
echo implode(",", get_class_methods($a)), "\n";
$cv = get_class_vars("Puppy"); ksort($cv); foreach ($cv as $k => $v) echo "$k=", is_array($v) ? implode("/", $v) : var_export_s($v), " "; echo "\n";
$ov = get_object_vars($d); ksort($ov); foreach ($ov as $k => $v) echo "$k=", is_array($v) ? implode("/", $v) : var_export_s($v), " "; echo "\n";
var_dump(method_exists($d, "fetch"), method_exists($d, "FETCH"), method_exists($a, "fetch"), method_exists("Dog", "speak"));
var_dump(class_exists("dog"), class_exists("DOG"), class_exists("Cat"), is_subclass_of($p, "animal"), is_subclass_of($p, "Dog"), is_subclass_of($a, "Animal"), is_subclass_of($d, "Puppy"));
var_dump(get_class(new stdClass), @get_class("notobj"), get_class_methods("nosuch"), @get_class_vars("nosuch"));
// dynamic props
$d->newprop = "dyn"; $d->{"weird key"} = 1; $prop = "breed"; echo $d->$prop, " ", $d->newprop, "\n";
$ov = get_object_vars($d); echo count($ov), "\n";
unset($d->newprop); var_dump(isset($d->newprop), isset($d->breed), isset($d->nothing), @$d->undefprop);
// copies vs references
$c1 = new Animal("orig");
$c2 = $c1; $c2->name = "copy";
$c3 = &$c1; $c3->name = "ref";
echo $c1->name, " ", $c2->name, " ", $c3->name, "\n";
$r = &new Animal("byref");
echo $r->name, "\n";
function modify($o) { $o->name = "modified"; }
function modifyref(&$o) { $o->name = "modified-ref"; }
$m = new Animal("m"); modify($m); echo $m->name, "\n"; modifyref($m); echo $m->name, "\n";
$list = array(new Animal("x"), new Animal("y"));
foreach ($list as $obj) $obj->name = "changed";
echo $list[0]->name, " ", $list[1]->name, "\n";
foreach ($list as $k => $obj) $list[$k]->name = "changed2";
echo $list[0]->name, "\n";
var_dump($a == $d, new Animal("q") == new Animal("q"), $c1 == $c3, $c1 === $c3);
$cls = "Dog"; $dyn = new $cls("dyn", "poodle"); echo $dyn->breed, "\n";
$meth = "speak"; echo $dyn->$meth(), "\n";
echo call_user_method("speak", $dyn), "\n";
echo call_user_func(array($dyn, "describe")), " ", call_user_func(array("Animal", "staticish"), 9), "\n";
echo call_user_func_array(array(&$dyn, "staticish"), array(1)), "\n";
?>
