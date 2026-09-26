<html><body>
<h2>File upload</h2>
<form method="post" enctype="multipart/form-data" action="upload.php">
  <input type="hidden" name="MAX_FILE_SIZE" value="100000">
  <input type="file" name="userfile"> <input type="submit" value="Upload">
</form>
<?php
if (isset($_FILES['userfile'])) {
    echo "<pre>";
    print_r($_FILES['userfile']);
    if (is_uploaded_file($_FILES['userfile']['tmp_name'])) {
        $fp = fopen($_FILES['userfile']['tmp_name'], 'rb');
        $head = fread($fp, 64);
        fclose($fp);
        echo "first bytes (hex): " . bin2hex($head) . "\n";
        move_uploaded_file($_FILES['userfile']['tmp_name'], '/tmp/' . basename($_FILES['userfile']['name']));
        echo "moved to /tmp/" . htmlspecialchars(basename($_FILES['userfile']['name'])) . "\n";
    }
    echo "</pre>";
}
?>
</body></html>
