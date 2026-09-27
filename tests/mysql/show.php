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
// SHOW variants: layout, field metadata and deterministic values
q("CREATE TABLE sh (
  id int(11) NOT NULL auto_increment,
  name varchar(40) NOT NULL default 'anon',
  email varchar(100) default NULL,
  age tinyint(3) unsigned default '18',
  score float(5,2) NOT NULL default '0.00',
  bal decimal(10,2) default NULL,
  kind enum('a','b') NOT NULL default 'b',
  flags set('x','y') default NULL,
  body text,
  created datetime NOT NULL default '0000-00-00 00:00:00',
  ts timestamp(14) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  KEY name_age (name, age),
  KEY created (created)
) TYPE=MyISAM COMMENT='people'");
q("SHOW CREATE TABLE sh");
q("CREATE TABLE sh2 (a int, b char(3) binary NOT NULL, c int unsigned zerofill, d double(8,3), e year, f time, g date default '2001-01-01', h int NOT NULL default '-5', INDEX (a), UNIQUE (b))");
q("SHOW CREATE TABLE sh2");
q("SHOW CREATE TABLE nosuch");
q("DESCRIBE sh");
q("DESCRIBE sh name");
q("DESCRIBE sh 'e%'");
q("SHOW COLUMNS FROM sh");
q("SHOW FIELDS FROM sh LIKE '%a%'");
q("SHOW COLUMNS FROM sh FROM test");
q("SHOW COLUMNS FROM sh2");
q("SHOW FULL COLUMNS FROM sh2");
q("SHOW INDEX FROM sh");
q("SHOW KEYS FROM sh2");
q("SHOW INDEX FROM nosuch");
q("SHOW TABLES");
q("SHOW TABLES LIKE 'sh%'");
q("SHOW TABLES FROM mysql");
q("SHOW DATABASES");
q("SHOW DATABASES LIKE 't%'");
$r = mysql_query("SHOW TABLE STATUS");
echo "SHOW TABLE STATUS: ", mysql_num_rows($r), " rows\n";
for ($i = 0; $i < mysql_num_fields($r); $i++) echo "  ", mysql_field_name($r, $i), " ", mysql_field_type($r, $i), " ", mysql_field_len($r, $i), " ", mysql_field_flags($r, $i), "\n";
while ($row = mysql_fetch_assoc($r)) echo "  ", $row['Name'], " ", $row['Type'], " ", $row['Row_format'], " rows=", $row['Rows'], " auto=", v($row['Auto_increment']), " comment=", v($row['Comment']), " options=", v($row['Create_options']), "\n";
$r = mysql_query("SHOW VARIABLES");
echo "SHOW VARIABLES: fields ", mysql_num_fields($r), " ", mysql_field_name($r, 0), " ", mysql_field_len($r, 0), " ", mysql_field_type($r, 0), " ", mysql_field_name($r, 1), " ", mysql_field_len($r, 1), "\n";
$want = array('character_set', 'have_bdb', 'have_innodb', 'have_isam', 'have_raid', 'have_symlink', 'have_openssl', 'lower_case_table_names', 'max_allowed_packet', 'max_connections', 'protocol_version', 'table_type', 'version', 'wait_timeout', 'key_buffer_size', 'sort_buffer', 'ft_min_word_len', 'log', 'log_bin', 'language', 'concurrent_insert', 'delay_key_write', 'net_buffer_length', 'query_buffer_size', 'timezone');
$names = array();
while ($row = mysql_fetch_row($r)) { $names[] = $row[0]; if (in_array($row[0], $want)) echo "  ", $row[0], " = ", $row[1], "\n"; }
echo "  (", count($names), " variables) ", implode(",", $names), "\n";
q("SHOW VARIABLES LIKE 'have%'");
$r = mysql_query("SHOW STATUS");
echo "SHOW STATUS: fields ", mysql_num_fields($r), " ", mysql_field_name($r, 0), " ", mysql_field_name($r, 1), "\n";
$names = array(); while ($row = mysql_fetch_row($r)) $names[] = $row[0];
echo "  (", count($names), " variables) ", implode(",", $names), "\n";
$r = mysql_query("SHOW STATUS LIKE 'Com_select'"); $row = mysql_fetch_row($r); echo "  ", $row[0], " numeric=", is_numeric($row[1]) ? 1 : 0, "\n";
$r = mysql_query("SHOW PROCESSLIST");
echo "SHOW PROCESSLIST: ", mysql_num_rows($r), " rows\n";
for ($i = 0; $i < mysql_num_fields($r); $i++) echo "  ", mysql_field_name($r, $i), " ", mysql_field_type($r, $i), " ", mysql_field_flags($r, $i), "\n";
while ($row = mysql_fetch_assoc($r)) echo "  ", $row['User'], " ", $row['Host'], " ", v($row['db']), " ", $row['Command'], " ", v($row['State']), " ", v($row['Info']), "\n";
q("SHOW GRANTS FOR root@localhost");
q("SHOW NOSUCH");
q("SHOW TABLES FROM nosuchdb");
q("EXPLAIN sh");
q("SHOW CREATE TABLE mysql.db");
q("SHOW INDEX FROM db FROM mysql");
q("SHOW COLUMNS FROM mysql.user");
