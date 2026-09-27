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
// two connections from one script: what is per connection, what is shared
$a = mysql_connect("localhost", "root", "");
$b = mysql_connect("localhost:/tmp/mysql.sock", "root", "");
$c = mysql_connect("localhost", "root", "");
echo "a != b: ", ($a != $b ? 'yes' : 'no'), ", a == c: ", ($a == $c ? 'yes' : 'no'), "\n";
mysql_select_db("test", $b);
function ql($link, $sql) {
  echo "[", $link == $GLOBALS['a'] ? 'a' : 'b', "] > $sql\n";
  $r = mysql_query($sql, $link);
  if ($r === false) { echo "  ERR ", mysql_errno($link), ": ", mysql_error($link), "\n"; return; }
  if ($r === true) { echo "  ok affected=", mysql_affected_rows($link), " insert_id=", mysql_insert_id($link), "\n"; return; }
  while ($row = mysql_fetch_row($r)) echo "  | ", implode(" | ", array_map("v", $row)), "\n";
}
ql($a, "SELECT CONNECTION_ID()");
ql($b, "SELECT CONNECTION_ID()");
ql($a, "CREATE TABLE m (id int NOT NULL auto_increment PRIMARY KEY, v char(5))");
ql($a, "INSERT INTO m (v) VALUES ('a1')");
ql($b, "INSERT INTO m (v) VALUES ('b1'), ('b2')");
ql($a, "SELECT LAST_INSERT_ID(), @@IDENTITY");
ql($b, "SELECT LAST_INSERT_ID()");
echo "insert ids: ", mysql_insert_id($a), " ", mysql_insert_id($b), " default link: ", mysql_insert_id(), "\n";
ql($a, "SET @x = 'from a'");
ql($b, "SELECT @x");
ql($a, "SELECT @x");
ql($a, "CREATE TEMPORARY TABLE tmp (n int)");
ql($a, "INSERT INTO tmp VALUES (1)");
ql($b, "SELECT * FROM tmp");
ql($b, "CREATE TEMPORARY TABLE tmp (n int, w int)");
ql($b, "INSERT INTO tmp VALUES (2, 3)");
ql($a, "SELECT * FROM tmp");
ql($b, "SELECT * FROM tmp");
ql($a, "SHOW TABLES");
ql($a, "SELECT GET_LOCK('lk', 0)");
ql($b, "SELECT GET_LOCK('lk', 0), IS_FREE_LOCK('lk')");
ql($b, "SELECT RELEASE_LOCK('lk')");
ql($a, "SELECT RELEASE_LOCK('lk')");
ql($b, "SELECT GET_LOCK('lk', 0)");
ql($a, "SELECT IS_FREE_LOCK('lk'), GET_LOCK('other', 0)");
ql($b, "SELECT GET_LOCK('lk2', 0)");
ql($b, "SELECT IS_FREE_LOCK('lk')");
ql($a, "LOCK TABLES m READ");
ql($b, "SELECT COUNT(*) FROM m");
ql($a, "SELECT COUNT(*) FROM m");
ql($a, "UNLOCK TABLES");
ql($a, "USE mysql");
ql($b, "SELECT DATABASE()");
ql($a, "SELECT DATABASE()");
$r = mysql_query("SHOW PROCESSLIST", $a);
while ($p = mysql_fetch_assoc($r)) echo "  process ", $p['Id'], " ", $p['User'], " ", $p['Host'], " ", v($p['db']), " ", $p['Command'], " ", v($p['State']), " ", v($p['Info']), "\n";
ql($a, "KILL 999");
ql($a, "KILL " . 2);
ql($b, "SELECT 1");
ql($b, "SELECT CONNECTION_ID(), DATABASE()");
mysql_close($b);
ql($a, "SELECT 'still here'");
echo "query on closed link: "; var_dump(@mysql_query("SELECT 1", $b));
mysql_close();
echo "default after close: "; var_dump(@mysql_query("SELECT 1"));
