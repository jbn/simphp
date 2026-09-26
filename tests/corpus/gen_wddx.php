<?php
error_reporting(E_ALL);
if (!function_exists('wddx_serialize_value')) { echo "no wddx\n"; exit; }
$vals = array(null, true, false, 0, 42, -7, 1.5, 0.1, 1e20, "", "hello", "<tag> & \"quote\" 'apos'", "line\nbreak\ttab", "\xe9\x01\x7f", array(), array(1, 2, 3), array("a" => 1, "b" => "two"), array(1 => "x", 2 => "y"), array(0 => "a", "k" => array("n" => null)));
foreach ($vals as $v) {
    $p = wddx_serialize_value($v);
    echo $p, "\n";
    $d = wddx_deserialize($p);
    ob_start(); var_dump($d); $o = ob_get_contents(); ob_end_clean();
    echo "  -> ", str_replace("\n", " ", $o), "\n";
}
echo wddx_serialize_value("with comment", "My Comment <x>"), "\n";
$a = 1; $b = "bee"; $c = array("x" => 1.25);
echo wddx_serialize_vars("a", "b", "c", "undefined_var"), "\n";
echo wddx_serialize_vars(array("a", array("b")), "c"), "\n";
$pk = wddx_packet_start("PKT");
wddx_add_vars($pk, "a");
wddx_add_vars($pk, "c", "b");
echo wddx_packet_end($pk), "\n";
class W { var $p = 1; var $q = "s"; }
$ws = wddx_serialize_value(new W); echo $ws, "\n";
$wd = wddx_deserialize($ws); ob_start(); var_dump($wd); echo str_replace("\n", " ", ob_get_contents()), "\n"; ob_end_clean();
$docs = array(
    "<wddxPacket version='1.0'><header/><data><string>plain</string></data></wddxPacket>",
    "<wddxPacket version='1.0'><header/><data><number>3.25</number></data></wddxPacket>",
    "<wddxPacket version='1.0'><header/><data><boolean value='true'/></data></wddxPacket>",
    "<wddxPacket version='1.0'><header/><data><array length='2'><number>1</number><string>b</string></array></data></wddxPacket>",
    "<wddxPacket version='1.0'><header/><data><struct><var name='k'><null/></var></struct></data></wddxPacket>",
    "<wddxPacket version='1.0'><header/><data><dateTime>2002-03-12T10:00:00</dateTime></data></wddxPacket>",
    "<wddxPacket version='1.0'><header/><data><string>a<char code='0A'/>b</string></data></wddxPacket>",
    "<wddxPacket><data><recordset rowCount='1' fieldNames='x'><field name='x'><number>1</number></field></recordset></data></wddxPacket>",
    "not xml at all",
    "",
    "<wddxPacket version='1.0'><header/><data><string>unterminated",
);
foreach ($docs as $doc) {
    $d = @wddx_deserialize($doc);
    ob_start(); var_dump($d); $o = ob_get_contents(); ob_end_clean();
    echo str_replace("\n", " ", $o), "\n";
}
?>
