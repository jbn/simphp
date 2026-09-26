<?php
error_reporting(E_ALL);
class T { var $x; }
$vals = array(null, true, false, 0, 1, -1, 0.0, 1.5, "", "0", "0.0", "a", " ", "00", array(), array(0), new T);
$fns = array("is_null", "is_bool", "is_int", "is_integer", "is_long", "is_float", "is_double", "is_real", "is_string", "is_array", "is_object", "is_numeric", "is_scalar", "is_resource");
foreach ($vals as $i => $v) {
    echo str_pad(gettype($v), 8), " ";
    foreach ($fns as $f) echo $f($v) ? "1" : "0";
    echo " empty=", empty($v) ? 1 : 0, " bool=", (bool)$v ? 1 : 0, " isset=", isset($v) ? 1 : 0;
    echo " int=", @(int)$v, " str=[", @(string)$v, "] float=", @(float)$v, " strval=[", is_object($v) ? "obj" : strval($v), "]\n";
}
// string increment
$strs = array("a", "z", "Z", "zz", "Az", "zZ9", "a9", "9", "99", "A99", "-", "", "a-z", "1.5", "1e2", " ", "Zz", "zzz");
foreach ($strs as $s) { $o = $s; $s++; echo "[$o]++ = "; var_dump($s); }
foreach (array("a", "10", "", "abc", "1.5") as $s) { $o = $s; $s--; echo "[$o]-- = "; var_dump($s); }
$n = null; $n++; var_dump($n);
$n = null; $n--; var_dump($n);
$b = true; $b++; var_dump($b);
$f = 1.5; $f++; var_dump($f);
// settype/gettype
$v = "123abc"; settype($v, "integer"); var_dump($v);
$v = 1; settype($v, "array"); var_dump($v);
$v = "x"; settype($v, "object"); var_dump(gettype($v), get_object_vars($v));
$v = array(1); settype($v, "string"); var_dump($v);
$v = 3.7; settype($v, "bool"); var_dump($v);
$v = 3.7; settype($v, "int"); var_dump($v);
$v = 3.7; settype($v, "float"); var_dump($v);
$v = "3.7"; settype($v, "double"); var_dump($v);
// isset/empty/unset
$arr = array("a" => null, "b" => array("c" => 0));
var_dump(isset($arr["a"]), isset($arr["b"]["c"]), isset($arr["b"]["d"]), isset($arr["x"]["y"]), isset($undef), empty($undef), empty($arr["b"]["c"]), empty($arr["b"]));
$str = "abc"; var_dump(isset($str[1]), isset($str[5]), empty($str[0]));
$z = 1; unset($z); var_dump(isset($z));
$x1 = 1; $x2 = null; var_dump(isset($x1, $x2), isset($x1, $x1));
// array to string etc.
$a = array(1, 2);
echo "arr: " . $a . "\n";
echo "concat: " . null . true . false . 0.50 . "\n";
var_dump("10" == "1e1", 100 == "1e2", "abc" == 0, null == false, array() == false, "0" == false, "" == null, "a" == "a ");
var_dump((string)true, (string)false, (int)"  42  ", (int)"4.9e1", (bool)"0.0", (bool)array(0), (bool)0.0, (bool)"false");
var_dump(1 + true, "5" * "4", "3" . 4, -"5", +"abc", "2" % "3");
?>
