<?php
error_reporting(E_ALL);
if (!function_exists('xml_parser_create')) { echo "no xml\n"; exit; }
$depth = 0;
function startEl($p, $name, $attrs) {
    global $depth;
    ksort($attrs);
    $a = array(); foreach ($attrs as $k => $v) $a[] = "$k=$v";
    echo str_repeat("  ", $depth), "<$name ", implode(",", $a), "> line=", xml_get_current_line_number($p), "\n";
    $depth++;
}
function endEl($p, $name) { global $depth; $depth--; echo str_repeat("  ", $depth), "</$name>\n"; }
function cdata($p, $d) { if (trim($d) !== "") echo "  cdata[", str_replace("\n", "\\n", $d), "]\n"; }
function pi_h($p, $target, $data) { echo "PI $target [$data]\n"; }
function def_h($p, $d) { echo "DEF[", str_replace("\n", "\\n", $d), "]\n"; }
$doc = "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?>\n<root a=\"1\" B=\"two\">\n <item id='x'>Text &amp; more &lt;ok&gt;</item>\n <?php echo 1; ?>\n <empty/>\n <!-- comment -->\n <![CDATA[raw <stuff>]]>\n <Mixed>caf\xe9</Mixed>\n</root>";
foreach (array(1, 0) as $fold) {
    echo "== case folding $fold\n";
    $p = xml_parser_create();
    xml_parser_set_option($p, XML_OPTION_CASE_FOLDING, $fold);
    echo "opt=", xml_parser_get_option($p, XML_OPTION_CASE_FOLDING), " enc=", xml_parser_get_option($p, XML_OPTION_TARGET_ENCODING), "\n";
    xml_set_element_handler($p, "startEl", "endEl");
    xml_set_character_data_handler($p, "cdata");
    xml_set_processing_instruction_handler($p, "pi_h");
    xml_set_default_handler($p, "def_h");
    $r = xml_parse($p, $doc, true);
    echo "result=$r err=", xml_get_error_code($p), " ", xml_error_string(xml_get_error_code($p)), "\n";
    xml_parser_free($p);
}
$bad = array("<a><b></a>", "<a>", "<a x='1' x='2'/>", "no root", "<a>&undefined;</a>", "<a></a><b/>", "<?xml version='1.0'?><a>\xff</a>", "", "<a b=c/>", "<1a/>");
foreach ($bad as $b) {
    $p = xml_parser_create();
    $r = xml_parse($p, $b, true);
    $e = xml_get_error_code($p);
    echo "[", $b, "] r=$r code=$e (", xml_error_string($e), ") line=", xml_get_current_line_number($p), " col=", xml_get_current_column_number($p), " byte=", xml_get_current_byte_index($p), "\n";
    xml_parser_free($p);
}
for ($i = 0; $i <= 30; $i++) echo $i, ":", xml_error_string($i), "\n";
// into struct
$docs = array("<para><note>simple note</note></para>", "<a x='1'><b>t1</b><b y='2'>t2</b><c/></a>", "<root>\n  <x>1</x>\n  <x>2</x>\n</root>", "<a>text<b>inner</b>tail</a>");
foreach ($docs as $d) {
    $p = xml_parser_create();
    xml_parser_set_option($p, XML_OPTION_SKIP_WHITE, 1);
    $vals = array(); $index = array();
    xml_parse_into_struct($p, $d, $vals, $index);
    xml_parser_free($p);
    print_r($vals);
    print_r($index);
}
$p = xml_parser_create("UTF-8"); xml_parser_set_option($p, XML_OPTION_TARGET_ENCODING, "ISO-8859-1");
xml_parse_into_struct($p, "<a>caf\xc3\xa9</a>", $v, $ix); echo bin2hex($v[0]['value']), "\n";
xml_parser_free($p);
?>
