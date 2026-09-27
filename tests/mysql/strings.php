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
// string functions, case and trailing-space rules, LIKE escaping, REGEXP
q("SELECT CONCAT('a', NULL), CONCAT_WS('-', 'a', NULL, 'b'), CONCAT(1, 2.50, 'x'), LENGTH('héllo'), CHAR_LENGTH('abc'), LOCATE('b', 'abcb'), LOCATE('b', 'abcb', 3), INSTR('foobar', 'bar'), POSITION('B' IN 'abc')", 0);
q("SELECT LEFT('abc', 5), RIGHT('abc', 2), MID('abcdef', 2, 3), SUBSTRING('abcdef', 3), SUBSTRING('abcdef' FROM 2 FOR 2), SUBSTRING('abcdef', -2), SUBSTRING_INDEX('a.b.c', '.', 2), SUBSTRING_INDEX('a.b.c', '.', -2)", 0);
q("SELECT LTRIM('  a  '), RTRIM('  a  '), TRIM('  a  '), TRIM(LEADING 'x' FROM 'xxaxx'), TRIM(BOTH 'xy' FROM 'xyaxy'), TRIM(TRAILING FROM 'a  ')", 0);
q("SELECT LPAD('hi', 5, 'ab'), RPAD('hi', 5, 'ab'), LPAD('hello', 3, 'x'), REPEAT('ab', 3), SPACE(3), REVERSE('abc'), INSERT('abcdef', 2, 3, 'X'), REPLACE('aAbB', 'a', 'x'), ELT(2, 'a', 'b'), FIELD('b', 'a', 'B')", 0);
q("SELECT UPPER('äbc'), LOWER('ÄBC'), UCASE('x'), LCASE('X'), ASCII('A'), ASCII(''), ORD('a'), CHAR(65, 66, 67), HEX(255), HEX('ab'), BIN(10), OCT(8), CONV('ff', 16, 10), CONV(10, 10, 2)", 0);
q("SELECT SOUNDEX('Robert'), SOUNDEX('Tymczak'), MD5('abc'), PASSWORD('abc'), PASSWORD(''), LENGTH(ENCODE('x','y')), DECODE(ENCODE('secret','key'),'key'), LENGTH(ENCRYPT('x','ab'))", 0);
q("SELECT DES_ENCRYPT('x')");
q("SELECT 'abc' = 'ABC', 'abc' = 'abc  ', 'abc' LIKE 'ABC', BINARY 'abc' = 'ABC', 'a' < 'B', STRCMP('a', 'B'), STRCMP('b', 'a'), 'Ä' = 'ä', 'ab' < 'ab '", 0);
q("SELECT 'a_c' LIKE 'a\\\\_c', 'abc' LIKE 'a\\\\_c', 'a%c' LIKE 'a\\\\%c', 'abc' LIKE 'a|_c' ESCAPE '|', 'a_c' LIKE 'a|_c' ESCAPE '|', 'abc' LIKE '%', '' LIKE '%', NULL LIKE '%', 'abc' NOT LIKE 'a%'", 0);
q("SELECT 'abc' REGEXP '^a', 'ABC' REGEXP '^a', 'abc' REGEXP 'x|c$', 'a.c' REGEXP 'a[.]c', 'abc' RLIKE '[[:alpha:]]+', 'abc' REGEXP 'b{2}', 'foo' REGEXP '[[:<:]]foo[[:>:]]', 'Abc' REGEXP BINARY '^a'", 0);
q("SELECT 'a' REGEXP ''");
q("SELECT 'a' REGEXP '('");
q("CREATE TABLE p (id int NOT NULL auto_increment PRIMARY KEY, name varchar(20), code char(4) binary, note text, bl blob)");
q("INSERT INTO p (name, code, note, bl) VALUES ('Alice', 'ab', 'Hello World', 'Hello World'), ('bob', 'AB', 'hello world', 'hello world'), ('CHARLIE', 'Ab', 'x', 'x'), ('alice ', 'ab ', 'y ', 'y '), ('Zoë', 'zz', NULL, NULL), ('a_b', 'a%b', 'z', 'z')");
q("SELECT id FROM p WHERE name = 'ALICE'", 0);
q("SELECT id FROM p WHERE code = 'ab'", 0);
q("SELECT id FROM p WHERE note = 'HELLO WORLD'", 0);
q("SELECT id FROM p WHERE bl = 'HELLO WORLD'", 0);
q("SELECT id FROM p WHERE bl LIKE 'hello%'", 0);
q("SELECT id FROM p WHERE name LIKE 'a%'", 0);
q("SELECT id FROM p WHERE name LIKE 'a\\\\_%'", 0);
q("SELECT id FROM p WHERE code LIKE 'a%'", 0);
q("SELECT id FROM p WHERE name REGEXP '^[a-c]'", 0);
q("SELECT id FROM p WHERE BINARY name = 'alice'", 0);
q("SELECT id, CONCAT('[', name, ']'), CONCAT('[', code, ']'), LENGTH(code) FROM p ORDER BY id", 0);
q("SELECT name FROM p ORDER BY name", 0);
q("SELECT code FROM p ORDER BY code, id", 0);
q("SELECT name FROM p ORDER BY name DESC LIMIT 2", 0);
q("SELECT DISTINCT LOWER(name) AS n FROM p ORDER BY n", 0);
q("SELECT name, COUNT(*) FROM p GROUP BY name ORDER BY name", 0);
q("SELECT id FROM p WHERE name IN ('ALICE', 'Bob') ORDER BY id", 0);
q("SELECT id FROM p WHERE name BETWEEN 'b' AND 'd' ORDER BY id", 0);
q("SELECT MAX(name), MIN(name), MAX(code), MIN(code) FROM p", 0);
q("SELECT 1 + '1', '1e2' + 0, '0x10' + 0, 'abc' + 0, ' 12abc' * 2, '-' + 1, 1 = '1abc', 0 = 'abc', 'abc' = 0, NULL = NULL, NULL <=> NULL, 1 <=> NULL", 0);
q("SELECT 5 DIV 0");
q("SELECT 5 / 0, 5 % 0, LOG(0), SQRT(-1), 1/NULL, 0x41, 0x4142 + 0, 'a' || 'b', 1 && 0, !0, NOT 1, 3 XOR 1, 5 & 3, 5 | 3, 5 ^ 3, ~0, 1 << 3, 16 >> 2", 0);
q("SELECT IFNULL(NULL, 'x'), IFNULL(0, 'x'), NULLIF(1, 1), NULLIF(1, 2), IF(NULL, 'a', 'b'), IF('0', 'a', 'b'), IF('abc', 'a', 'b'), IF(0.1, 'a', 'b'), COALESCE(NULL, NULL, 3), ISNULL(1/0), INTERVAL(5, 1, 3, 7), GREATEST(1, '10', 2), LEAST('b', 'A', 'c')", 0);
q("SELECT CASE 1 WHEN 1 THEN 'one' ELSE 'other' END, CASE WHEN 1 > 2 THEN 'x' END, CASE 'a' WHEN 'A' THEN 'ci' ELSE 'cs' END, CASE 1 WHEN 1 THEN 2 ELSE 'x' END", 0);
