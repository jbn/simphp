<?php
session_start();

if (isset($_GET['reset'])) {
    session_destroy();
    header("Location: index.php");
    exit;
}

// PHP 4.1: $_SESSION is new; session_register() is the classic way
if (!isset($_SESSION['count'])) {
    $_SESSION['count'] = 0;
    $_SESSION['first_visit'] = date('H:i:s');
}
$_SESSION['count']++;
?>
<html><body>
<h2>Session counter</h2>
<p>You have viewed this page <b><?php echo $_SESSION['count']; ?></b> time(s)
since <?php echo $_SESSION['first_visit']; ?>.</p>
<p>Session id: <code><?php echo session_id(); ?></code><br>
Session name: <code><?php echo session_name(); ?></code><br>
Save path: <code><?php echo session_save_path(); ?></code></p>
<p><a href="index.php">Reload</a> &middot; <a href="index.php?reset=1">Destroy session</a>
&middot; <a href="dump.php">Look at the raw session file</a></p>
</body></html>
