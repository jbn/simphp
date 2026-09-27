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
// error numbers and messages
q("CREATE TABLE e (id int NOT NULL PRIMARY KEY, u varchar(10), v int NOT NULL, UNIQUE KEY u (u), UNIQUE (v, u))");
q("INSERT INTO e VALUES (1, 'a', 1)");
q("INSERT INTO e VALUES (1, 'b', 2)");
q("INSERT INTO e VALUES (2, 'a', 2)");
q("INSERT INTO e (id, u, v) VALUES (3, 'c', 3), (4, 'c', 4)");
q("UPDATE e SET id = 1 WHERE id = 3");
q("SELECT nosuch FROM e");
q("SELECT e.nosuch FROM e");
q("SELECT x.id FROM e");
q("SELECT id FROM e WHERE nosuch = 1");
q("SELECT id FROM e ORDER BY nosuch");
q("SELECT id FROM e GROUP BY nosuch");
q("SELECT id FROM e, e");
q("SELECT id FROM e a, e a");
q("SELECT id FROM e a, e b");
q("SELECT * FROM nosuch");
q("SELECT * FROM test.nosuch");
q("SELECT * FROM nosuchdb.e");
q("INSERT INTO e (nosuch) VALUES (1)");
q("INSERT INTO e VALUES (5)");
q("INSERT INTO e (id, u) VALUES (6, 'x', 3)");
q("INSERT INTO e (id, v) VALUES (NULL, 1)");
q("INSERT INTO e (id, v) VALUES (7, NULL)");
q("UPDATE e SET nosuch = 1");
q("UPDATE e SET v = NULL WHERE id = 1");
q("DELETE FROM nosuch");
q("DELETE FROM e WHERE nosuch = 1");
q("CREATE TABLE e (x int)");
q("CREATE TABLE f (x int, x int)");
q("CREATE TABLE f (id int auto_increment)");
q("CREATE TABLE f (x varchar(300))");
q("CREATE TABLE f (x char(256))");
q("CREATE TABLE f (x int, KEY (y))");
q("CREATE TABLE f (x text, KEY (x))");
q("CREATE TABLE f (x nosuchtype)");
q("CREATE TABLE f ()");
q("DROP TABLE nosuch");
q("DROP TABLE e, nosuch1, nosuch2");
q("DROP TABLE IF EXISTS nosuch");
q("SHOW TABLES");
q("CREATE TABLE e (id int NOT NULL PRIMARY KEY, u varchar(10), v int NOT NULL, UNIQUE KEY u (u))");
q("INSERT INTO e VALUES (1, 'a', 1), (2, 'b', 2)");
q("ALTER TABLE nosuch ADD x int");
q("ALTER TABLE e ADD id int");
q("ALTER TABLE e DROP nosuch");
q("CREATE DATABASE test");
q("DROP DATABASE nosuchdb");
q("USE nosuchdb");
q("SELEC 1");
q("SELECT 1 FROM");
q("SELECT * FROM e WHERE");
q("SELECT * FROM e WHERE id = 'a");
q("SELECT * FROM e WHERE (id = 1");
q("SELECT * FROM e LIMIT -1");
q("SELECT * FROM e ORDER BY");
q("INSERT INTO e VALUES");
q("UPDATE e SET");
q("SELECT * FROM e; SELECT 1");
q("SELECT nosuchfunc(1)");
q("SELECT COUNT(*) FROM e WHERE id = 1 GROUP");
q("SELECT * FROM e WHERE id = 1 AND AND u = 'a'");
q("SELECT `id FROM e");
q("");
q("   ");
q("SELECT 1 +");
q("SELECT * FROM `e` WHERE `nosuch` = 1");
q("SELECT MAX(id), id FROM e GROUP BY v HAVING nosuch > 1");
q("SELECT SUM(id) FROM e WHERE SUM(id) > 1");
q("SELECT u FROM e WHERE u = 'a' UNION SELECT 1");
q("SELECT * FROM e WHERE id IN (SELECT id FROM e)");
q("INSERT INTO e SELECT * FROM e");
q("LOCK TABLES e READ");
q("INSERT INTO e VALUES (100, 'z', 100)");
q("SELECT COUNT(*) FROM b");
q("UNLOCK TABLES");
q("SELECT 'text' AS 'quoted alias', 1 AS `back`, 2 \"dq\"");
echo "errno after success: ", mysql_errno(), " '", mysql_error(), "'\n";
$r = @mysql_query("SELECT * FROM nosuch"); var_dump($r);
$r = mysql_query("SELECT * FROM nosuch"); echo mysql_num_rows($r), "\n";
mysql_select_db("mysql"); q("SELECT * FROM e");
