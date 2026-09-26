<?php
// CGI: GET /cgi_get.php?name=O'Reilly&a[]=1&a[]=2&h[k]=v&sp=a+b%20c&dup=1&dup=2&e=&n
// COOKIE: sess=abc123; theme=dark%20mode; arr[x]=1
echo "method=$REQUEST_METHOD qs=$QUERY_STRING\n";
var_dump($name, $a, $h, $sp, $dup, $e, isset($n) ? $n : 'unset');
print_r($_GET); print_r($HTTP_GET_VARS); print_r($_COOKIE); print_r($_REQUEST);
echo $sess, " ", $theme, "\n";
echo $PHP_SELF, " ", $_SERVER['PHP_SELF'], " ", $SCRIPT_NAME, " ", $_SERVER['SCRIPT_FILENAME'], " ", $HTTP_USER_AGENT, " ", $_SERVER['REQUEST_URI'], "\n";
echo getenv('QUERY_STRING'), " ", $_ENV['REQUEST_METHOD'], " ", $HTTP_ENV_VARS['SERVER_SOFTWARE'], "\n";
echo count($_SERVER) > 10 ? "server ok\n" : "server small\n";
echo isset($argv) ? "argv set: " . count($argv) : "no argv", " argc=", isset($argc) ? $argc : 'unset', "\n";
header("X-Test: 1"); setcookie("c1", "v 1", 0, "/"); setcookie("c2", "v2", 1009411200);
header("Location: /elsewhere");
