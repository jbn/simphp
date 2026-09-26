<?php
session_start();
$file = session_save_path() . '/sess_' . session_id();
echo "<h3>" . htmlspecialchars($file) . "</h3>";
if (file_exists($file)) {
    $fp = fopen($file, 'r');
    $data = fread($fp, filesize($file) + 1);
    fclose($fp);
    echo "<pre>" . htmlspecialchars($data) . "</pre>";
} else {
    echo "<p>(not written yet &mdash; sessions are saved at the end of the request)</p>";
}
echo "<p>Cookies sent by the browser:</p><pre>";
print_r($HTTP_COOKIE_VARS);
echo "</pre><a href=\"index.php\">back</a>";
?>
