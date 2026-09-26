<?php
// CGI: GET /cgi_session.php
// COOKIE: PHPSESSID=0123456789abcdef0123456789abcdef
ini_set('session.save_path', '/tmp/phpsim');
session_start();
echo session_id(), " ", session_name(), " ", SID === '' ? 'empty SID' : SID, "\n";
if (!isset($_SESSION['n'])) $_SESSION['n'] = 0;
$_SESSION['n']++;
$_SESSION['arr'] = array(1, 'two' => 2.5, 'o' => new stdClass);
session_register('legacy'); $legacy = 'registered';
echo session_encode(), "\n";
session_write_close();
$fp = fopen('/tmp/phpsim/sess_' . session_id(), 'r'); echo fread($fp, 1000), "\n"; fclose($fp);
