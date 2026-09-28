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
// HEAP (memory) tables: hash keys, row order, what they can't do
q("CREATE TABLE h (id int NOT NULL, k int NOT NULL, v char(5), PRIMARY KEY (id), KEY k (k)) TYPE=HEAP");
q("INSERT INTO h VALUES (1, 10, 'a'), (2, 20, 'b'), (3, 10, 'c'), (4, 30, 'd'), (5, 10, 'e')");
q("SELECT * FROM h", 0);
q("SELECT * FROM h WHERE k = 10", 0);
q("SELECT * FROM h WHERE id = 3", 0);
q("SELECT * FROM h WHERE k > 10", 0);
q("SELECT * FROM h WHERE id IN (5, 1)", 0);
q("SELECT * FROM h ORDER BY id DESC", 0);
q("SELECT k, COUNT(*) FROM h GROUP BY k", 0);
q("EXPLAIN SELECT * FROM h WHERE k = 10", 0);
q("EXPLAIN SELECT * FROM h WHERE k > 10", 0);
q("EXPLAIN SELECT id FROM h ORDER BY id", 0);
q("EXPLAIN SELECT * FROM h WHERE id = 3", 0);
q("DELETE FROM h WHERE id = 2");
q("DELETE FROM h WHERE id = 4");
q("INSERT INTO h VALUES (6, 20, 'f'), (7, 10, 'g')");
q("SELECT * FROM h", 0);
q("SELECT * FROM h WHERE k = 10", 0);
q("UPDATE h SET k = 40 WHERE id = 1");
q("SELECT * FROM h WHERE k = 10", 0);
q("SELECT h.id, h2.id FROM h, h h2 WHERE h2.k = h.k AND h.id < h2.id", 0);
q("SHOW TABLE STATUS LIKE 'h'", 0);
q("SHOW INDEX FROM h", 0);
q("CREATE TABLE h2 (id int NOT NULL auto_increment PRIMARY KEY) TYPE=HEAP");
q("CREATE TABLE h3 (t text) TYPE=HEAP");
q("CREATE TABLE h4 (a int, KEY (a)) TYPE=HEAP");
q("CREATE TABLE h5 (a char(3) NOT NULL, b int NOT NULL, UNIQUE (a, b)) TYPE=HEAP");
q("INSERT INTO h5 VALUES ('x', 1), ('X', 1), ('y', 2)");
q("SELECT * FROM h5 WHERE a = 'x' AND b = 1", 0);
q("SELECT * FROM h5 WHERE a = 'x'", 0);
q("DELETE FROM h");
q("INSERT INTO h VALUES (9, 1, 'z')");
q("SELECT * FROM h", 0);
q("ALTER TABLE h TYPE=MyISAM");
q("SHOW CREATE TABLE h", 0);
q("SELECT * FROM h", 0);
