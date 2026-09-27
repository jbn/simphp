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
// row order without ORDER BY: scans, deleted-row reuse, joins
q("CREATE TABLE a (id int NOT NULL auto_increment PRIMARY KEY, v varchar(5), k int, KEY k (k))");
q("CREATE TABLE b (id int NOT NULL, w char(3), a_id int)");
q("CREATE TABLE c (x int)");
q("INSERT INTO a (v, k) VALUES ('a1', 3), ('a2', 1), ('a3', 2), ('a4', 1), ('a5', 3)");
q("INSERT INTO b VALUES (1, 'b1', 2), (2, 'b2', 1), (3, 'b3', 2), (4, 'b4', 9)");
q("INSERT INTO c VALUES (7)");
q("SELECT * FROM a", 0);
q("SELECT * FROM b", 0);
q("SELECT a.v, b.w FROM a, b", 0);
q("SELECT a.v, b.w FROM b, a", 0);
q("SELECT a.v, b.w FROM a, b WHERE a.id = b.a_id", 0);
q("SELECT a.v, b.w FROM b, a WHERE a.id = b.a_id", 0);
q("SELECT a.v, b.w FROM a, b WHERE a.k = b.id", 0);
q("SELECT a.v, b.w FROM a LEFT JOIN b ON b.a_id = a.id", 0);
q("SELECT a.v, b.w FROM b LEFT JOIN a ON b.a_id = a.id", 0);
q("SELECT a.v, c.x FROM a, c", 0);
q("SELECT a.v, c.x FROM c, a", 0);
q("SELECT v FROM a WHERE k = 1", 0);
q("SELECT v FROM a WHERE k > 1", 0);
q("SELECT v FROM a WHERE id > 2", 0);
q("SELECT v FROM a WHERE id IN (5, 1, 3)", 0);
q("SELECT id, v FROM a ORDER BY k", 0);
q("SELECT id, v FROM a ORDER BY k DESC", 0);
q("SELECT id FROM a ORDER BY id DESC", 0);
q("SELECT id, k FROM a ORDER BY k LIMIT 2", 0);
q("SELECT k, COUNT(*) FROM a GROUP BY k", 0);
q("SELECT k, COUNT(*) FROM a GROUP BY k DESC", 0);
q("SELECT k, v FROM a GROUP BY k", 0);
q("SELECT DISTINCT k FROM a", 0);
q("SELECT DISTINCT k FROM a LIMIT 2", 0);
q("SELECT DISTINCT a.k FROM a, b", 0);
q("DELETE FROM a WHERE id IN (2, 4)");
q("INSERT INTO a (v, k) VALUES ('a6', 5)");
q("INSERT INTO a (v, k) VALUES ('a7', 5)");
q("INSERT INTO a (v, k) VALUES ('a8', 5)");
q("SELECT * FROM a", 0);
q("SELECT * FROM a WHERE id > 0", 0);
q("SELECT * FROM a ORDER BY v", 0);
q("DELETE FROM b WHERE id = 1");
q("INSERT INTO b VALUES (5, 'b5', 1)");
q("SELECT * FROM b", 0);
q("UPDATE a SET v = 'zz' WHERE id = 1");
q("SELECT * FROM a", 0);
q("SELECT a.v, b.w FROM a, b WHERE a.k = 5 AND b.id > 2", 0);
q("SELECT * FROM a, c", 0);
q("SELECT COUNT(*) FROM a, b", 0);
q("SELECT a.id, b.id FROM a LEFT JOIN b ON a.id = b.a_id WHERE b.id IS NULL", 0);
q("SELECT MAX(id), MIN(v) FROM a", 0);
