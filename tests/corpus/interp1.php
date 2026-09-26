<?php
$a = array('k' => 'v', 5 => 'five', 'n' => array('m' => 'deep'));
$o = new stdClass; $o->p = 'prop'; $o->q = new stdClass; $o->q->r = 'nested';
$name = 'World'; $num = 42;
echo "Hello $name! $num items\n";
echo "Array: $a[k] $a[5] {$a['k']} ${a['k']} {$a['n']['m']}\n";
echo "Obj: $o->p {$o->p} {$o->q->r}\n";
echo "Escapes: \\ \$ \" \' \101 \x42 A \t| \e| \f| \z\n";
echo 'Single: \\ \' \n $name', "\n";
echo "Brace: {$name}s ${name}s {$num}0 \{$name}\n";
$fn = 'strtoupper'; echo "Not called: $fn(x)\n";
$arr2 = array(array(1, 2)); echo "Multi: $arr2[0] {$arr2[0][1]}\n";
$var = 'name'; echo "Varvar: ${$var}\n";
echo <<<EOT
Heredoc $name {$a['k']} $a[k]
  "quotes" 'apos' \$escaped \\ backslash
EOT;
echo "\n";
echo <<<EOT
EOT;
echo "|\n";
echo "Concat " . 1 + 2 . "\n";
echo "Num: " . 1.50 . " " . 0.1 + 0.2 . "\n";
echo "Dollar at end $", "\n";
echo "done
"; ?>
