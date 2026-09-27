<?php
// db.table and db.table.column: statements on another database than the
// selected one (or with none selected), and reads across databases.
function q($sql) {
  $r = mysql_query($sql);
  echo $sql, "\n  => ";
  if (!$r) { echo 'ERROR ', mysql_errno(), ': ', mysql_error(), "\n"; return; }
  if ($r === true) { echo 'ok, affected ', mysql_affected_rows(), ', insert id ', mysql_insert_id(), "\n"; return; }
  $f = array();
  for ($i = 0; $i < mysql_num_fields($r); $i++) $f[] = mysql_field_name($r, $i) . ' ' . mysql_field_type($r, $i) . '(' . mysql_field_len($r, $i) . ')';
  echo implode(', ', $f), "\n";
  while ($row = mysql_fetch_row($r)) echo '     ', implode(' | ', array_map('var_export_short', $row)), "\n";
}
function var_export_short($v) { return $v === null ? 'NULL' : $v; }

mysql_connect('localhost');
echo "-- no database selected\n";
q("CREATE DATABASE shop");
q("CREATE TABLE shop.items (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(20), added DATE)");
q("INSERT INTO shop.items (name, added) VALUES ('apple', '2001-12-10')");
q("INSERT INTO `shop`.`items` VALUES (NULL, 'pear', '2001-12-11')");
q("SELECT * FROM shop.items");
q("SELECT shop.items.name FROM shop.items WHERE shop.items.id = 2");
q("SELECT i.name FROM shop.items i ORDER BY i.name DESC");
q("UPDATE shop.items SET name = 'Apple' WHERE id = 1");
q("DESCRIBE shop.items");
q("SHOW COLUMNS FROM items FROM shop");
q("SELECT * FROM items");
q("SELECT * FROM nosuch.items");
q("SELECT * FROM shop.nosuch");
q("CREATE TABLE nosuch.t (a INT)");

echo "-- test selected, reaching into shop\n";
mysql_select_db('test');
q("CREATE TABLE stock (item INT, qty INT)");
q("INSERT INTO stock VALUES (1, 10), (2, 0), (3, 5)");
q("SELECT i.name, s.qty FROM stock s, shop.items i WHERE i.id = s.item ORDER BY i.id");
q("SELECT items.name, stock.qty FROM shop.items LEFT JOIN stock ON stock.item = items.id");
q("SELECT DATABASE(), COUNT(*) FROM shop.items");
q("INSERT INTO shop.items (name) SELECT 'plum' FROM stock WHERE item = 3");
q("CREATE TABLE shop.low SELECT item, qty FROM test.stock WHERE qty < 6");
q("SELECT * FROM shop.low");
q("SELECT nosuch.stock.qty FROM stock");
q("DELETE FROM shop.items WHERE id = 2");
q("SELECT id, name FROM shop.items");
q("DROP TABLE shop.low, stock");
q("DROP TABLE shop.low");
q("DROP TABLE IF EXISTS shop.low, nosuch.t");
q("SHOW TABLES");
q("SHOW TABLES FROM shop");
