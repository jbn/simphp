<?php
$d = "/tmp/simphp";
@mkdir($d, 0755);
$f = "$d/test.txt";
$fp = fopen($f, "w"); fwrite($fp, "line1\nline2\r\nline3"); fputs($fp, "\nline4\n"); fclose($fp);
echo filesize($f), " ", file_exists($f) ? "exists" : "missing", " ", is_file($f) ? "file" : "", is_dir($d) ? " dir" : "", is_readable($f) ? " r" : "", is_writable($f) ? " w" : "", is_executable($f) ? " x" : " -x", "\n";
printf("%o %o\n", fileperms($f), fileperms($d));
print_r(file($f));
$fp = fopen($f, "r");
while (!feof($fp)) { $l = fgets($fp, 1024); echo strlen($l), ":", trim($l), " "; }
echo "\n"; rewind($fp); echo fgetc($fp), fgetc($fp), ftell($fp); fseek($fp, -3, SEEK_END); echo "|", fread($fp, 10), "|", var_export(fgets($fp, 10), true), "|", feof($fp) ? "eof" : "", "\n";
fclose($fp);
$fp = fopen($f, "a+"); fwrite($fp, "appended"); fseek($fp, 0); echo fread($fp, 5), "\n"; fclose($fp);
echo implode("", file($f)), "\n";
copy($f, "$d/copy.txt"); rename("$d/copy.txt", "$d/moved.txt"); echo file_exists("$d/copy.txt") ? "y" : "n", file_exists("$d/moved.txt") ? "y" : "n", "\n";
$h = opendir($d); $names = array(); while (false !== ($e = readdir($h))) $names[] = $e; closedir($h); sort($names); print_r($names);
$dir = dir($d); echo get_class($dir), " ", $dir->path, "\n"; $dir->close();
unlink("$d/moved.txt"); echo file_exists("$d/moved.txt") ? "still" : "gone", "\n";
echo basename("/a/b/c.txt"), " ", basename("/a/b/c.txt", ".txt"), " ", dirname("/a/b/c.txt"), " ", dirname("c.txt"), " ", dirname("/c"), "\n";
print_r(pathinfo("/www/htdocs/index.inc.php"));
echo realpath("/tmp/simphp/../simphp/./test.txt"), "\n";
$fp = fopen("$d/csv.csv", "w"); fwrite($fp, "a,b,\"c,d\"\n1,\"2\"\"x\",3\n"); fclose($fp);
$fp = fopen("$d/csv.csv", "r"); while ($row = fgetcsv($fp, 1000)) print_r($row); fclose($fp);
$tmp = tmpfile(); fwrite($tmp, "tmpdata"); fseek($tmp, 0); echo fread($tmp, 100), "\n"; fclose($tmp);
touch("$d/touched", 1000000000); echo filemtime("$d/touched"), "\n"; clearstatcache();
$st = stat($f); echo $st['size'], " ", $st[7], " ", count($st), "\n";
echo var_export(@file("/nonexistent"), true), " ", var_export(@fopen("/nonexistent", "r"), true), "\n";
echo fopen("$d", "r") ? "dir opened" : "dir failed", "\n";
$fp = fopen("php://stdout", "w"); fwrite($fp, "to stdout\n"); fclose($fp);
$fp = fopen("php://stdin", "r"); echo "stdin: ", var_export(fgets($fp, 100), true), "\n";
readfile($f); echo "\n";
$fp = fopen($f, "r"); fpassthru($fp); echo "\n";
echo is_uploaded_file($f) ? "uploaded" : "not uploaded", "\n";
rmdir("$d/nonempty_nonexistent");
?>
