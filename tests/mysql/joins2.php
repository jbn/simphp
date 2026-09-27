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
// joins whose inner table is read by a range that depends on the outer row
// ("range checked for each record"), bigger tables, and join order choices
q("CREATE TABLE ev (id int NOT NULL auto_increment PRIMARY KEY, day int NOT NULL, room char(4), KEY day (day), KEY room (room))");
q("CREATE TABLE per (pid int NOT NULL auto_increment PRIMARY KEY, name char(8), start int, stop int, KEY start (start))");
$rooms = array('red', 'blue', 'gray', 'pink');
for ($i = 1; $i <= 60; $i++) mysql_query("INSERT INTO ev (day, room) VALUES (" . (($i * 37) % 31 + 1) . ", '" . $rooms[$i % 4] . "')");
for ($i = 1; $i <= 8; $i++) mysql_query("INSERT INTO per (name, start, stop) VALUES ('p$i', " . (($i * 5) % 29 + 1) . ", " . ((($i * 5) % 29) + 4) . ")");
function x($sql) { q("EXPLAIN $sql"); q($sql, 0); }
x("SELECT per.name, ev.id, ev.day FROM per, ev WHERE ev.day > per.stop AND per.pid < 3");
x("SELECT per.name, ev.id FROM per, ev WHERE ev.day BETWEEN per.start AND per.stop");
x("SELECT per.name, ev.id FROM per, ev WHERE ev.day = per.start");
x("SELECT per.name, ev.id FROM per, ev WHERE ev.day < per.start AND ev.room = 'red'");
x("SELECT per.name, COUNT(ev.id) FROM per LEFT JOIN ev ON ev.day >= per.start AND ev.day <= per.stop GROUP BY per.pid");
x("SELECT ev.id, per.name FROM ev, per WHERE per.start = ev.day AND ev.room = 'blue'");
x("SELECT ev.id FROM ev WHERE day > 25 LIMIT 3");
x("SELECT ev.id FROM ev WHERE day > 5 LIMIT 3");
x("SELECT ev.id FROM ev WHERE day > 5");
x("SELECT ev.id FROM ev WHERE room > 'o'");
x("SELECT ev.id FROM ev WHERE room IN ('red', 'blue') AND day < 10");
x("SELECT ev.id FROM ev WHERE (day = 3 OR day = 7) AND room = 'red'");
x("SELECT ev.id FROM ev WHERE day = 3 OR room = 'red'");
x("SELECT a.id, b.id FROM ev a, ev b WHERE a.id = b.day AND a.id < 4");
x("SELECT COUNT(*) FROM ev a, ev b WHERE a.day = b.day");
