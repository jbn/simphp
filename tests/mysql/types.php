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
// storing values: truncation, clipping, defaults, ENUM/SET, DECIMAL/FLOAT formatting
q("CREATE TABLE n (ti tinyint, tu tinyint unsigned, si smallint, i int, iu int unsigned, bi bigint, m mediumint unsigned)");
q("INSERT INTO n VALUES (127, 255, 32767, 2147483647, 4294967295, 9223372036854775807, 16777215)");
q("INSERT INTO n VALUES (128, 256, 32768, 2147483648, 4294967296, 9223372036854775808, 16777216)");
q("INSERT INTO n VALUES (-129, -1, -32769, -2147483649, -5, -9223372036854775809, -1)");
q("INSERT INTO n VALUES ('12abc', 'x', '3.7', '-2.5', '1e3', ' 42 ', '')");
q("INSERT INTO n VALUES (1.5, 2.5, -1.5, 0.49, 3.5, -2.5, 0.5)");
q("SELECT * FROM n", 0);
q("CREATE TABLE s (c char(5), v varchar(5), cb char(5) binary, t tinytext, b tinyblob)");
q("INSERT INTO s VALUES ('abcdefg', 'abcdefg', 'abcdefg', 'x', 'y')");
q("INSERT INTO s VALUES ('ab  ', 'ab  ', 'ab  ', 'ab  ', 'ab  ')");
q("INSERT INTO s VALUES (12345678, 3.14159, -1, 1e20, 0.1)");
q("SELECT c, v, cb, t, b, LENGTH(c), LENGTH(v), LENGTH(t), CONCAT('[', c, ']'), CONCAT('[', v, ']') FROM s", 0);
q("CREATE TABLE d (a int NOT NULL, b int, c varchar(10) NOT NULL, dd varchar(10), e date NOT NULL, f datetime, g decimal(6,2) NOT NULL, h enum('x','y') NOT NULL, i enum('p','q'), j set('m','n') NOT NULL, k float NOT NULL, l time NOT NULL, m year NOT NULL, ts timestamp)");
q("DESCRIBE d");
q("INSERT INTO d (a) VALUES (1)");
q("INSERT INTO d () VALUES ()");
q("INSERT INTO d (a, c) VALUES (NULL, 'x')");
q("INSERT INTO d (a, b, c) VALUES (2, NULL, NULL)");
q("INSERT INTO d (a, c) VALUES (3, 'a'), (NULL, NULL), (4, 'b')");
q("SELECT a, b, c, dd, e, f, g, h, i, j, k, l, m, ts IS NULL FROM d", 0);
q("CREATE TABLE es (e enum('a','b','Cc') NOT NULL, en enum('x','y'), s set('one','two','three'), sn set('A','B') NOT NULL)");
q("INSERT INTO es VALUES ('b', 'y', 'two,one', 'b')");
q("INSERT INTO es VALUES ('cc', 'z', 'three,four,one', 'a,b,a')");
q("INSERT INTO es VALUES (2, 1, 5, 3)");
q("INSERT INTO es VALUES (0, 0, 0, 0)");
q("INSERT INTO es VALUES ('', '', '', '')");
q("INSERT INTO es VALUES (7, 9, 99, 9)");
q("SELECT e, e+0, en, en+0, s, s+0, sn, sn+0 FROM es", 0);
q("SELECT e FROM es WHERE e = 'B'", 0);
q("SELECT s FROM es WHERE FIND_IN_SET('one', s) ORDER BY s", 0);
q("SELECT e FROM es ORDER BY e", 0);
q("CREATE TABLE f (d1 decimal(5,2), d2 decimal(4,0), d3 decimal(6,3) unsigned, f1 float, f2 float(6,2), db double, db2 double(8,4), r real)");
q("INSERT INTO f VALUES (123.456, 12345, -1.5, 1.23456789, 1234.5678, 1.23456789012345678, 3.14159265, 1e30)");
q("INSERT INTO f VALUES (999.999, -99999, 12345.678, 0.1, 0.005, 1e-10, -0.00005, 100)");
q("INSERT INTO f VALUES ('1.005', '2.5', '3.0005', '1e5', '-0', '123456789012', 1/3, 2/3)");
q("INSERT INTO f VALUES (-999.99, 0, 0, 3.4e38, 1e6, -1.5e300, 99999.99999, 0.1+0.2)");
q("SELECT * FROM f", 0);
q("SELECT d1+0, d1*1.0, f1+0, f1*2, db/3, r+1, SUM(d1), AVG(d1), SUM(f1), MAX(db) FROM f GROUP BY d2 ORDER BY d2", 0);
q("SELECT 1/3, 2/3, 10/5, 1e10, 1.0, 0.1+0.2, 3.14159*2, 1e-5, 123456789*1000, 2147483647+1, -2147483648-1, 18446744073709551615, 1.5e300*1e10", 0);
q("SELECT ROUND(2.5), ROUND(3.5), ROUND(-2.5), ROUND(1.2345,2), ROUND(1.2355,3), TRUNCATE(1.999,1), FLOOR(-1.5), CEILING(-1.5), -5 % 3, MOD(5.5,2), MOD(-7,3), 7.5 % 2", 0);
q("SELECT 5 MOD 3");
q("SELECT FORMAT(1234567.891, 2), FORMAT(0.5, 0), FORMAT(-1234.5, 1), FORMAT(1234, 0)", 0);
