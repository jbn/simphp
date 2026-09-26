<?php
error_reporting(E_ALL);
class Conn {
    var $dsn = "db://x";
    var $link = "LIVE";
    var $cache = array(1, 2);
    function __sleep() { echo "sleep called\n"; return array("dsn", "cache"); }
    function __wakeup() { echo "wakeup called\n"; $this->link = "RECONNECTED"; }
}
class Plain { var $a = 1; var $b = "two"; var $c = null; var $d = array("k" => 1.5); }
class Bad { var $x = 1; function __sleep() { return "notarray"; } }
class Missing { var $x = 1; function __sleep() { return array("x", "nosuch"); } }
$c = new Conn;
$s = serialize($c); echo $s, "\n";
$u = unserialize($s); echo get_class($u), " ", $u->link, " ", $u->dsn, " ", implode(",", $u->cache), "\n";
$p = new Plain; $s = serialize($p); echo $s, "\n";
$u = unserialize($s); var_dump($u);
echo serialize(new Missing), "\n";
$u = unserialize('O:7:"unknown":1:{s:1:"a";i:1;}'); echo get_class($u), "\n"; var_dump($u);
$u = unserialize('O:5:"plain":1:{s:1:"z";i:9;}'); echo get_class($u), "\n"; var_dump($u);
$arr = array("obj" => new Plain, "list" => array(new Conn));
$s = serialize($arr); echo $s, "\n";
$u = unserialize($s); echo get_class($u["obj"]), get_class($u["list"][0]), "\n";
$o = new Plain; $o->self = "x"; $o->dyn = array(1);
echo serialize($o), "\n";
// casting
$arr = (array)$p; ksort($arr); print_r($arr);
$obj = (object)array("a" => 1, "b" => array(2), 5 => "five");
var_dump($obj);
$back = (array)$obj; var_dump($back);
$o2 = (object)$obj; echo $o2 === $obj ? "same\n" : "diff\n";
$std = new stdClass; $std->x = 1; echo serialize($std), "\n";
echo serialize((object)null), " ", serialize((object)1), "\n";
// comparisons
$x1 = new Plain; $x2 = new Plain;
var_dump($x1 == $x2, $x1 === $x2);
$x2->a = 2;
var_dump($x1 == $x2, $x1 < $x2, $x1 > $x2);
$x3 = new Conn; var_dump($x1 == $x3);
echo strtolower(get_class(new PLAIN)), " ", get_class(new PLAIN), "\n";
?>
