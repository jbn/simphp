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
// MyISAM key statistics: SHOW INDEX cardinality and the plans that use it
function si($t) {
  echo "  index of $t:";
  $r = mysql_query("SHOW INDEX FROM $t");
  while ($k = mysql_fetch_assoc($r)) echo " ", $k['Key_name'], ".", $k['Column_name'], "=", v($k['Cardinality']);
  echo "\n";
}
q("CREATE TABLE s (id int NOT NULL auto_increment PRIMARY KEY, a int, b char(10) NOT NULL, c varchar(20) NOT NULL, KEY a (a), KEY ab (a, b), UNIQUE KEY c (c), KEY bn (b))");
q("INSERT INTO s (a, b, c) VALUES (1,'x','c1'),(1,'y','c2'),(2,'x','c3'),(NULL,'z','c4'),(NULL,'z','c5'),(3,'x','c6'),(3,'x','c7'),(3,'y','c8')");
si('s');
q("EXPLAIN SELECT * FROM s WHERE a = 3", 0);
q("ANALYZE TABLE s", 0);
si('s');
q("EXPLAIN SELECT * FROM s WHERE a = 3", 0);
q("EXPLAIN SELECT * FROM s WHERE a = 3 AND b = 'x'", 0);
q("EXPLAIN SELECT x.id, y.id FROM s x, s y WHERE y.a = x.id", 0);
q("ANALYZE TABLE s", 0);
q("INSERT INTO s (a, b, c) VALUES (4,'w','c9'),(4,'w','c10')");
si('s');
q("DELETE FROM s WHERE id = 1");
q("OPTIMIZE TABLE s", 0);
si('s');
q("INSERT INTO s (a, b, c) VALUES (5,'v','c11')");
q("CHECK TABLE s", 0);
si('s');
q("REPAIR TABLE s", 0);
si('s');
q("CREATE TABLE t2 (id int NOT NULL, k int, name char(12), KEY k (k), KEY name (name), KEY idk (id, k))");
q("INSERT INTO t2 SELECT id, a, c FROM s");
si('t2');
q("CREATE TABLE t3 (id int NOT NULL, k int, KEY k (k)) SELECT id, a AS k FROM s");
si('t3');
q("CREATE TABLE t4 (id int NOT NULL auto_increment, k int, KEY id (id), KEY k (k))");
q("INSERT INTO t4 (k) SELECT a FROM s");
si('t4');
q("DELETE FROM t4");
si('t4');
q("CREATE TABLE t5 (a int, b int, KEY a (a), KEY b (b))");
q("INSERT INTO t5 VALUES (1, 1), (1, 2), (2, 2)");
q("ALTER TABLE t5 ADD c int");
si('t5');
q("INSERT INTO t5 (a, b) VALUES (3, 3)");
q("INSERT INTO t5 (a, b) SELECT a + 10, b FROM t5");
si('t5');
q("CREATE TABLE t6 (a int NOT NULL, b int, UNIQUE (a), KEY b (b))");
q("INSERT INTO t6 VALUES (1, 1), (2, 1), (3, 2)");
q("ALTER TABLE t6 ADD c int");
si('t6');
