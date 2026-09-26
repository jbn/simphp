<?php
error_reporting(E_ALL);
@mkdir("/tmp/phpsim", 0777);
$f = "/tmp/phpsim/test.csv";
$csv = "a,b,c\n"
     . "1,\"two\",3\n"
     . "\"quoted, comma\",\"with \"\"escaped\"\" quotes\",plain\n"
     . ",,\n"
     . "\n"
     . "\"multi\nline\nfield\",x\n"
     . "  spaced , values  ,\" q \"\n"
     . "single\n"
     . "trailing,comma,\n"
     . "\"unterminated,quote\n"
     . "more,stuff\n";
$fp = fopen($f, "w"); fwrite($fp, $csv); fclose($fp);
$fp = fopen($f, "r");
$row = 0;
while (($data = fgetcsv($fp, 1000)) !== false) {
    $row++;
    echo "row $row (", count($data), "): ";
    foreach ($data as $cell) echo "[", str_replace("\n", "\\n", var_s($cell)), "]";
    echo "\n";
}
fclose($fp);
function var_s($v) { return is_null($v) ? "NULL" : $v; }
$fp = fopen($f, "w"); fwrite($fp, "a;b;'c;d'\n1;2;3\n'x''y';z\n"); fclose($fp);
$fp = fopen($f, "r");
while (($data = fgetcsv($fp, 1000, ";")) !== false) { echo count($data), ": ", implode("|", $data), "\n"; }
fclose($fp);
$fp = fopen($f, "w"); fwrite($fp, "abcdefghij,klmnop\nshort,x\n"); fclose($fp);
$fp = fopen($f, "r");
while (($data = fgetcsv($fp, 5)) !== false) { echo count($data), ": ", implode("|", $data), "\n"; }
fclose($fp);
$fp = fopen($f, "w"); fwrite($fp, "tab\tsep\tvalues\n"); fclose($fp);
$fp = fopen($f, "r"); print_r(fgetcsv($fp, 100, "\t")); fclose($fp);
$fp = fopen($f, "r"); print_r(@fgetcsv($fp, 100, "")); fclose($fp);
$fp = fopen($f, "r"); print_r(@fgetcsv($fp, 100, "ab")); fclose($fp);
$fp = fopen($f, "r"); var_dump(@fgetcsv($fp)); fclose($fp);
$fp = fopen($f, "w"); fclose($fp);
$fp = fopen($f, "r"); var_dump(fgetcsv($fp, 100)); fclose($fp);
// file() on various endings
$fp = fopen($f, "w"); fwrite($fp, "a\r\nb\rc\n\nd"); fclose($fp);
$l = file($f); echo count($l), ":"; foreach ($l as $x) echo "[", addcslashes($x, "\r\n"), "]"; echo "\n";
$fp = fopen($f, "r"); $out = ""; while (!feof($fp)) $out .= "<" . addcslashes(fgets($fp, 3), "\r\n") . ">"; fclose($fp); echo $out, "\n";
unlink($f);
?>
