<?php
error_reporting(E_ALL);
$snips = array(
    '<?php echo "Hello"; ?>',
    '<?php
// comment
/* block */
$a = 1 + 2; # hash
function f($x) { return $x * 2; }
class C { var $p = "s"; }
if ($a > 1) { echo \'single\'; } else { print "dq $a"; }
?>',
    'plain html <b>bold</b>',
    '<?php $s = <<<EOT
heredoc $a text
EOT;
?>',
    '<? short ?>',
    '<?php $x = array(1 => "a", \'b\' => 2.5, 0x1F, 017); ?>',
    '',
);
foreach ($snips as $s) {
    ob_start();
    highlight_string($s);
    $h = ob_get_contents();
    ob_end_clean();
    echo $h, "\n---\n";
}
$name = "World"; $arr = array("k" => "v", 2 => "two"); $obj = new stdClass; $obj->p = "prop";
echo "Hello $name! {$name}s ${name} $arr[k] {$arr['k']} $arr[2] $obj->p {$obj->p}\n";
echo "Escapes: \t|\\|\$|\"|\x41|\101|\x4|A|\e|\v|\f|\q|\'\n";
echo 'Single: \t|\\|\'|$name|\x41', "\n";
echo "Octal overflow: \400|\777", "|", bin2hex("\400"), "\n";
echo "Brace: {$arr['k']}{$name}{", "}\n";
echo "Dollar at end: $", " and $ space and $1 digit\n";
$heredoc = <<<EOT
Heredoc with $name and {$arr['k']} and $arr[k]
Tabs\there and "quotes" and 'single' and \$escaped
  Indented line
EOT;
echo $heredoc, "\n";
$h2 = <<<X
X;
echo "[", $h2, "]\n";
$h3 = <<<END
line with END inside
END;
echo $h3, "\n";
echo <<<A
direct echo \x42\102
A;
echo "\n";
echo "nested \"quotes\" and 'singles' and \\\\ double backslash\n";
$v = "var"; $varvar = "v"; echo $$varvar, " ", ${"v"}, " ", ${'v' . ''}, "\n";
echo "{$v}iable", " ", "${v}iable", "\n";
?>
