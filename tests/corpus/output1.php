<?php
ob_start();
echo "inner";
$x = ob_get_contents();
ob_end_clean();
echo "[$x]\n";
function cb($b) { return str_replace("a", "4", $b); }
ob_start('cb'); echo "banana\n"; ob_end_flush();
ob_start(); echo "level1 "; ob_start(); echo "level2 "; $l2 = ob_get_contents(); ob_end_clean(); $l1 = ob_get_contents(); ob_end_clean(); echo "<$l1|$l2>\n";
echo ob_get_length() === false ? "no buffer\n" : "buffer\n";
ob_start(); echo "12345"; echo ob_get_length(), "\n"; ob_end_flush();
print("print returns "); $r = print(""); echo $r, "\n";
echo "echo", " ", "multiple", "\n";
printf("%s=%d\n", "printf", printf(""));
$out = sprintf("%05.1f", 9.96); echo $out, "\n";
highlight_string('<?php echo "hi"; // c ?>'); echo "\n";
var_dump(1, 1.5, "s", true, null, array(1, 'a' => array()), new stdClass);
print_r(1); print_r("s"); print_r(null); print_r(false); print_r(true); print_r(1.0); echo "\n";
print_r(array(1, array(2, array(3)), 'k' => null, 'f' => false, 't' => true)); echo "\n";
var_export(1.0); var_export("a'b\\c"); var_export(false); var_export(null); echo "\n";
var_export(array('a' => array(1, 2), 3 => 'x')); echo "\n";
$o = new stdClass; $o->a = 1; $o->b = array(1); var_export($o); echo "\n";
echo implode(" ", array(1.0, 2.50, -0.0, 1e25, true, false, null)), "\n";
echo str_repeat("=", 20), "\n";
flush();
echo "done\n";
