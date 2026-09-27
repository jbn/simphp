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
// SELECT ... INTO OUTFILE / DUMPFILE, LOAD DATA [LOCAL] INFILE, LOAD_FILE()
@unlink("/tmp/out1.txt"); @unlink("/tmp/out2.txt"); @unlink("/tmp/out3.txt"); @unlink("/tmp/dump.bin");
q("CREATE TABLE fx (id int NOT NULL auto_increment PRIMARY KEY, name varchar(20), note text, price decimal(6,2), d date, ts timestamp(14))");
q("INSERT INTO fx (name, note, price, d, ts) VALUES ('plain', 'a b', 1.5, '2001-12-26', 20011226120000), ('tab\\there', 'line\\nbreak', NULL, NULL, 20011226120000), ('quote\"s', 'back\\\\slash', -3, '1999-01-02', 20011226120000), (NULL, '', 0, '0000-00-00', 20011226120000), ('comma,x', 'nul\\0byte', 99.99, '2001-01-01', 20011226120000)");
function show_file($f) { $s = @implode('', file($f)); echo "  file $f: ", strlen($s), " bytes\n"; foreach (explode("\n", $s) as $l) echo "  : ", str_replace(array("\t", "\0", "\r"), array('<TAB>', '<NUL>', '<CR>'), $l), "\n"; }
q("SELECT * FROM fx INTO OUTFILE '/tmp/out1.txt'");
show_file("/tmp/out1.txt");
q("SELECT * FROM fx INTO OUTFILE '/tmp/out1.txt'");
q("SELECT id, name, price INTO OUTFILE '/tmp/out2.txt' FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '\"' LINES TERMINATED BY '\\r\\n' FROM fx WHERE id < 5");
show_file("/tmp/out2.txt");
q("SELECT name, price, d FROM fx ORDER BY id DESC INTO OUTFILE '/tmp/out3.txt' FIELDS TERMINATED BY '' ENCLOSED BY '' ESCAPED BY '' LINES STARTING BY '>' TERMINATED BY '|'");
show_file("/tmp/out3.txt");
q("SELECT note FROM fx WHERE id = 3 INTO DUMPFILE '/tmp/dump.bin'");
show_file("/tmp/dump.bin");
q("SELECT note FROM fx INTO DUMPFILE '/tmp/dump2.bin'");
q("SELECT 1 INTO OUTFILE '/nosuchdir/x.txt'");
q("SELECT LOAD_FILE('/tmp/dump.bin'), LOAD_FILE('/tmp/nosuch'), LENGTH(LOAD_FILE('/tmp/out1.txt'))");
// LOAD DATA from the server's files
q("CREATE TABLE ld (id int NOT NULL auto_increment PRIMARY KEY, name varchar(10), n int NOT NULL, d date, t timestamp(14))");
q("LOAD DATA INFILE '/tmp/out2.txt' INTO TABLE ld FIELDS TERMINATED BY ',' ENCLOSED BY '\"' LINES TERMINATED BY '\\r\\n' (id, name, n)");
q("SELECT id, name, n, d, t IS NOT NULL FROM ld", 0);
$fp = fopen("/tmp/in1.txt", "w");
fwrite($fp, "1\tone\t10\t2001-12-01\n2\ttwo\t\\N\t\\N\n3\t\"three\"\t30\n\t\t\t\n5\tfive is too long\t5x\t2001-13-45\textra\n2\tdup\t22\t2001-01-01\n6\tesc\\ttab\\nnl\t6\t2001-06-06\n");
fclose($fp);
chmod("/tmp/in1.txt", 0644);
q("DELETE FROM ld");
q("LOAD DATA INFILE '/tmp/in1.txt' INTO TABLE ld (id, name, n, d)");
q("SELECT id, name, n, d FROM ld", 0);
q("LOAD DATA INFILE '/tmp/in1.txt' REPLACE INTO TABLE ld (id, name, n, d)");
q("LOAD DATA INFILE '/tmp/in1.txt' IGNORE INTO TABLE ld IGNORE 2 LINES (id, name, n, d)");
q("SELECT id, name, n, d FROM ld", 0);
q("LOAD DATA INFILE '/tmp/nosuch.txt' INTO TABLE ld");
q("LOAD DATA INFILE 'nosuch.txt' INTO TABLE ld");
q("LOAD DATA INFILE '/tmp/in1.txt' INTO TABLE nosuch");
q("LOAD DATA INFILE '/tmp/in1.txt' INTO TABLE ld FIELDS ESCAPED BY 'ab'");
chmod("/tmp/in1.txt", 0600);
q("LOAD DATA INFILE '/tmp/in1.txt' INTO TABLE ld");
// fixed-width rows (no field terminator, no enclosing)
$fp = fopen("/tmp/in2.txt", "w"); fwrite($fp, "0000000007abc       00000000042001-02-03\n0000000008xy\n"); fclose($fp); chmod("/tmp/in2.txt", 0644);
q("CREATE TABLE fw (id int, name char(10), n int(11), d date)");
q("LOAD DATA INFILE '/tmp/in2.txt' INTO TABLE fw FIELDS TERMINATED BY '' ENCLOSED BY ''");
q("SELECT * FROM fw", 0);
// the client sends the file
$fp = fopen("/tmp/local.csv", "w"); fwrite($fp, "\"id\",\"name\"\n10,\"ten, with comma\"\n11,\"say \"\"hi\"\"\"\n12,NULL\n12,\"dup\"\n"); fclose($fp);
q("LOAD DATA LOCAL INFILE '/tmp/local.csv' INTO TABLE ld FIELDS TERMINATED BY ',' ENCLOSED BY '\"' IGNORE 1 LINES (id, name)");
q("SELECT id, name, n FROM ld WHERE id >= 10", 0);
q("LOAD DATA LOCAL INFILE '/tmp/nosuch.csv' INTO TABLE ld");
// a file in the database directory
q("SELECT id, name INTO OUTFILE 'rel.txt' FROM ld WHERE id < 3");
q("CREATE TABLE ld2 (id int, name varchar(10))");
q("LOAD DATA INFILE 'rel.txt' INTO TABLE ld2");
q("SELECT * FROM ld2", 0);
q("SELECT id INTO OUTFILE 'rel.txt' FROM ld");
