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
// dates: DATE_FORMAT, UNIX_TIMESTAMP, zero dates, TIMESTAMP columns (TZ=UTC)
q("SELECT DATE_FORMAT('2001-12-26 14:30:05', '%a %b %c %D %d %e %H %h %I %i %j %k %l %M %m %p %r %S %s %T %U %u %V %v %W %w %X %x %Y %y %% %Q')", 0);
q("SELECT DATE_FORMAT('2002-01-01', '%D %j %U %u %W'), DATE_FORMAT('1999-12-31 23:59:59', '%y%m%d%H%i%s'), DATE_FORMAT('2001-02-03 00:00:00', '%l:%i %p'), DATE_FORMAT('2001-02-03 12:00:00', '%h %p'), DATE_FORMAT('2001-01-11','%D'), DATE_FORMAT('2001-01-22','%D'), DATE_FORMAT('2001-01-13','%D')", 0);
q("SELECT DATE_FORMAT('0000-00-00', '%Y-%m-%d %W'), DATE_FORMAT('0000-00-00 00:00:00', '%d.%m.%Y'), DATE_FORMAT(NULL, '%Y'), DATE_FORMAT('garbage', '%Y'), DATE_FORMAT(20011226, '%Y-%m-%d'), DATE_FORMAT('20011226143005', '%T')", 0);
q("SELECT UNIX_TIMESTAMP('2001-12-26 00:00:00'), UNIX_TIMESTAMP('1970-01-01 00:00:00'), UNIX_TIMESTAMP('2038-01-19 03:14:07'), UNIX_TIMESTAMP('1969-12-31'), UNIX_TIMESTAMP('0000-00-00 00:00:00'), UNIX_TIMESTAMP(20011226), UNIX_TIMESTAMP('2001-12-26')", 0);
q("SELECT FROM_UNIXTIME(1009324800), FROM_UNIXTIME(0), FROM_UNIXTIME(1009324800, '%Y %D %M'), FROM_UNIXTIME(1009324800)+0, FROM_UNIXTIME(-1)", 0);
q("SELECT TO_DAYS('2001-12-26'), FROM_DAYS(730845), TO_DAYS('0000-00-00'), DAYOFWEEK('2001-12-26'), WEEKDAY('2001-12-26'), DAYOFYEAR('2001-12-31'), WEEK('2001-12-31'), WEEK('2001-01-01'), WEEK('2001-12-31', 1), YEARWEEK('2001-12-31'), QUARTER('2001-08-01')", 0);
q("SELECT YEAR('2001-12-26'), MONTH('2001-12-26'), DAYOFMONTH('2001-12-26'), HOUR('10:05:03'), MINUTE('2001-12-26 10:05:03'), SECOND('10:05:03'), DAYNAME('2001-12-26'), MONTHNAME('2001-12-26'), YEAR('0000-00-00'), MONTH(NULL)", 0);
q("SELECT DATE_ADD('2001-12-31', INTERVAL 1 DAY), DATE_SUB('2001-03-01', INTERVAL 1 DAY), DATE_ADD('2001-01-31', INTERVAL 1 MONTH), DATE_ADD('2001-12-31 23:59:59', INTERVAL 1 SECOND), '2001-12-26' + INTERVAL 7 DAY, DATE_ADD('2001-12-26 10:00:00', INTERVAL '1:30' HOUR_MINUTE), DATE_ADD('2000-02-29', INTERVAL 1 YEAR), DATE_SUB('2001-01-01', INTERVAL '1-2' YEAR_MONTH), DATE_ADD('2001-01-01', INTERVAL -1 DAY), DATE_ADD('2001-12-26', INTERVAL 1 HOUR), DATE_ADD('0000-00-00', INTERVAL 1 DAY)", 0);
q("SELECT ADDDATE('2001-12-26', INTERVAL 2 WEEK)");
q("SELECT PERIOD_ADD(200112, 2), PERIOD_DIFF(200202, 200112), SEC_TO_TIME(3661), TIME_TO_SEC('01:01:01'), SEC_TO_TIME(-10), TIME_FORMAT('14:05:09', '%H.%i.%s %p'), TIME_FORMAT('100:00:00', '%H %k')", 0);
q("SELECT '2001-12-26' < '2001-12-27', '2001-12-26' = 20011226, 20011226 + 0", 0);
q("SELECT CAST('2001-12-26' AS DATE)");
q("CREATE TABLE dt (id int NOT NULL auto_increment PRIMARY KEY, d date, t datetime, tm time, y year, ts timestamp(14), ts2 timestamp(10), ts3 timestamp(8), ts4 timestamp(6))");
q("INSERT INTO dt (d, t, tm, y, ts, ts2, ts3, ts4) VALUES ('2001-12-26', '2001-12-26 14:30:05', '14:30:05', 2001, 20011226143005, '2001-12-26 14:30:05', '2001-12-26', 011226)");
q("INSERT INTO dt (d, t, tm, y) VALUES ('01-2-3', '01-02-03 4:5:6', '4:5', 69)");
q("INSERT INTO dt (d, t, tm, y) VALUES ('2001-13-45', '2001-02-30 25:61:61', '99:99:99', 1850)");
q("INSERT INTO dt (d, t, tm, y) VALUES ('20011226', 20011226143005, 143005, '01')");
q("INSERT INTO dt (d, t, tm, y) VALUES ('garbage', 'garbage', 'garbage', 'garbage')");
q("INSERT INTO dt (d, t, tm, y) VALUES ('0000-00-00', '0000-00-00 00:00:00', '00:00:00', 0)");
q("INSERT INTO dt (d, t, tm, y) VALUES ('2001.12.26', '2001/12/26 14.30.05', '-12:30:00', 2155)");
q("INSERT INTO dt (d, t, tm, y) VALUES ('991231', '991231235959', '838:59:59', 99)");
q("SELECT id, d, t, tm, y, d+0, t+0, tm+0, y+0 FROM dt ORDER BY id", 0);
q("SELECT id, ts, ts2, ts3, ts4 FROM dt WHERE id = 1", 0);
q("SELECT COUNT(*) FROM dt WHERE ts IS NULL OR ts = 0");
q("SELECT COUNT(*) FROM dt WHERE ts >= NOW() - INTERVAL 1 HOUR");
q("SELECT id FROM dt WHERE d = '0000-00-00' ORDER BY id", 0);
q("SELECT id FROM dt WHERE d IS NULL ORDER BY id", 0);
q("SELECT id, DATE_FORMAT(t, '%M %e, %Y') FROM dt WHERE t > '2000-01-01' ORDER BY t DESC", 0);
q("UPDATE dt SET ts = 20000101000000 WHERE id = 1");
q("SELECT ts FROM dt WHERE id = 1", 0);
q("UPDATE dt SET d = '2002-01-01' WHERE id = 1");
q("SELECT ts = 20000101000000, ts > 20020101000000 FROM dt WHERE id = 1", 0);
q("UPDATE dt SET ts = ts, d = '2003-01-01' WHERE id = 1");
q("SELECT ts > 20020101000000 FROM dt WHERE id = 1", 0);
q("UPDATE dt SET ts = 19991231235959 WHERE id = 1");
q("UPDATE dt SET ts = NULL WHERE id = 1");
q("SELECT ts IS NULL, ts > 20020101000000 FROM dt WHERE id = 1", 0);
q("CREATE TABLE two (a timestamp, b timestamp, c int)");
q("INSERT INTO two (c) VALUES (1)");
q("SELECT a > 0, b, c FROM two", 0);
q("INSERT INTO two VALUES (NULL, NULL, 2)");
q("SELECT a > 0, b > 0, c FROM two ORDER BY c", 0);
q("DESCRIBE two");
