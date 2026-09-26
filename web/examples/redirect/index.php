<?php
// Headers, cookies and redirects
if (isset($_GET['set'])) {
    setcookie("flavor", $_GET['set'], time() + 3600);
    header("Location: index.php?msg=" . urlencode("cookie set to " . $_GET['set']));
    exit;
}
if (isset($_GET['clear'])) {
    setcookie("flavor", "", time() - 3600);
    header("Location: index.php?msg=cleared");
    exit;
}
if (isset($_GET['notfound'])) {
    header("HTTP/1.0 404 Not Found");
    echo "<h1>404 - nothing here</h1><a href='index.php'>back</a>";
    exit;
}
header("X-Powered-By: my custom value");
header("Cache-Control: no-cache");
?>
<html><body>
<?php if (isset($_GET['msg'])) echo "<p style='background:#ffc'>", htmlspecialchars($_GET['msg']), "</p>"; ?>
<p>Your cookie: <b><?php echo isset($_COOKIE['flavor']) ? htmlspecialchars($_COOKIE['flavor']) : '(none)'; ?></b></p>
<p>Set cookie:
<a href="index.php?set=chocolate">chocolate</a> |
<a href="index.php?set=oatmeal">oatmeal</a> |
<a href="index.php?clear=1">clear</a></p>
<p><a href="index.php?notfound=1">Send a 404 status</a></p>
<p>Check the <b>Headers</b> tab to see the raw response.</p>
</body></html>
