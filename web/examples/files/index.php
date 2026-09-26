<?php
header("Content-Type: text/plain");

// Files written here persist on the simulated server's disk between requests
// (see the Files panel). file_put_contents() doesn't exist until PHP 5!
$log = "/tmp/visits.log";
$fp = fopen($log, "a");
fwrite($fp, date("Y-m-d H:i:s") . " " . $REMOTE_ADDR . " " . $HTTP_USER_AGENT . "\n");
fclose($fp);

$lines = file($log);
echo count($lines), " visit(s) logged in $log:\n";
echo implode("", $lines), "\n";

// file_get_contents() is PHP 4.3+, so read the whole file the old way
$fp = fopen(__FILE__, "r");
$src = fread($fp, filesize(__FILE__));
fclose($fp);
echo "This script is ", strlen($src), " bytes, ", count(file(__FILE__)), " lines.\n\n";

echo "Directory listing of /tmp:\n";
$d = opendir("/tmp");
while (($f = readdir($d)) !== false) {
    if ($f == "." || $f == "..") continue;
    printf("  %-24s %6d bytes  %s\n", $f, filesize("/tmp/$f"), date("H:i:s", filemtime("/tmp/$f")));
}
closedir($d);

echo "\nstat(__FILE__): ";
$st = stat(__FILE__);
echo "size=", $st[7], " mode=", decoct($st[2]), "\n";
echo "realpath('.'): ", realpath('.'), "\n";
echo "tempnam: ", tempnam("/tmp", "php"), "\n";
?>
