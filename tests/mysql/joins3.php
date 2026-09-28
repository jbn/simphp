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
// join syntax and several tables: INNER/CROSS/STRAIGHT JOIN, ON/USING,
// NATURAL, LEFT/RIGHT [OUTER], ODBC { oj }, and joins of 3 and 4 tables
q("CREATE TABLE au (aid int NOT NULL auto_increment PRIMARY KEY, name varchar(20) NOT NULL, country char(2))");
q("CREATE TABLE bk (bid int NOT NULL auto_increment PRIMARY KEY, aid int, title varchar(30) NOT NULL, year int, KEY aid (aid))");
q("CREATE TABLE rv (rid int NOT NULL auto_increment PRIMARY KEY, bid int NOT NULL, stars tinyint, KEY bid (bid))");
q("CREATE TABLE ct (country char(2) NOT NULL PRIMARY KEY, cname varchar(20))");
q("INSERT INTO au (name, country) VALUES ('Knuth', 'us'), ('Wirth', 'ch'), ('Dijkstra', 'nl'), ('Hoare', 'gb'), ('Nobody', NULL)");
q("INSERT INTO bk (aid, title, year) VALUES (1, 'TAOCP 1', 1968), (1, 'TAOCP 2', 1969), (2, 'Pascal', 1970), (3, 'Structured Prog', 1972), (NULL, 'Anonymous', 1999), (1, 'TeXbook', 1984), (9, 'Orphan', 2000)");
q("INSERT INTO rv (bid, stars) VALUES (1, 5), (1, 4), (3, 3), (6, 5), (6, NULL), (4, 2), (99, 1)");
q("INSERT INTO ct VALUES ('us', 'USA'), ('ch', 'Switzerland'), ('nl', 'Netherlands'), ('fr', 'France')");
q("SELECT au.name, bk.title FROM au INNER JOIN bk ON bk.aid = au.aid");
q("SELECT au.name, bk.title FROM au JOIN bk ON bk.aid = au.aid WHERE bk.year > 1969", 0);
q("SELECT au.name, bk.title FROM au CROSS JOIN bk WHERE bk.aid = au.aid AND au.aid = 1", 0);
q("SELECT au.name, bk.title FROM au STRAIGHT_JOIN bk WHERE bk.aid = au.aid", 0);
q("SELECT au.name, bk.title FROM bk STRAIGHT_JOIN au WHERE bk.aid = au.aid", 0);
q("SELECT name, title FROM au LEFT JOIN bk USING (aid)", 0);
q("SELECT name, title FROM au LEFT OUTER JOIN bk ON au.aid = bk.aid AND bk.year < 1970", 0);
q("SELECT name, title FROM bk RIGHT JOIN au ON au.aid = bk.aid", 0);
q("SELECT name, title FROM bk RIGHT OUTER JOIN au USING (aid) WHERE title IS NULL", 0);
q("SELECT au.name, ct.cname FROM au NATURAL LEFT JOIN ct");
q("SELECT au.name, ct.cname FROM au NATURAL JOIN ct", 0);
q("SELECT * FROM au NATURAL RIGHT JOIN ct", 0);
q("SELECT au.name, bk.title FROM { oj au LEFT OUTER JOIN bk ON au.aid = bk.aid }", 0);
q("SELECT au.name, bk.title, rv.stars FROM au, bk, rv WHERE bk.aid = au.aid AND rv.bid = bk.bid");
q("SELECT au.name, bk.title, rv.stars FROM au LEFT JOIN bk ON bk.aid = au.aid LEFT JOIN rv ON rv.bid = bk.bid", 0);
q("SELECT au.name, COUNT(rv.rid) AS n, AVG(rv.stars) FROM au LEFT JOIN bk ON bk.aid = au.aid LEFT JOIN rv ON rv.bid = bk.bid GROUP BY au.aid ORDER BY n DESC, au.name", 0);
q("SELECT au.name, ct.cname, bk.title, rv.stars FROM au, ct, bk, rv WHERE ct.country = au.country AND bk.aid = au.aid AND rv.bid = bk.bid ORDER BY rv.stars DESC, bk.title", 0);
// (not with COUNT(DISTINCT) as well: see README, "What differs")
q("SELECT ct.cname, COUNT(au.aid), COUNT(bk.bid), MAX(bk.year) FROM ct LEFT JOIN au ON au.country = ct.country LEFT JOIN bk ON bk.aid = au.aid GROUP BY ct.country", 0);
q("SELECT b1.title, b2.title FROM bk b1, bk b2 WHERE b1.aid = b2.aid AND b1.bid < b2.bid", 0);
q("SELECT DISTINCT au.name FROM au, bk WHERE au.aid = bk.aid", 0);
q("SELECT au.name FROM au LEFT JOIN bk ON au.aid = bk.aid WHERE bk.bid IS NULL", 0);
q("SELECT bk.title FROM bk LEFT JOIN au ON au.aid = bk.aid WHERE au.aid IS NULL", 0);
q("SELECT au.name, bk.title FROM au, bk WHERE au.aid = bk.aid AND (au.country = 'us' OR bk.year > 1971)", 0);
q("SELECT au.name, bk.title FROM au LEFT JOIN bk ON au.aid = bk.aid LIMIT 3", 0);
q("SELECT au.name, bk.title FROM au LEFT JOIN bk ON au.aid = bk.aid ORDER BY bk.year DESC LIMIT 3", 0);
q("SELECT au.name, MAX(bk.year) FROM au LEFT JOIN bk ON au.aid = bk.aid GROUP BY au.name HAVING MAX(bk.year) > 1970 OR MAX(bk.year) IS NULL", 0);
q("SELECT * FROM au JOIN bk", 0);
q("SELECT * FROM au LEFT JOIN bk");
q("SELECT * FROM au LEFT JOIN nosuch ON 1");
q("SELECT * FROM au, bk WHERE aid = 1");
q("SELECT * FROM au a, bk a");
q("SELECT * FROM au LEFT JOIN bk USING (nosuch)");
q("SELECT * FROM au LEFT JOIN bk ON bk.aid = rv.bid");
q("SELECT au.*, bk.title FROM au LEFT JOIN bk ON bk.aid = au.aid WHERE au.aid = 2", 0);
