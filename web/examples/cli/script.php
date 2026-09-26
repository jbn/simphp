<?php
// Run with "Command line" mode: PHP 4.1.1 had no CLI SAPI yet, so shell
// scripts used the CGI binary with -q (quiet: no HTTP headers).
echo "argc = $argc\n";
echo "argv = "; print_r($argv);

$stdin = fopen("php://stdin", "r");
$n = 0;
while (!feof($stdin)) {
    $line = fgets($stdin, 4096);
    if ($line === false || $line === "") break;
    $n++;
    printf("%3d: %s", $n, strrev(rtrim($line)) . "\n");
}
fclose($stdin);
echo "read $n line(s) from stdin\n";
?>
