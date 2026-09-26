<?php
header("Content-Type: text/plain");

$xml = '<?xml version="1.0" encoding="ISO-8859-1"?>
<catalog>
  <book id="1" lang="en"><title>Programming PHP</title><year>2002</year></book>
  <book id="2" lang="en"><title>PHP and MySQL Web Development</title><year>2001</year></book>
</catalog>';

// SAX-style parsing with the bundled expat
$depth = 0;
function start_el($parser, $name, $attrs) {
    global $depth;
    echo str_repeat("  ", $depth), "<$name";
    foreach ($attrs as $k => $v) echo " $k=\"$v\"";
    echo ">\n";
    $depth++;
}
function end_el($parser, $name) { global $depth; $depth--; }
function cdata($parser, $data) {
    global $depth;
    if (trim($data) != "") echo str_repeat("  ", $depth), trim($data), "\n";
}
$p = xml_parser_create();
xml_set_element_handler($p, "start_el", "end_el");
xml_set_character_data_handler($p, "cdata");
if (!xml_parse($p, $xml, true)) {
    echo "XML error: ", xml_error_string(xml_get_error_code($p)), " at line ", xml_get_current_line_number($p), "\n";
}
xml_parser_free($p);

// Note: case folding is on by default, so tags come out UPPERCASE.
$p = xml_parser_create();
xml_parse_into_struct($p, $xml, $vals, $index);
xml_parser_free($p);
echo "\nxml_parse_into_struct index:\n";
print_r($index);

echo "\nWDDX packet:\n";
$packet = wddx_serialize_value(array("pi" => 3.14159, "list" => array(1, 2, 3), "ok" => true), "demo");
echo $packet, "\n\n";
print_r(wddx_deserialize($packet));

echo "\nserialize(): ", serialize(array("a" => 1, "b" => array(true, null, 1.5, "x"))), "\n";
?>
