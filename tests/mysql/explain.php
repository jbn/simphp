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
// EXPLAIN SELECT and the optimizations it shows (opt_sum_query, const
// tables, ref/eq_ref/range/index access, filesort, temporary tables)
function x($sql) { q("EXPLAIN $sql"); }
q("CREATE TABLE u (id int NOT NULL auto_increment PRIMARY KEY, name varchar(20) NOT NULL, age int, city char(10), score int NOT NULL, KEY age (age), KEY city_score (city, score), UNIQUE KEY name (name))");
q("CREATE TABLE o (oid int NOT NULL auto_increment PRIMARY KEY, uid int NOT NULL, amount decimal(8,2), note text, KEY uid (uid))");
q("CREATE TABLE one (x int)");
q("INSERT INTO one VALUES (1)");
q("CREATE TABLE empty (x int)");
$names = array('ann', 'bob', 'cat', 'dan', 'eve', 'fay', 'gus', 'hal', 'ivy', 'jon', 'kim', 'lee');
foreach ($names as $i => $n) mysql_query("INSERT INTO u (name, age, city, score) VALUES ('$n', " . ($i % 4 == 0 ? 'NULL' : 20 + $i % 5) . ", '" . ($i % 3 ? 'paris' : 'rome') . "', " . ($i * 7 % 10) . ")");
for ($i = 1; $i <= 30; $i++) mysql_query("INSERT INTO o (uid, amount, note) VALUES (" . ($i % 12 + 1) . ", " . ($i * 1.5) . ", 'n$i')");
x("SELECT * FROM u");
x("SELECT * FROM u WHERE id = 3");
x("SELECT * FROM u WHERE id = 99");
x("SELECT * FROM u WHERE name = 'bob'");
x("SELECT name FROM u WHERE age = 21");
x("SELECT age FROM u WHERE age = 21");
x("SELECT * FROM u WHERE age > 22");
x("SELECT * FROM u WHERE age BETWEEN 21 AND 22");
x("SELECT * FROM u WHERE age IN (21, 23)");
x("SELECT * FROM u WHERE age IS NULL");
x("SELECT * FROM u WHERE city = 'rome' AND score > 3");
x("SELECT * FROM u WHERE city LIKE 'pa%'");
x("SELECT * FROM u WHERE city LIKE '%is'");
x("SELECT * FROM u WHERE name = 5");
x("SELECT * FROM u WHERE age = '21'");
x("SELECT * FROM u WHERE age = 21 OR age = 22");
x("SELECT * FROM u WHERE age = 21 OR score = 3");
x("SELECT id FROM u ORDER BY id DESC");
x("SELECT * FROM u ORDER BY name LIMIT 3");
x("SELECT * FROM u ORDER BY score");
x("SELECT city, COUNT(*) FROM u GROUP BY city");
x("SELECT age, COUNT(*) FROM u GROUP BY age");
x("SELECT score, COUNT(*) FROM u GROUP BY score ORDER BY 2");
x("SELECT DISTINCT city FROM u");
x("SELECT DISTINCT u.city FROM u, o WHERE o.uid = u.id");
x("SELECT u.name, o.amount FROM u, o WHERE o.uid = u.id");
x("SELECT u.name, o.amount FROM o, u WHERE o.uid = u.id AND u.age > 22");
x("SELECT u.name, o.amount FROM u LEFT JOIN o ON o.uid = u.id");
x("SELECT u.name FROM u LEFT JOIN o ON o.uid = u.id WHERE o.oid IS NULL");
x("SELECT * FROM u, one WHERE u.id = one.x");
x("SELECT * FROM u, empty");
x("SELECT * FROM u, o");
x("SELECT * FROM u WHERE 1 = 0");
x("SELECT 1 + 1");
x("SELECT COUNT(*) FROM u");
x("SELECT COUNT(*) FROM u WHERE age > 1");
x("SELECT MIN(age), MAX(age) FROM u");
x("SELECT MIN(score) FROM u WHERE city = 'rome'");
x("SELECT MAX(id) FROM u WHERE id < 0");
x("SELECT COUNT(*), SUM(score) FROM u");
x("SELECT * FROM u WHERE id = 3 AND name = 'nobody'");
x("SELECT * FROM u STRAIGHT_JOIN o WHERE o.uid = u.id");
x("SELECT * FROM o WHERE uid = 3 ORDER BY oid");
q("SELECT MIN(age), MAX(age), MIN(city), COUNT(*) FROM u", 0);
q("SELECT MIN(age), SUM(score) FROM u", 0);
q("SELECT MIN(score) FROM u WHERE city = 'rome'", 0);
q("SELECT MAX(score) FROM u WHERE city = 'nowhere'", 0);
q("SELECT MIN(id), MAX(id) FROM u WHERE id < 0", 0);
q("EXPLAIN SELECT * FROM nosuch");
q("DESCRIBE SELECT name FROM u WHERE id = 1");
