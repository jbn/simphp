<?php
// CGI: POST /cgi_post.php?from=qs
echo $REQUEST_METHOD, " ", $CONTENT_TYPE, " ", $CONTENT_LENGTH, "\n";
print_r($_POST); print_r($HTTP_POST_VARS); print_r($_GET);
var_dump($user, $quote, $from, $lang);
echo isset($HTTP_RAW_POST_DATA) ? "raw: $HTTP_RAW_POST_DATA" : "no raw", "\n";
$fp = fopen("php://stdin", "r"); echo "stdin: ", var_export(fread($fp, 100), true), "\n";
