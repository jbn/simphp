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
// GROUP BY / HAVING / ORDER BY / DISTINCT / LIMIT semantics
q("CREATE TABLE o (id int NOT NULL auto_increment PRIMARY KEY, cust varchar(10), item varchar(10), qty int, price decimal(6,2), day date)");
q("INSERT INTO o (cust, item, qty, price, day) VALUES ('bob', 'apple', 3, 0.50, '2001-12-01'), ('amy', 'pear', 1, 0.75, '2001-12-02'), ('bob', 'pear', 2, 0.75, '2001-12-02'), ('Bob', 'fig', 5, 1.20, '2001-12-03'), ('cat', NULL, NULL, NULL, NULL), ('amy', 'apple', 10, 0.45, '2001-12-03'), ('dan', 'apple', 1, 0.50, '2001-12-01')");
q("SELECT cust, COUNT(*), SUM(qty), MIN(price), MAX(price), AVG(qty) FROM o GROUP BY cust", 0);
q("SELECT cust, item, qty FROM o GROUP BY cust", 0);
q("SELECT cust, COUNT(*) AS n FROM o GROUP BY cust HAVING n > 1", 0);
q("SELECT cust, SUM(qty*price) AS total FROM o GROUP BY cust HAVING total > 1 ORDER BY total DESC", 0);
q("SELECT cust, COUNT(*) FROM o GROUP BY cust DESC", 0);
q("SELECT cust AS c, COUNT(*) FROM o GROUP BY c ORDER BY 2 DESC, 1", 0);
q("SELECT item, COUNT(*) FROM o GROUP BY item", 0);
q("SELECT day, COUNT(DISTINCT cust), COUNT(item), COUNT(*) FROM o GROUP BY day", 0);
q("SELECT COUNT(DISTINCT cust), COUNT(DISTINCT item), COUNT(DISTINCT cust, item), COUNT(DISTINCT day) FROM o");
q("SELECT COUNT(*), SUM(qty), AVG(price), MIN(day), MAX(cust) FROM o WHERE id > 100");
q("SELECT cust, SUM(qty) FROM o WHERE id > 100 GROUP BY cust", 0);
q("SELECT DISTINCT cust FROM o", 0);
q("SELECT DISTINCT cust, item FROM o ORDER BY cust, item", 0);
q("SELECT id, qty FROM o ORDER BY qty", 0);
q("SELECT id, qty FROM o ORDER BY qty DESC", 0);
q("SELECT id, item FROM o ORDER BY item, id", 0);
q("SELECT id FROM o ORDER BY id LIMIT 2", 0);
q("SELECT id FROM o ORDER BY id LIMIT 2, 3", 0);
q("SELECT id FROM o ORDER BY id LIMIT 5, 10", 0);
q("SELECT id FROM o ORDER BY id LIMIT 10, 2", 0);
q("SELECT id FROM o ORDER BY id LIMIT 0", 0);
q("SELECT id FROM o ORDER BY id DESC LIMIT 1", 0);
q("SELECT id, cust FROM o ORDER BY cust DESC, id", 0);
q("SELECT id, price * qty AS t FROM o ORDER BY t DESC, id", 0);
q("SELECT id FROM o ORDER BY RAND(1) LIMIT 0", 0);
q("SELECT cust, MAX(day) FROM o GROUP BY cust ORDER BY NULL", 0);
q("SELECT o.cust, o2.item FROM o, o AS o2 WHERE o.id = o2.id AND o.qty > 2 ORDER BY o.id", 0);
q("SELECT a.cust, COUNT(b.id) FROM o a LEFT JOIN o b ON a.cust = b.cust AND b.qty > 2 GROUP BY a.cust", 0);
q("SELECT a.id, b.id FROM o a LEFT JOIN o b ON b.id = a.id + 5 ORDER BY a.id", 0);
q("SELECT o.id, x.id FROM o INNER JOIN o x USING (id) WHERE o.id < 3", 0);
q("SELECT SUM(qty) / COUNT(*), SUM(price), BIT_OR(qty), BIT_AND(qty), STD(qty), STDDEV(qty) FROM o");
q("SELECT SUM(DISTINCT qty) FROM o");
q("SELECT MAX(id) FROM o");
q("SELECT id FROM o WHERE qty = (3)", 0);
q("SELECT cust, GROUP_CONCAT(item) FROM o GROUP BY cust", 0);
q("SELECT id FROM o HAVING id > 5", 0);
q("SELECT qty, COUNT(*) FROM o GROUP BY qty WITH ROLLUP", 0);
