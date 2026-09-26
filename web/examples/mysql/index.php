<?php
// A classic PHP 4 + MySQL guestbook. The simulator runs an emulated MySQL
// 3.23 server (see Server settings); PHP's real mysql extension talks to it.
$db = mysql_connect("localhost", "root", "") or die("Could not connect: " . mysql_error());
mysql_select_db("test", $db) or die(mysql_error());

mysql_query("CREATE TABLE IF NOT EXISTS guestbook (
    id int(11) NOT NULL auto_increment,
    name varchar(40) NOT NULL,
    email varchar(80),
    message text NOT NULL,
    posted datetime NOT NULL,
    PRIMARY KEY (id)
)") or die(mysql_error());

if ($REQUEST_METHOD == "POST" && trim($message) != "") {
    // magic_quotes_gpc is on: $name and $message are already escaped
    $sql = "INSERT INTO guestbook (name, email, message, posted)
            VALUES ('$name', '$email', '$message', NOW())";
    mysql_query($sql, $db) or die("Insert failed: " . mysql_error());
    header("Location: index.php?thanks=" . mysql_insert_id());
    exit;
}
if (isset($delete)) {
    mysql_query("DELETE FROM guestbook WHERE id = " . intval($delete));
}
?>
<html>
<head><title>My Guestbook</title></head>
<body bgcolor="#f0f0e8">
<h2>Sign my guestbook!</h2>
<?php if (isset($thanks)) echo "<p><font color=green>Thanks! You are visitor #" . intval($thanks) . ".</font></p>"; ?>
<form method="post" action="index.php">
<table>
<tr><td>Name:</td><td><input type="text" name="name" size="30"></td></tr>
<tr><td>Email:</td><td><input type="text" name="email" size="30"></td></tr>
<tr><td valign="top">Message:</td><td><textarea name="message" rows="4" cols="40"></textarea></td></tr>
<tr><td></td><td><input type="submit" value="Sign"></td></tr>
</table>
</form>
<hr>
<?php
$result = mysql_query("SELECT id, name, email, message,
                              DATE_FORMAT(posted, '%M %D, %Y at %h:%i %p') AS nice_date
                       FROM guestbook ORDER BY id DESC LIMIT 20") or die(mysql_error());
echo "<p>" . mysql_num_rows($result) . " entries (server " . mysql_get_server_info() . ")</p>\n";
while ($row = mysql_fetch_array($result)) {
    $who = htmlspecialchars(stripslashes($row["name"]));
    if ($row["email"]) $who = "<a href=\"mailto:" . htmlspecialchars($row["email"]) . "\">$who</a>";
    echo "<p><b>$who</b> wrote on " . $row["nice_date"] . ":<br>\n";
    echo nl2br(htmlspecialchars(stripslashes($row["message"])));
    echo " <small>[<a href=\"index.php?delete=" . $row["id"] . "\">delete</a>]</small></p>\n";
}
mysql_free_result($result);
mysql_close($db);
?>
<hr>
<small>Try <a href="admin.php">admin.php</a> for SHOW TABLES / DESCRIBE.</small>
</body>
</html>
