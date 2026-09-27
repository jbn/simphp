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
// several databases: CREATE ... SELECT, RENAME TABLE, same-named tables
q("CREATE DATABASE shop");
q("CREATE TABLE items (id int NOT NULL auto_increment PRIMARY KEY, name varchar(20) NOT NULL, price decimal(6,2))");
q("INSERT INTO items (name, price) VALUES ('apple', 0.5), ('pear', 0.75)");
q("CREATE TABLE shop.items (id int NOT NULL auto_increment PRIMARY KEY, name varchar(20) NOT NULL, stock int)");
q("INSERT INTO shop.items (name, stock) VALUES ('pear', 3), ('fig', 7), ('apple', 0)");
q("SELECT id, name FROM items ORDER BY id", 0);
q("SELECT id, name FROM shop.items ORDER BY id", 0);
q("SELECT items.name, shop.items.stock FROM items, shop.items WHERE items.name = shop.items.name ORDER BY items.name");
q("SELECT test.items.name, shop.items.stock FROM test.items, shop.items WHERE test.items.name = shop.items.name ORDER BY 1");
q("SELECT name FROM items, shop.items");
q("SELECT t.name, s.stock FROM test.items t LEFT JOIN shop.items s ON s.name = t.name ORDER BY t.id");
q("SELECT * FROM items, shop.items WHERE items.id = 1 AND shop.items.id = 1");
q("CREATE TABLE copy1 SELECT * FROM shop.items");
q("CREATE TABLE copy2 (SELECT name, stock * 2 AS dbl FROM shop.items WHERE stock > 0)");
q("CREATE TABLE copy3 (extra int NOT NULL default 5) SELECT name FROM items");
q("CREATE TABLE copy4 (id int NOT NULL auto_increment PRIMARY KEY) SELECT name FROM items");
q("CREATE TABLE shop.copy5 SELECT name, price FROM test.items");
q("SELECT * FROM copy1 ORDER BY id", 0);
q("SELECT * FROM copy2 ORDER BY name", 0);
q("SELECT * FROM copy3 ORDER BY name", 0);
q("SELECT * FROM copy4 ORDER BY id", 0);
q("SELECT * FROM shop.copy5 ORDER BY name", 0);
q("DESCRIBE copy1");
q("DESCRIBE copy2");
q("DESCRIBE copy3");
q("DESCRIBE copy4");
q("DESCRIBE shop.copy5");
q("RENAME TABLE copy1 TO shop.moved");
q("SELECT COUNT(*) FROM shop.moved");
q("SELECT COUNT(*) FROM copy1");
q("RENAME TABLE shop.moved TO back, copy2 TO copy2b");
q("SHOW TABLES");
q("SHOW TABLES FROM shop");
q("RENAME TABLE nosuch TO x");
q("RENAME TABLE copy3 TO copy4");
q("RENAME TABLE copy3 TO nosuchdb.x");
q("ALTER TABLE copy3 RENAME shop.copy3");
q("SHOW TABLES FROM shop");
q("INSERT INTO shop.items (name) SELECT name FROM test.items WHERE id = 1");
q("SELECT name, stock FROM shop.items ORDER BY id", 0);
q("UPDATE shop.items SET stock = 9 WHERE name = 'apple'");
q("DELETE FROM shop.items WHERE stock IS NULL");
q("SELECT DATABASE()");
q("USE shop");
q("SELECT DATABASE()");
q("SELECT name FROM items ORDER BY id", 0);
q("SELECT name FROM test.items ORDER BY id", 0);
q("DROP TABLE test.back, items");
q("SHOW TABLES FROM test");
q("DROP DATABASE shop");
q("SELECT DATABASE()");
q("SELECT 1");
q("SELECT * FROM items");
