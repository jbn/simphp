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
// mysql_field_* metadata for column types, expressions and aliases
q("CREATE TABLE t (
  id int(10) unsigned NOT NULL auto_increment,
  ti tinyint(4) NOT NULL default '0', si smallint(5) unsigned, mi mediumint, bi bigint(20) NOT NULL default '0',
  zf int(6) unsigned zerofill, fl float, fl2 float(7,2), db double NOT NULL default '0', dbl double(10,3),
  de decimal(8,2) NOT NULL default '0.00', de0 decimal(5), nu numeric(6,1),
  c char(10) NOT NULL default '', cb char(10) binary, vc varchar(64), vcb varchar(20) binary NOT NULL default '',
  tt tinytext, tx text NOT NULL, mt mediumtext, lt longtext, tb tinyblob, bl blob, mb mediumblob, lb longblob,
  d date, dt datetime NOT NULL default '0000-00-00 00:00:00', tm time, yr year, yr2 year(2),
  ts timestamp(14), ts8 timestamp(8), ts6 timestamp(6),
  e enum('small','medium','large') NOT NULL default 'small', s set('a','b','c'),
  u int unique, k varchar(10),
  PRIMARY KEY (id), KEY k (k), KEY multi (c, vc)
)");
q("INSERT INTO t (ti, c, vc, tx, e, s, de, fl, db, ts) VALUES (1, 'abc', 'hello', 'text', 'large', 'a,c', 12.5, 1.5, 2.25, 20011226143005)");
q("SELECT * FROM t");
q("SELECT id AS ident, c AS col, t.vc, t.tx AS x FROM t");
q("SELECT x.id, x.c, y.id FROM t AS x, t y WHERE x.id = y.id");
q("SELECT x.* FROM t x");
q("SELECT 1, 1.5, -3, 'str', NULL, 1+1, 2*3.5, 10/4, 7 % 3, 1=1, 'a'='A', CONCAT('a','b'), NOW() IS NOT NULL");
q("SELECT 7 DIV 2");
q("SELECT COUNT(*), COUNT(id), SUM(ti), AVG(ti), MIN(c), MAX(de), SUM(de), MIN(d), MAX(dt), STD(ti) FROM t");
q("SELECT id+0, c+0, CONCAT(id), LENGTH(c), UPPER(c), de*2, fl*2, ti+de, IFNULL(vc,'x'), IF(ti,c,vc), CASE WHEN ti THEN 1 ELSE 0 END FROM t");
q("SELECT DATE_FORMAT(dt,'%Y'), YEAR(dt), TO_DAYS(dt), dt+0, d, ts+0 > 0, e+0, s+0, FIELD(e,'large') FROM t");
q("SELECT LEFT(tx,2), SUBSTRING(vc,2), REPLACE(c,'a','b'), LPAD(id,5,'0'), TRIM(c), FORMAT(de,1), ROUND(de), ROUND(fl,1), FLOOR(de), ABS(-de) FROM t");
q("SELECT DISTINCT c FROM t");
q("SELECT c, COUNT(*) AS n FROM t GROUP BY c");
$r = mysql_query("SELECT id, c FROM t");
$f = mysql_fetch_field($r); print_r($f);
$f = mysql_fetch_field($r, 1); print_r($f);
$r = mysql_list_fields("test", "t");
echo mysql_num_fields($r), " fields via mysql_list_fields\n";
for ($i = 0; $i < mysql_num_fields($r); $i++) echo "  ", mysql_field_name($r, $i), " ", mysql_field_table($r, $i), " ", mysql_field_type($r, $i), " ", mysql_field_len($r, $i), " ", mysql_field_flags($r, $i), "\n";
$r = mysql_list_fields("test", "nosuch"); var_dump($r); echo mysql_errno(), ": ", mysql_error(), "\n";
