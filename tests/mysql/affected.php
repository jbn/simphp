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
// affected rows, insert ids, num_rows, list_* helpers
q("CREATE TABLE a (id int NOT NULL auto_increment, name varchar(20) NOT NULL, n int, PRIMARY KEY (id), UNIQUE KEY name (name))");
q("INSERT INTO a (name, n) VALUES ('x', 1)");
q("INSERT INTO a (name, n) VALUES ('y', 2), ('z', 3), ('w', 4)");
q("INSERT INTO a (id, name) VALUES (10, 'ten')");
q("INSERT INTO a (name) VALUES ('eleven')");
q("INSERT INTO a (id, name) VALUES (0, 'zero')");
q("INSERT INTO a (id, name) VALUES (NULL, 'null')");
q("INSERT INTO a (id, name) VALUES (5, 'five')");
q("INSERT INTO a (name) VALUES ('after5')");
q("INSERT IGNORE INTO a (name) VALUES ('x')");
q("INSERT IGNORE INTO a (name) VALUES ('x'), ('v'), ('y')");
q("REPLACE INTO a (id, name, n) VALUES (1, 'x', 100)");
q("REPLACE INTO a (id, name, n) VALUES (200, 'brandnew', 1)");
q("REPLACE INTO a (id, name, n) VALUES (2, 'z', 7)");
q("REPLACE INTO a SET id = 300, name = 'setform'");
q("SELECT id, name, n FROM a ORDER BY id", 0);
q("SELECT LAST_INSERT_ID()");
q("UPDATE a SET n = 5 WHERE id > 1000");
q("UPDATE a SET n = n WHERE id = 1");
q("UPDATE a SET n = 100 WHERE id = 1");
q("UPDATE a SET n = 1 WHERE n IS NULL");
q("UPDATE a SET n = n + 1 ORDER BY id LIMIT 3");
q("UPDATE a SET name = 'X' WHERE id = 1");
q("UPDATE a SET name = 'y' WHERE id = 1");
echo "insert_id after update: ", mysql_insert_id(), "\n";
q("UPDATE a SET id = LAST_INSERT_ID(id + 1000) WHERE id = 300");
echo "insert_id after LAST_INSERT_ID(expr): ", mysql_insert_id(), "\n";
q("SELECT LAST_INSERT_ID()");
q("DELETE FROM a WHERE id = 99999");
q("DELETE FROM a WHERE id > 100");
q("DELETE FROM a WHERE n > 3 LIMIT 1");
q("DELETE FROM a WHERE 1");
q("INSERT INTO a (name) VALUES ('fresh')");
q("DELETE FROM a");
q("INSERT INTO a (name) VALUES ('again')");
q("CREATE TABLE b (x int)");
q("INSERT INTO b VALUES (1),(2),(3)");
q("INSERT INTO b SELECT x + 10 FROM b");
q("INSERT INTO b (x) SELECT MAX(x) FROM b");
q("SELECT * FROM b ORDER BY x", 0);
$r = mysql_query("SELECT * FROM b WHERE x > 100"); echo "empty num_rows=", mysql_num_rows($r), " fetch=", var_dump(mysql_fetch_row($r)), "\n";
$r = mysql_query("SELECT x FROM b ORDER BY x");
echo "num_rows=", mysql_num_rows($r), " result(2)=", mysql_result($r, 2), " result(0,'x')=", mysql_result($r, 0, 'x'), "\n";
mysql_data_seek($r, 4); $row = mysql_fetch_assoc($r); echo "seek 4: ", $row['x'], "\n";
$row = mysql_fetch_array($r); echo "array: ", count($row), " ", $row[0], " ", $row['x'], "\n";
$o = mysql_fetch_object($r); echo "object: ", $o->x, "\n";
print_r(mysql_fetch_lengths($r));
$r = mysql_unbuffered_query("SELECT x FROM b ORDER BY x DESC"); $row = mysql_fetch_row($r); echo "unbuffered first=", $row[0], "\n"; mysql_free_result($r);
$r = mysql_list_tables("test"); while ($t = mysql_fetch_row($r)) echo "table ", $t[0], " (", mysql_field_name($r, 0), ")\n";
$r = mysql_list_dbs(); echo "dbs: ", mysql_num_rows($r), " field ", mysql_field_name($r, 0), " len ", mysql_field_len($r, 0), " type ", mysql_field_type($r, 0), "\n";
while ($d = mysql_fetch_row($r)) echo "  db ", $d[0], "\n";
var_dump(mysql_create_db("second")); var_dump(mysql_create_db("second")); echo mysql_errno(), ": ", mysql_error(), "\n";
$r = mysql_list_tables("second"); echo "tables in second: ", mysql_num_rows($r), "\n";
var_dump(mysql_select_db("second")); var_dump(mysql_select_db("nosuchdb")); echo mysql_errno(), ": ", mysql_error(), "\n";
$r = mysql_db_query("test", "SELECT COUNT(*) FROM b"); echo "db_query: ", mysql_result($r, 0), "\n";
var_dump(mysql_drop_db("second")); var_dump(mysql_drop_db("second")); echo mysql_errno(), ": ", mysql_error(), "\n";
$r = mysql_list_tables("nosuchdb"); var_dump($r); echo mysql_errno(), ": ", mysql_error(), "\n";
