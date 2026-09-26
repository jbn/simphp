<?php
error_reporting(E_ALL);
@mkdir("/tmp/phpsim", 0777);
$d = "/tmp/phpsim/io";
@mkdir($d, 0777);
$f = "$d/test.txt";
$fp = fopen($f, "w");
if (!$fp) die("cannot open\n");
var_dump(fwrite($fp, "line one\nline two\r\nline three\n\nlast line no newline"));
var_dump(fwrite($fp, "", 0), fwrite($fp, "abcdef", 3), fputs($fp, "XYZ"));
fclose($fp);
clearstatcache();
echo "size=", filesize($f), "\n";
$fp = fopen($f, "r");
while (!feof($fp)) { $l = fgets($fp, 1024); echo "[", addcslashes($l, "\r\n"), "] tell=", ftell($fp), "\n"; }
var_dump(fgets($fp, 10), feof($fp));
rewind($fp); echo ftell($fp), " ", fgets($fp, 5), " ", fgets($fp, 2), "|", fgets($fp, 1), "|\n";
fseek($fp, 5); echo fread($fp, 3), "\n";
fseek($fp, -4, SEEK_END); echo fread($fp, 100), "\n";
fseek($fp, 2, SEEK_SET); fseek($fp, 3, SEEK_CUR); echo ftell($fp), " ", fgetc($fp), fgetc($fp), "\n";
var_dump(fseek($fp, 1000), ftell($fp), fread($fp, 5), feof($fp));
var_dump(fseek($fp, -1000), ftell($fp));
rewind($fp); $chars = ""; while (($c = fgetc($fp)) !== false) $chars .= $c; echo strlen($chars), " ", md5($chars), "\n";
fclose($fp);
$lines = file($f); echo count($lines), "\n"; foreach ($lines as $i => $l) echo $i, ":", addcslashes($l, "\r\n"), "\n";
echo readfile($f), "\n";
$fp = fopen($f, "r"); fgets($fp, 100); echo "\npassthru=", fpassthru($fp), "\n";
// modes
$fp = fopen($f, "a"); fwrite($fp, "\nappended"); fclose($fp);
$fp = fopen($f, "r+"); fwrite($fp, "LINE"); fclose($fp);
$fp = fopen($f, "a+"); fwrite($fp, "!"); fseek($fp, 0); echo fread($fp, 12), "\n"; fclose($fp);
echo implode("|", file($f)), "\n";
$fp = fopen($f, "w+"); fwrite($fp, "fresh"); rewind($fp); echo fread($fp, 100), "\n"; fclose($fp);
var_dump(@fopen("$d/nonexistent/x", "r"), @fopen("$d/nope.txt", "r"), @fopen($f, "q"));
$fp = fopen($f, "rb"); var_dump(@fwrite($fp, "readonly")); fclose($fp);
if (function_exists('ftruncate')) { $fp = fopen($f, "r+"); var_dump(ftruncate($fp, 2)); fclose($fp); clearstatcache(); echo filesize($f), "\n"; }
if (function_exists('fflush')) { $fp = fopen($f, "a"); var_dump(fflush($fp)); fclose($fp); }
$fp = fopen($f, "r"); var_dump(flock($fp, LOCK_SH), flock($fp, LOCK_UN)); fclose($fp);
$fp = fopen("$d/nums.txt", "w"); fwrite($fp, "10 apples 2.5\n20 pears 3.75\nbad line\n"); fclose($fp);
if (function_exists('fscanf')) {
    $fp = fopen("$d/nums.txt", "r");
    while ($r = fscanf($fp, "%d %s %f")) { echo implode(",", $r), "\n"; }
    fclose($fp);
} else echo "no fscanf\n";
$fp = tmpfile(); fwrite($fp, "tmpdata"); rewind($fp); echo fread($fp, 10), "\n"; fclose($fp);
$fp = fopen($f, "r"); fclose($fp); var_dump(@fread($fp, 1), @fclose($fp));
unlink($f); unlink("$d/nums.txt"); rmdir($d);
var_dump(file_exists($d));
?>
