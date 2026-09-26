<?php
$a = 5; $b = "5"; $c = 5.0;
var_dump($a == $b, $a === $b, $a == $c, $a === $c, "abc" == 0, null == false, array() == false, "1" == "01", "10" == "1e1", 100 == "1e2");
var_dump("abc" < "abd", "Z" < "a", 2 < "10", "2" < "10", "2a" < "10");
var_dump(1 + "1", "1" + "1", 1 + 1.5, "3" * "4", "10" / "4", 10 % 3, -10 % 3, 10 % -3);
var_dump("5 apples" + 5, "abc" + 1, "1.5e3" + 0, " 42" + 0, "0x1A" + 0, "012" + 0, 012, 0x1A);
var_dump(true + true, null + 5, "" . 1.0, "" . 0.1, 1e20 . "", (string) 1e15, (string) 123456789012345, (string) -0.0);
var_dump((int) 3.99, (int) -3.99, (int) "  12  ", (int) true, (int) null, (int) 1e10, (int) -1e10, (int) "1e3");
var_dump((bool) "0", (bool) "0.0", (bool) "", (bool) " ", (bool) array(), (bool) array(0), (bool) 0.0, (bool) "false");
var_dump(intval("42abc"), intval("abc42"), intval("0x1A", 16), intval("012", 0), intval("101", 2), floatval("1.5abc"));
$i = 5; echo $i++ + ++$i, " ", $i, "\n";
$x = "a"; $x++; echo $x, " "; $x = "Az"; $x++; echo $x, " "; $x = "zz"; $x++; echo $x, " "; $x = "a9"; $x++; echo $x, "\n";
$s = "abc"; $s[1] = 'X'; echo $s, " ", $s[0], $s{2}, "\n";
echo 1 . 2 + 3, "\n";
echo 7 . '' . 7, " ", "10" + "5" . "5", "\n";
var_dump(1 <> 2, 1 != "1", !empty($undefined), isset($a, $b), is_numeric("1e5"), is_numeric(" 1"), is_numeric("1 "), is_numeric("0x1A"), is_numeric("."));
$arr = array(1, 2, 3);
list($p, , $q) = $arr; echo "$p $q\n";
list($m, list($n, $o)) = array(1, array(2, 3)); echo "$m $n $o\n";
$v = 3;
switch ($v) { case "3": echo "string three\n"; break; case 3: echo "int three\n"; break; default: echo "default\n"; }
switch ("apple") { case 0: echo "zero!\n"; break; default: echo "not zero\n"; }
for ($i = 0, $j = 10; $i < $j; $i += 3, $j -= 3) echo "$i-$j ";
echo "\n";
$k = 0; do { echo $k; } while (++$k < 5); echo "\n";
$n = 0; while (true) { if (++$n > 3) break; if ($n == 2) continue; echo "n=$n "; } echo "\n";
for ($i = 0; $i < 3; $i++) { for ($j = 0; $j < 3; $j++) { if ($j == 1) continue 2; if ($i == 2) break 2; echo "$i$j "; } } echo "\n";
$t = 1 ? "a" : 2 ? "b" : "c"; echo $t, "\n";
echo $undefined_var === null ? "null" : "not", "\n";
$h = <<<EOT
Heredoc with $a and {$arr[1]} and ${b} and \$escaped
  indented "quotes" 'single'
EOT;
echo $h, "\n";
echo 'single $a \n \' \\', "\n";
echo "double \x41\101\t|\v|\$a {$a}s ${a}s $arr[0] \{$a}\n";
$name = "a"; $$name = "varvar"; echo $a, " ", ${"na" . "me"}, "\n";
$f = "strtoupper"; echo $f("dynamic"), "\n";
echo gettype(1), gettype(1.0), gettype("s"), gettype(true), gettype(array()), gettype(null), gettype(new stdClass), "\n";
@$z .= "x"; echo $z, "\n";
echo max(1, "2", 3.5), min(array(4, "3", 5)), max("apple", "banana"), max("10", "9"), max("abc", 0), "\n";
