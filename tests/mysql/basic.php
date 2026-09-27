<?php
$link = mysql_connect("localhost", "root", "") or die("Could not connect: " . mysql_error());
echo "Connected: ", mysql_get_server_info(), " / ", mysql_get_host_info(), " / proto ", mysql_get_proto_info(), "\n";
mysql_select_db("test") or die(mysql_error());
mysql_query("DROP TABLE IF EXISTS guestbook");
mysql_query("CREATE TABLE guestbook (
  id int(11) NOT NULL auto_increment,
  name varchar(50) NOT NULL default '',
  email varchar(100),
  message text NOT NULL,
  rating tinyint(3) unsigned default '0',
  price decimal(8,2) NOT NULL,
  created datetime NOT NULL default '0000-00-00 00:00:00',
  ts timestamp(14),
  PRIMARY KEY (id),
  KEY name (name)
) TYPE=MyISAM") or die("create: " . mysql_error());
foreach (array(array("Rasmus", "rasmus@php.net", "Hello from 1995", 5, "9.5"), array("Zeev", null, "It's \"great\"", 300, "abc"), array("Andi", "andi@zend.com", "Zend Engine", -3, "1234.567")) as $r) {
  $sql = sprintf("INSERT INTO guestbook (name, email, message, rating, price, created) VALUES ('%s', %s, '%s', %d, '%s', '2001-12-26 12:00:00')",
    addslashes($r[0]), $r[1] === null ? "NULL" : "'" . addslashes($r[1]) . "'", addslashes($r[2]), $r[3], $r[4]);
  mysql_query($sql) or die("insert: " . mysql_error());
  echo "insert id ", mysql_insert_id(), " affected ", mysql_affected_rows(), "\n";
}
$res = mysql_query("SELECT id, name, email, message, rating, price, LENGTH(message) AS len, UPPER(name) FROM guestbook ORDER BY id");
echo mysql_num_rows($res), " rows, ", mysql_num_fields($res), " fields\n";
for ($i = 0; $i < mysql_num_fields($res); $i++) echo mysql_field_name($res, $i), ":", mysql_field_type($res, $i), ":", mysql_field_len($res, $i), ":", mysql_field_flags($res, $i), "\n";
while ($row = mysql_fetch_array($res)) { echo $row['id'], " ", $row['name'], " <", $row['email'], "> ", $row[3], " r=", $row['rating'], " p=", $row['price'], " len=", $row['len'], " ", $row[7], "\n"; }
mysql_free_result($res);
echo mysql_result(mysql_query("SELECT COUNT(*) FROM guestbook WHERE name = 'rasmus'"), 0), " (case-insensitive match)\n";
mysql_query("UPDATE guestbook SET rating = 5 WHERE rating = 5"); echo "noop update affected: ", mysql_affected_rows(), "\n";
mysql_query("UPDATE guestbook SET rating = rating + 1"); echo "update affected: ", mysql_affected_rows(), "\n";
mysql_query("INSERT INTO guestbook (id, name, message) VALUES (1, 'dup', 'x')"); echo mysql_errno(), ": ", mysql_error(), "\n";
mysql_query("SELECT * FROM nosuchtable"); echo mysql_errno(), ": ", mysql_error(), "\n";
mysql_query("SELECT nosuchcol FROM guestbook"); echo mysql_errno(), ": ", mysql_error(), "\n";
mysql_query("SELEC * FROM guestbook"); echo mysql_errno(), ": ", mysql_error(), "\n";
$r = mysql_query("SHOW TABLES"); while ($t = mysql_fetch_row($r)) echo "table: $t[0]\n";
$r = mysql_query("DESCRIBE guestbook"); while ($t = mysql_fetch_assoc($r)) echo implode("|", $t), "\n";
$r = mysql_query("SELECT DATE_FORMAT('2001-12-26 14:30:00', '%W %M %D %Y %h:%i %p'), CONCAT('a', 'b', 1), IF(1>2,'y','n'), LEFT('abcdef', 3), 7 / 2, PASSWORD('secret'), MD5('php'), UNIX_TIMESTAMP('2001-12-26 00:00:00') > 0");
print_r(mysql_fetch_row($r));
$r = mysql_list_dbs(); while ($d = mysql_fetch_object($r)) echo "db: ", $d->Database, "\n";
$f = mysql_list_fields("test", "guestbook"); echo mysql_num_fields($f), " fields via list_fields; ", mysql_field_flags($f, 0), "\n";
mysql_query("DELETE FROM guestbook"); echo "delete all affected: ", mysql_affected_rows(), "\n";
mysql_close($link);
