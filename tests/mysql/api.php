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
// the rest of PHP 4.1.1's mysql API against the server
// (PHP 4.1.1 has no var_export())
function ve($x) { if (is_bool($x)) return $x ? 'true' : 'false'; if (is_null($x)) return 'NULL'; if (is_string($x)) return "'$x'"; if (is_resource($x)) return 'resource'; return (string) $x; }
q("CREATE TABLE api (id int NOT NULL auto_increment PRIMARY KEY, name varchar(10) NOT NULL default 'x', score float(5,2), note text, flag enum('y','n') NOT NULL default 'n', UNIQUE KEY name (name))");
q("INSERT INTO api (name, score, note) VALUES ('one', 1.5, 'first'), ('two', NULL, NULL), ('three', 3.25, 'third row')");
$p = mysql_pconnect("localhost", "root", "");
echo "pconnect: ", ($p ? 'ok' : 'failed'), " select_db: ", ve(mysql_select_db("test", $p)), "\n";
echo "server: ", mysql_get_server_info(), " proto: ", mysql_get_proto_info(), " host: ", mysql_get_host_info(), "\n";
$r = mysql_query("SELECT id, name, score, note, flag FROM api ORDER BY id");
for ($i = 0; $i < 5; $i++) {
  mysql_field_seek($r, $i);
  $f = mysql_fetch_field($r);
  echo "  field $i: ";
  foreach (array('name', 'table', 'max_length', 'not_null', 'primary_key', 'multiple_key', 'unique_key', 'numeric', 'blob', 'type', 'unsigned', 'zerofill') as $k) echo "$k=", ve($f->$k), " ";
  echo "\n";
}
mysql_field_seek($r, 2);
$f = mysql_fetch_field($r); echo "  after seek 2: ", $f->name, "\n";
$f = mysql_fetch_field($r); echo "  next: ", $f->name, "\n";
echo "  result(1, 'name'): ", mysql_result($r, 1, 'name'), "\n";
echo "  result(2, 'api.score'): ", mysql_result($r, 2, 'api.score'), "\n";
echo "  result(0, 3): ", mysql_result($r, 0, 3), "\n";
echo "  result(9, 0): "; var_dump(@mysql_result($r, 9, 0));
mysql_data_seek($r, 0);
$row = mysql_fetch_row($r); $len = mysql_fetch_lengths($r);
echo "  lengths: ", implode(",", $len), "\n";
$row = mysql_fetch_array($r); echo "  array keys: ", implode(",", array_keys($row)), "\n";
$row = mysql_fetch_array($r, MYSQL_NUM); echo "  num: ", implode("|", array_map("v", $row)), "\n";
var_dump(mysql_fetch_array($r));
$r = mysql_db_query("mysql", "SELECT COUNT(*) FROM user");
echo "db_query: ", mysql_result($r, 0), " now in: ", mysql_result(mysql_query("SELECT DATABASE()"), 0), "\n";
mysql_select_db("test");
$r = mysql_list_tables("test"); echo "tables:"; for ($i = 0; $i < mysql_num_rows($r); $i++) echo " ", mysql_tablename($r, $i); echo "\n";
$r = @mysql_list_tables("nosuchdb"); echo "list_tables nosuchdb: ", ve($r), " ", mysql_errno(), " ", mysql_error(), "\n";
$r = mysql_list_fields("test", "api");
echo "list_fields: ", mysql_num_fields($r), " fields, rows=", mysql_num_rows($r), "\n";
for ($i = 0; $i < mysql_num_fields($r); $i++) echo "  ", mysql_field_name($r, $i), " ", mysql_field_type($r, $i), " ", mysql_field_len($r, $i), " ", mysql_field_flags($r, $i), " table=", mysql_field_table($r, $i), "\n";
$r = @mysql_list_fields("test", "nosuch"); echo "list_fields nosuch: ", ve($r), " ", mysql_errno(), " ", mysql_error(), "\n";
$r = mysql_list_dbs(); echo "dbs: ", mysql_num_rows($r), " first=", mysql_tablename($r, 0), "\n";
echo "create_db: ", ve(mysql_create_db("apidb")), " again: ", ve(@mysql_create_db("apidb")), " ", mysql_errno(), " ", mysql_error(), "\n";
echo "drop_db: ", ve(mysql_drop_db("apidb")), " again: ", ve(@mysql_drop_db("apidb")), " ", mysql_errno(), " ", mysql_error(), "\n";
$u = mysql_unbuffered_query("SELECT id, name FROM api ORDER BY id");
$row = mysql_fetch_row($u); echo "unbuffered first: ", implode(",", $row), "\n";
$r = @mysql_query("SELECT 1"); echo "query during unbuffered: ", ve($r), " ", mysql_errno(), " ", mysql_error(), "\n";
while ($row = mysql_fetch_row($u)) echo "unbuffered: ", implode(",", $row), "\n";
echo "num_rows unbuffered: ", mysql_num_rows($u), "\n";
$r = mysql_query("SELECT 1"); echo "after: ", mysql_result($r, 0), "\n";
echo "escape: ", mysql_escape_string("a'b\"c\\d\0e\n\r\x1a"), "\n";
$r = mysql_query("SELECT '" . mysql_escape_string("It's \"quoted\"\n") . "' AS s");
echo "roundtrip: ", str_replace("\n", '\n', mysql_result($r, 0)), "\n";
$r = mysql_query("SELECT * FROM api WHERE 1 = 0"); echo "empty: rows=", mysql_num_rows($r), " fetch="; var_dump(mysql_fetch_row($r));
$r = mysql_query("UPDATE api SET score = score + 1"); echo "update result: ", ve($r), " affected=", mysql_affected_rows(), "\n";
echo "free twice: "; var_dump(mysql_free_result($r = mysql_query("SELECT 1"))); var_dump(@mysql_free_result($r));
echo "errno ok: ", mysql_errno(), " '", mysql_error(), "'\n";
mysql_query("SELECT nosuchcol FROM api"); echo "errno bad: ", mysql_errno(), " '", mysql_error(), "'\n";
mysql_query("SELECT 1"); echo "errno reset: ", mysql_errno(), "\n";
$bad = @mysql_connect("localhost:/tmp/nosuch.sock", "root", ""); echo "bad socket: ", ve($bad), " ", mysql_errno(), " ", mysql_error(), "\n";
