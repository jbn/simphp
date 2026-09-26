<?php
$data = array(1, 1.5, -0.1, "str", true, false, null, array('a' => array()), 2147483647, 1e20, 0.1 + 0.2);
$s = serialize($data); echo $s, "\n";
var_dump(unserialize($s) === $data);
echo serialize(1.0), serialize(0.1), serialize(1/3), serialize(-1e-10), serialize("é"), "\n";
var_dump(unserialize('a:2:{i:0;s:1:"a";s:1:"k";d:0.5;}'), unserialize('b:0;'), unserialize('garbage'), unserialize('i:5'), unserialize('O:8:"stdClass":1:{s:1:"p";i:1;}'));
var_dump(unserialize('O:7:"Unknown":1:{s:1:"a";i:1;}'));
$r = array(1); $r[] =& $r[0]; echo serialize($r), "\n";
echo urlencode(serialize(array("x" => "y"))), "\n";
echo wddx_serialize_value(array(1, "a" => "b", 'f' => 1.5, 't' => true)), "\n";
$a = 1; $b = "two"; echo wddx_serialize_vars("a", "b"), "\n";
print_r(wddx_deserialize('<wddxPacket version="1.0"><header/><data><struct><var name="x"><number>5</number></var><var name="y"><string>hi</string></var></struct></data></wddxPacket>'));
echo md5(serialize($data)), "\n";
