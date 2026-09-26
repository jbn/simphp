<?php
var_dump(function_exists('mysql_connect'), extension_loaded('mysql'));
$c = mysql_connect();
var_dump($c, mysql_error(), mysql_errno());
$c = mysql_connect('localhost', 'root', 'secret');
var_dump($c, mysql_error(), mysql_errno());
$c = @mysql_connect('127.0.0.1:3306', 'root', '');
var_dump($c, mysql_error(), mysql_errno());
$c = mysql_pconnect("10.1.2.3", "u", "p");
var_dump(mysql_get_client_info());
$r = mysql_query("SELECT 1");
var_dump($r, mysql_escape_string("a'b\"c\0d\n"));
echo ini_get('mysql.default_socket'), "|", ini_get('mysql.default_port'), "|", ini_get('mysql.default_host'), "\n";
?>
<?php
$c = @mysql_connect("db.example.com", "u", "p"); var_dump($c, mysql_error(), mysql_errno());
$fp = @fsockopen("localhost", 80, $errno, $errstr, 5); var_dump($fp, $errno, $errstr);
$fp = @fsockopen("10.9.9.9", 25, $errno, $errstr, 5); var_dump($fp, $errno, $errstr);
$fp = fsockopen("no.such.host.invalid", 80, $errno, $errstr, 5); var_dump($fp, $errno, $errstr);
var_dump(gethostbyname("localhost"), gethostbyname("www.php.net"));
$f = @fopen("http://www.php.net/", "r"); var_dump($f);
?>
