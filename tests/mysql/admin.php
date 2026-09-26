<?php
$db = mysql_connect("localhost", "root", "") or die(mysql_error());
function show($sql) {
    global $db;
    echo "<h3>" . htmlspecialchars($sql) . "</h3>\n";
    $r = mysql_query($sql, $db);
    if (!$r) { echo "<p><b>Error " . mysql_errno() . ":</b> " . htmlspecialchars(mysql_error()) . "</p>"; return; }
    if ($r === true || !mysql_num_fields($r)) { echo "<p>OK, " . mysql_affected_rows() . " row(s) affected</p>"; return; }
    echo "<table border=1 cellpadding=3 cellspacing=0><tr bgcolor=#ccccff>";
    for ($i = 0; $i < mysql_num_fields($r); $i++) {
        echo "<th>" . htmlspecialchars(mysql_field_name($r, $i)) . "<br><small>" . mysql_field_type($r, $i) . "(" . mysql_field_len($r, $i) . ")</small></th>";
    }
    echo "</tr>\n";
    while ($row = mysql_fetch_row($r)) {
        echo "<tr>";
        foreach ($row as $v) echo "<td>" . (is_null($v) ? "<i>NULL</i>" : htmlspecialchars($v)) . "</td>";
        echo "</tr>\n";
    }
    echo "</table>\n";
}
?>
<html><body>
<?php
show("SHOW DATABASES");
mysql_select_db("test");
show("SHOW TABLES");
show("DESCRIBE guestbook");
show("SELECT COUNT(*), VERSION(), DATABASE() FROM guestbook");
show("SELECT * FROM nonexistent");
?>
<p><a href="index.php">back to the guestbook</a></p>
</body></html>
