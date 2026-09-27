<?php
// Shared by the tests/mysql scripts (pasted, not included, so each script
// is self-contained and its content hash covers everything it runs).
mysql_connect("localhost", "root", "") or die("connect: " . mysql_error() . "\n");
mysql_select_db("test") or die("select_db: " . mysql_error() . "\n");
function v($x) { return $x === null ? "NULL" : "'" . $x . "'"; }
function q($sql, $meta = 1) {
  echo "> $sql\n";
  $r = mysql_query($sql);
  if ($r === false) { echo "  ERR ", mysql_errno(), ": ", mysql_error(), "\n"; return; }
  if ($r === true) { echo "  ok affected=", mysql_affected_rows(), " insert_id=", mysql_insert_id(), "\n"; return; }
  $n = mysql_num_fields($r);
  echo "  rows=", mysql_num_rows($r), " fields=$n\n";
  if ($meta) for ($i = 0; $i < $n; $i++) {
    $f = mysql_fetch_field($r, $i);
    echo "  [", mysql_field_name($r, $i), "] table=", v(mysql_field_table($r, $i)), " type=", mysql_field_type($r, $i),
      " len=", mysql_field_len($r, $i), " flags=", v(mysql_field_flags($r, $i)), " max=", $f->max_length,
      " num=", $f->numeric, " blob=", $f->blob, "\n";
  }
  while ($row = mysql_fetch_row($r)) echo "  | ", implode(" | ", array_map("v", $row)), "\n";
  mysql_free_result($r);
}
// Queries of 2001-era PHP applications: forums, guestbooks, counters, sessions
q("CREATE TABLE users (user_id mediumint(8) NOT NULL auto_increment, username varchar(25) NOT NULL default '', user_password varchar(32) NOT NULL default '', user_regdate int(11) NOT NULL default '0', user_level tinyint(4) default '0', user_posts mediumint(8) unsigned NOT NULL default '0', user_email varchar(255) default NULL, PRIMARY KEY (user_id), KEY user_level (user_level))");
q("CREATE TABLE posts (post_id mediumint(8) unsigned NOT NULL auto_increment, topic_id mediumint(8) unsigned NOT NULL default '0', poster_id mediumint(8) NOT NULL default '0', post_time int(11) NOT NULL default '0', post_subject varchar(60), post_text text, PRIMARY KEY (post_id), KEY topic_id (topic_id), KEY poster_id (poster_id), KEY post_time (post_time))");
q("CREATE TABLE sessions (session_id char(32) NOT NULL default '', session_user_id mediumint(8) NOT NULL default '0', session_start int(11) NOT NULL default '0', session_time int(11) NOT NULL default '0', session_ip char(8) NOT NULL default '0', PRIMARY KEY (session_id), KEY session_user_id (session_user_id))");
q("INSERT INTO users (username, user_password, user_regdate, user_level, user_email) VALUES ('admin', MD5('secret'), 1009000000, 1, 'admin@example.com')");
q("INSERT INTO users (username, user_password, user_regdate) VALUES ('Anonymous', '', 0)");
q("INSERT INTO users VALUES (NULL, 'bob', '" . md5('pw') . "', 1009100000, 0, 0, NULL)");
for ($i = 1; $i <= 12; $i++) {
  mysql_query("INSERT INTO posts (topic_id, poster_id, post_time, post_subject, post_text) VALUES (" . (($i % 3) + 1) . ", " . (($i % 2) + 1) . ", " . (1009000000 + $i * 3600) . ", 'Subject $i', '" . addslashes("Post body #$i: it's \"quoted\"\n") . "')");
}
echo "last post id: ", mysql_insert_id(), "\n";
q("SELECT user_id, username, user_level FROM users WHERE username = 'ADMIN' AND user_password = '" . md5('secret') . "'");
q("SELECT COUNT(*) AS total FROM posts WHERE topic_id = 2");
q("SELECT p.post_id, p.post_subject, u.username, FROM_UNIXTIME(p.post_time, '%d %b %Y %H:%i') AS posted FROM posts p, users u WHERE u.user_id = p.poster_id AND p.topic_id = 1 ORDER BY p.post_time DESC LIMIT 0, 3", 0);
q("SELECT topic_id, COUNT(*) AS replies, MAX(post_time) AS last FROM posts GROUP BY topic_id ORDER BY last DESC", 0);
q("SELECT u.username, COUNT(p.post_id) AS n FROM users u LEFT JOIN posts p ON p.poster_id = u.user_id GROUP BY u.user_id ORDER BY n DESC, u.username", 0);
q("UPDATE users SET user_posts = user_posts + 1 WHERE user_id = 1");
q("UPDATE users SET user_posts = user_posts - 5 WHERE user_id = 1");
q("SELECT user_posts FROM users WHERE user_id = 1", 0);
q("SELECT post_id, LEFT(post_text, 12) AS preview, LENGTH(post_text) FROM posts WHERE post_text LIKE '%#1%' ORDER BY post_id", 0);
q("SELECT post_id FROM posts WHERE post_subject LIKE 'subject 1_' OR post_subject = 'Subject 2' ORDER BY post_id", 0);
q("SELECT * FROM posts WHERE post_id IN (3, 5, 99) ORDER BY post_id DESC", 0);
q("SELECT post_id FROM posts WHERE post_time BETWEEN 1009010000 AND 1009020000", 0);
q("SELECT DISTINCT topic_id FROM posts ORDER BY topic_id DESC", 0);
q("SELECT DISTINCT poster_id, topic_id FROM posts", 0);
q("SELECT post_id FROM posts ORDER BY post_id DESC LIMIT 5, 3", 0);
q("SELECT post_id FROM posts LIMIT 10, 5", 0);
q("SELECT post_id FROM posts LIMIT 20", 0);
q("SELECT SQL_BIG_RESULT post_id FROM posts WHERE poster_id = 2 AND topic_id != 3", 0);
q("SELECT HIGH_PRIORITY STRAIGHT_JOIN u.username FROM posts p, users u WHERE p.poster_id = u.user_id AND p.post_id = 4", 0);
// sessions: REPLACE, expiry DELETE, counters
q("INSERT INTO sessions VALUES ('" . md5('s1') . "', 1, 1009000000, 1009000500, '7f000001')");
q("INSERT INTO sessions VALUES ('" . md5('s2') . "', 2, 1009000000, 1009009000, '7f000001')");
q("UPDATE sessions SET session_time = 1009009999 WHERE session_id = '" . md5('s1') . "'");
q("UPDATE sessions SET session_time = 1009009999 WHERE session_id = '" . md5('s1') . "'");
q("DELETE FROM sessions WHERE session_time < 1009009500");
q("SELECT session_user_id, session_ip FROM sessions", 0);
q("CREATE TABLE counter (page varchar(100) NOT NULL, hits int unsigned NOT NULL default 0, PRIMARY KEY (page))");
foreach (array('/', '/index.php', '/', '/about.php', '/') as $p) {
  mysql_query("UPDATE counter SET hits = hits + 1 WHERE page = '$p'");
  if (mysql_affected_rows() == 0) mysql_query("INSERT INTO counter (page, hits) VALUES ('$p', 1)");
}
q("SELECT page, hits FROM counter ORDER BY hits DESC, page", 0);
// guestbook with escaping, NOW(), dates and pagination helpers
q("CREATE TABLE gb (id int NOT NULL auto_increment PRIMARY KEY, name varchar(50) NOT NULL, msg text NOT NULL, added datetime NOT NULL)");
$msgs = array("Hello, world!", "It's great\\nreally", "<b>bold</b> & \"quotes\"", str_repeat('x', 300), "Ümläut café");
foreach ($msgs as $i => $m) mysql_query("INSERT INTO gb (name, msg, added) VALUES ('user$i', '" . addslashes($m) . "', '2001-12-2$i 10:0$i:00')");
q("SELECT id, name, LENGTH(msg), DATE_FORMAT(added, '%M %e, %Y at %l:%i %p') AS d FROM gb ORDER BY added DESC LIMIT 3", 0);
q("SELECT COUNT(*), MIN(added), MAX(added), TO_DAYS(MAX(added)) - TO_DAYS(MIN(added)) FROM gb", 0);
q("SELECT id, msg FROM gb WHERE msg LIKE '%\\\\%' OR msg LIKE '%\"%'", 0);
q("SELECT id FROM gb WHERE UPPER(msg) LIKE '%CAFÉ%'", 0);
q("SELECT id, WEEK(added), DAYOFWEEK(added), YEAR(added), MONTHNAME(added) FROM gb", 0);
q("SELECT id FROM gb WHERE added > DATE_SUB('2001-12-24 00:00:00', INTERVAL 2 DAY) AND added < '2001-12-24'", 0);
q("SELECT name, IF(LENGTH(msg) > 20, CONCAT(LEFT(msg, 20), '...'), msg) AS short FROM gb ORDER BY id", 0);
// search and admin
q("SELECT username FROM users WHERE username REGEXP '^[a-b]' ORDER BY username", 0);
q("SELECT username, user_email FROM users WHERE user_email IS NULL OR user_email = ''", 0);
q("SELECT CONCAT(username, ' <', IFNULL(user_email, 'none'), '>') FROM users ORDER BY user_id", 0);
q("SELECT ELT(user_level + 1, 'user', 'admin') AS role, username FROM users", 0);
q("DELETE FROM posts WHERE poster_id = 2 LIMIT 2");
q("SELECT COUNT(*) FROM posts", 0);
q("OPTIMIZE TABLE posts", 0);
foreach (array('users', 'posts', 'sessions', 'counter', 'gb') as $t) {
  $r = mysql_query("SHOW TABLE STATUS LIKE '$t'"); $s = mysql_fetch_assoc($r);
  echo "  $t: ", $s['Type'], " ", $s['Row_format'], " rows=", $s['Rows'], " avg=", $s['Avg_row_length'], " data=", $s['Data_length'], " max=", $s['Max_data_length'], " index=", $s['Index_length'], " free=", $s['Data_free'], " auto=", v($s['Auto_increment']), "\n";
}
