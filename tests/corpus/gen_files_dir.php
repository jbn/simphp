<?php
error_reporting(E_ALL);
@mkdir("/tmp/phpsim", 0777);
$d = "/tmp/phpsim/dirtest";
var_dump(mkdir($d, 0755));
var_dump(@mkdir($d, 0755));
var_dump(@mkdir("$d/a/b/c", 0755));
mkdir("$d/sub", 0777);
foreach (array("b.txt", "a.txt", "c.log", ".hidden", "sub/inner.txt") as $n) { $fp = fopen("$d/$n", "w"); fwrite($fp, str_repeat($n, 3)); fclose($fp); }
$dh = opendir($d);
$names = array(); while (($e = readdir($dh)) !== false) $names[] = $e;
sort($names); echo implode(",", $names), "\n";
rewinddir($dh); $n = 0; while (readdir($dh) !== false) $n++; echo "count after rewind=$n\n";
closedir($dh);
$dir = dir($d);
echo get_class($dir), " path=", $dir->path, "\n";
$names = array(); while (false !== ($e = $dir->read())) $names[] = $e;
sort($names); echo implode(",", $names), "\n";
$dir->rewind(); $dir->close();
var_dump(@opendir("$d/nothere"));
echo function_exists('glob') ? "has glob\n" : "no glob\n";
echo function_exists('scandir') ? "has scandir\n" : "no scandir\n";
foreach (array($d, "$d/a.txt", "$d/sub", "$d/nothere", "/tmp/phpsim", "") as $p) {
    echo "[", str_replace("/tmp/phpsim", "T", $p), "] exists=", (int)file_exists($p), " file=", (int)is_file($p), " dir=", (int)is_dir($p), " link=", (int)is_link($p), " r=", (int)is_readable($p), " w=", (int)is_writable($p), " x=", (int)is_executable($p), "\n";
}
clearstatcache();
echo filesize("$d/a.txt"), " ", filetype("$d/a.txt"), " ", filetype("$d/sub"), " ", var_s(@filesize("$d/none")), " ", var_s(@filetype("$d/none")), "\n";
function var_s($v) { return is_bool($v) ? ($v ? "T" : "F") : $v; }
chmod("$d/a.txt", 0600); clearstatcache(); printf("%o\n", fileperms("$d/a.txt"));
chmod("$d/a.txt", 0644); clearstatcache(); printf("%o\n", fileperms("$d/a.txt"));
chmod("$d/sub", 0700); clearstatcache(); printf("%o\n", fileperms("$d/sub"));
chmod("$d/sub", 0755);
var_dump(touch("$d/touched", 1000000000)); clearstatcache(); echo filemtime("$d/touched"), " ", fileatime("$d/touched"), " ", filesize("$d/touched"), "\n";
var_dump(touch("$d/touched", 1234567890, 1111111111)); clearstatcache(); echo filemtime("$d/touched"), " ", fileatime("$d/touched"), "\n";
$st = stat("$d/a.txt"); echo count($st), " size=", $st[7], " ", $st['size'] === $st[7] ? "named ok" : "no named", "\n";
var_dump(@stat("$d/none"));
var_dump(copy("$d/a.txt", "$d/copy.txt"), filesize("$d/copy.txt"), @copy("$d/none", "$d/x"));
var_dump(rename("$d/copy.txt", "$d/renamed.txt"), file_exists("$d/copy.txt"), file_exists("$d/renamed.txt"), @rename("$d/none", "$d/y"));
var_dump(unlink("$d/renamed.txt"), @unlink("$d/renamed.txt"), @rmdir("$d/sub"), @rmdir("$d/none"));
$old = umask(022); printf("umask=%o\n", umask()); umask($old);
echo realpath("$d/sub/../a.txt") === "$d/a.txt" ? "realpath ok\n" : "realpath differs\n";
var_dump(realpath("$d/nonexist/../x"));
echo str_replace("/tmp/phpsim", "T", realpath("/tmp/phpsim/./dirtest//sub/")), "\n";
$fp = fopen("$d/big", "w"); for ($i = 0; $i < 1000; $i++) fwrite($fp, sprintf("%04d\n", $i)); fclose($fp);
clearstatcache(); echo filesize("$d/big"), " ", count(file("$d/big")), " ", md5(implode("", file("$d/big"))), "\n";
// cleanup
foreach (array("b.txt", "a.txt", "c.log", ".hidden", "sub/inner.txt", "touched", "big") as $n) unlink("$d/$n");
rmdir("$d/sub"); rmdir($d);
var_dump(is_dir($d));
?>
