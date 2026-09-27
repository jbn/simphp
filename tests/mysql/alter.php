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
// ALTER TABLE, indexes, REPLACE, temporary tables and table options
q("CREATE TABLE al (id int NOT NULL auto_increment PRIMARY KEY, name char(10) NOT NULL, n int)");
q("INSERT INTO al (name, n) VALUES ('a', 1), ('b', 2), ('c', NULL)");
q("ALTER TABLE al ADD email varchar(40) NOT NULL default 'none' AFTER name");
q("SELECT * FROM al", 0);
q("ALTER TABLE al ADD COLUMN first_col tinyint FIRST, ADD INDEX nidx (n)");
q("SHOW CREATE TABLE al", 0);
q("ALTER TABLE al CHANGE n num bigint unsigned NOT NULL");
q("SELECT * FROM al");
q("ALTER TABLE al MODIFY name varchar(3) binary");
q("SELECT name FROM al WHERE name = 'A'", 0);
q("ALTER TABLE al ALTER email SET DEFAULT 'x@y', ALTER num DROP DEFAULT");
q("INSERT INTO al (name) VALUES ('d')");
q("SELECT * FROM al", 0);
q("ALTER TABLE al DROP first_col, DROP INDEX nidx, ADD UNIQUE (email)");
q("ALTER IGNORE TABLE al ADD UNIQUE (email)");
// (Cardinality after ALTER comes from MyISAM's repair statistics: not shown)
$r = mysql_query("SHOW INDEX FROM al"); while ($k = mysql_fetch_assoc($r)) echo "  key ", $k['Key_name'], " ", $k['Seq_in_index'], " ", $k['Column_name'], " unique=", 1 - $k['Non_unique'], " sub=", v($k['Sub_part']), "\n";
q("ALTER TABLE al DROP nosuch");
q("ALTER TABLE al DROP INDEX nosuch");
q("ALTER TABLE al CHANGE nosuch x int");
q("ALTER TABLE al ADD x int AFTER nosuch");
q("ALTER TABLE al DROP PRIMARY KEY");
q("ALTER TABLE al MODIFY id int NOT NULL, DROP PRIMARY KEY");
q("DESCRIBE al", 0);
q("ALTER TABLE al ORDER BY name DESC");
q("SELECT id, name FROM al", 0);
q("ALTER TABLE al RENAME TO al2");
q("SELECT COUNT(*) FROM al2", 0);
q("ALTER TABLE al2 TYPE=HEAP");
q("ALTER TABLE al2 COMMENT='hello', AUTO_INCREMENT=100");
q("SHOW CREATE TABLE al2", 0);
q("CREATE INDEX ni ON al2 (name(2), email)");
q("SHOW KEYS FROM al2", 0);
q("DROP INDEX ni ON al2");
q("ALTER TABLE al2 DROP id, DROP name, DROP num, DROP email");
// REPLACE
q("CREATE TABLE rp (id int NOT NULL auto_increment PRIMARY KEY, code char(3) NOT NULL, v int, UNIQUE KEY code (code))");
q("REPLACE INTO rp (code, v) VALUES ('a', 1)");
q("REPLACE INTO rp (code, v) VALUES ('a', 2)");
q("REPLACE INTO rp (id, code, v) VALUES (1, 'b', 3)");
q("REPLACE INTO rp (id, code, v) VALUES (5, 'b', 4)");
q("REPLACE INTO rp VALUES (6, 'c', 5), (7, 'c', 6), (6, 'd', 7)");
q("REPLACE rp SET code = 'e', v = 8");
q("SELECT * FROM rp", 0);
q("INSERT IGNORE INTO rp (code, v) VALUES ('e', 9), ('f', 10)");
q("INSERT INTO rp (id, code) VALUES (100, 'z')");
q("INSERT INTO rp (code) VALUES ('y')");
q("INSERT INTO rp (id, code) VALUES (-5, 'neg')");
q("INSERT INTO rp (code) VALUES ('w')");
q("SELECT id, code FROM rp", 0);
// temporary tables
q("CREATE TEMPORARY TABLE tt (a int, b varchar(5))");
q("INSERT INTO tt VALUES (1, 'x'), (2, 'y')");
q("SELECT * FROM tt", 0);
q("SHOW TABLES", 0);
q("CREATE TEMPORARY TABLE rp (x int)");
q("SELECT * FROM rp", 0);
q("DROP TABLE rp");
q("SELECT COUNT(*) FROM rp", 0);
q("CREATE TEMPORARY TABLE tt2 SELECT a * 2 AS dbl, b FROM tt");
q("SELECT * FROM tt2");
// user variables and SET
q("SET @a = 5, @b = 'text', @c = 1.5, @d = NULL");
q("SELECT @a, @b, @c, @d, @nosuch, @a + @c");
q("SELECT @x := COUNT(*) FROM rp");
q("SELECT @x, @x * 2", 0);
q("SET @n = 0");
q("SELECT id, @n := @n + 1 AS seq FROM rp ORDER BY id DESC LIMIT 3", 0);
q("SET SQL_SELECT_LIMIT = 2");
q("SELECT id FROM rp", 0);
q("SELECT id FROM rp LIMIT 3", 0);
q("SET SQL_SELECT_LIMIT = DEFAULT");
q("SELECT COUNT(*) FROM rp", 0);
q("SET TIMESTAMP = 1009377005");
q("SELECT NOW(), UNIX_TIMESTAMP(), CURDATE() + 0", 0);
q("SET TIMESTAMP = DEFAULT");
q("SET INSERT_ID = 500");
q("INSERT INTO rp (code) VALUES ('ins')");
q("SET LAST_INSERT_ID = 77");
q("SELECT LAST_INSERT_ID()", 0);
q("SET OPTION SQL_BIG_TABLES = 1");
q("SET CHARACTER SET nosuch");
q("SET SQL_QUOTE_SHOW_CREATE = 0");
q("SHOW CREATE TABLE tt", 0);
q("SET @@nosuch = 1");
// LOCK TABLES
q("LOCK TABLES rp READ, tt WRITE");
q("SELECT COUNT(*) FROM rp", 0);
q("SELECT COUNT(*) FROM al2");
q("UPDATE rp SET v = 1");
q("LOCK TABLES rp AS r WRITE");
q("SELECT COUNT(*) FROM rp r", 0);
q("SELECT COUNT(*) FROM rp");
q("UNLOCK TABLES");
q("SELECT COUNT(*) FROM al2", 0);
// table maintenance
q("CHECK TABLE rp, nosuch");
q("OPTIMIZE TABLE rp");
q("ANALYZE TABLE rp");
q("REPAIR TABLE rp");
q("TRUNCATE TABLE rp");
q("INSERT INTO rp (code) VALUES ('new')");
q("TRUNCATE nosuch");
q("DROP TABLE IF EXISTS rp, nosuch");
q("FLUSH TABLES");
q("DO 1 + 1, @q := 5");
q("SELECT @q", 0);
