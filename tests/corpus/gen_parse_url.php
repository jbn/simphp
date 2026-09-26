<?php
error_reporting(E_ALL);
$urls = array(
    "http://user:pass@www.example.com:8080/path/to/file.php?a=1&b=2#frag",
    "https://example.com",
    "https://example.com/",
    "ftp://ftp.example.com/pub/file.tar.gz",
    "mailto:someone@example.com",
    "/just/a/path?q=1",
    "relative/path.html",
    "?query=only",
    "#fragonly",
    "//host.only/path",
    "http://[::1]:80/ipv6",
    "http://example.com:/nopor",
    "http://a:b@c",
    "file:///etc/passwd",
    "news:comp.lang.php",
    "http://example.com/path with spaces/?x=a b",
    "",
    "http://host?q#f",
    "host:1234",
    "http://user@host",
);
foreach ($urls as $u) {
    echo "URL: $u\n";
    $p = @parse_url($u);
    if (is_array($p)) { ksort($p); foreach ($p as $k => $v) echo "  $k => ", var_export_like($v), "\n"; }
    else { echo "  "; var_dump($p); }
}
function var_export_like($v) { return gettype($v) . ":" . $v; }
$qs = array("a=1&b=2", "a[]=1&a[]=2&b[x]=y", "a=1&a=2", "x+y=a+b&c%20d=e%20f", "=novalue&noeq&k=", "arr[a][b]=c", "a.b=1&c d=2", "", "a=%41%42", "x[]=1&x[5]=2&x[]=3", "magic='q'");
foreach ($qs as $q) {
    $out = array();
    parse_str($q, $out);
    echo "QS: $q\n";
    print_r($out);
}
parse_str("gx=1&gy[]=2");
echo $gx, " ", $gy[0], "\n";
// pathinfo/basename/dirname
$paths = array("/a/b/c.txt", "/a/b/c", "/a/b/", "c.txt", ".hidden", "/", "", "a/b.c/d", "/a/b/c.tar.gz", "//double//slash", "./rel", "../up/x.y", "noext.", "C:\\win\\path.txt");
foreach ($paths as $p) {
    echo "[$p] base=[", basename($p), "] base2=[", basename($p, ".txt"), "] dir=[", dirname($p), "]\n";
    $pi = pathinfo($p);
    ksort($pi);
    foreach ($pi as $k => $v) echo "   $k=[$v]";
    echo "\n";
}
?>
