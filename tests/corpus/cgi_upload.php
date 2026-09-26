<?php
// CGI: POST /cgi_upload.php
// CONTENT-TYPE: multipart/form-data; boundary=----phpsimBOUNDARY
print_r($_POST);
$f = $_FILES['userfile'];
echo $f['name'], "|", $f['type'], "|", $f['size'], "|", strlen($f['tmp_name']) > 0 ? 'tmp' : 'notmp', "|", is_uploaded_file($f['tmp_name']) ? 'uploaded' : 'not', "\n";
print_r(array_keys($f));
$fp = fopen($f['tmp_name'], 'rb'); echo bin2hex(fread($fp, 100)), "\n"; fclose($fp);
echo $userfile_name, " ", $userfile_size, " ", $userfile_type, " ", is_file($userfile) ? 'globalfile' : '', "\n";
print_r($HTTP_POST_FILES['second']);
var_dump(move_uploaded_file($f['tmp_name'], '/tmp/phpsim/moved.bin'), filesize('/tmp/phpsim/moved.bin'));
