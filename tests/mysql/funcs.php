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
// one expression per query, with the result metadata: math, comparison,
// control flow, conversions, bit operations, dates and misc functions
function e($x) { q("SELECT $x"); }
// arithmetic and number formatting
e("1 + 1, 1 - 2, 2 * 3, 7 / 2, 7 % 3, -7 % 3, 7 % -3, 1 / 0, 1 % 0, 0 / 0");
e("1.5 + 1, 1.50 * 2, 0.1 + 0.2, 1e3, 1.0e3 + 1, -0.0, 3.14159265358979323846, 123456789012345678901234567890");
e("9223372036854775807 + 1, -9223372036854775808 - 1, 18446744073709551615, 18446744073709551616, 4294967296 * 4294967296");
e("2147483647 + 1, -2147483648 - 1, 4294967295 + 1, 9223372036854775807 * 2");
e("'3' + 4, '3abc' + 1, 'abc' + 1, '1e2' + 0, ' 12 ' + 0, '0x10' + 0, 0x10 + 0, 0x41, x'41', 'a' * 1");
e("ABS(-3), ABS(-3.5), ABS(NULL), SIGN(-2), SIGN(0), SIGN(3.3), MOD(10, 3), MOD(-10, 3), MOD(10.5, 3)");
e("ROUND(2.5), ROUND(3.5), ROUND(-2.5), ROUND(1.005, 2), ROUND(1234.5678, -2), ROUND(1.95583, 2), ROUND(2.675, 2), ROUND(-1.5)");
e("TRUNCATE(1.999, 1), TRUNCATE(-1.999, 1), TRUNCATE(122, -2), FLOOR(1.5), FLOOR(-1.5), CEILING(1.2), CEILING(-1.2), FLOOR(NULL)");
e("SQRT(4), SQRT(2), SQRT(-1), POW(2, 10), POWER(2, 0.5), POW(-8, 1/3), EXP(1), LN(10), LOG(10), LOG(-1), LOG10(1000), LOG(2, 8)");
e("PI(), PI() + 0.0000000000, SIN(0), COS(PI()), TAN(PI()/4), ASIN(1), ACOS(2), ATAN(1), ATAN(1, 2), ATAN2(1, 2), COT(1)");
e("DEGREES(PI()), RADIANS(180), RAND(1), RAND(1) < 1, RAND(2), RAND(NULL)");
e("GREATEST(1, 2, 3), GREATEST('a', 'B', 'c'), GREATEST(1, '2', 3.5), LEAST(2, 1.5), LEAST('b', 'A'), GREATEST(1, NULL)");
e("FORMAT(1234567.891, 2), FORMAT(1234.5, 0), FORMAT(-0.5, 0), FORMAT(1234567, 4), FORMAT(0.125, 2), FORMAT(NULL, 2)");
e("CONV('zz', 36, 10), CONV(-1, 10, 16), CONV(255, 10, -16), CONV('11', 2, 10), CONV('abc', 10, 10), BIN(-1), OCT(-1), HEX(-1)");
e("1 | 2, 6 & 3, 1 << 3, -1 >> 60, ~0, ~1, 5 ^ 3, BIT_COUNT(255), BIT_COUNT(-1)");
// comparison and logic
e("1 = 1, 1 = '1', 1 = '1a', 'a' = 0, NULL = NULL, NULL <=> NULL, 1 <=> NULL, 1 != 2, 1 <> 1, 2 > 1, '10' > '9', 10 > '9'");
e("1 AND 0, 1 && NULL, 0 AND NULL, 1 OR NULL, 0 OR NULL, NOT 1, NOT NULL, !0, 1 XOR 1");
e("2 BETWEEN 1 AND 3, 'b' BETWEEN 'a' AND 'c', 2 NOT BETWEEN 1 AND 3, NULL BETWEEN 1 AND 2, 5 BETWEEN 6 AND 4");
e("2 IN (1, 2), 'a' IN ('A', 'b'), 2 IN (1, NULL), 3 IN (1, NULL), NULL IN (1), 2 NOT IN (1, 3), 1 IN ('1', 'x')");
e("ISNULL(NULL), ISNULL(0), NULL IS NULL, 0 IS NOT NULL, IFNULL(NULL, 'x'), IFNULL(1, 'x'), NULLIF(1, 1), NULLIF(1, 2), COALESCE(NULL, NULL, 3)");
e("IF(1, 'a', 'b'), IF(0, 'a', 2), IF(NULL, 1, 2), IF(1 > 0, 1.5, 2), IF('0', 'y', 'n'), IF('0.0', 'y', 'n'), IF('abc', 'y', 'n')");
e("CASE 1 WHEN 1 THEN 'one' WHEN 2 THEN 'two' END, CASE 3 WHEN 1 THEN 'one' ELSE 'other' END, CASE WHEN 1 > 2 THEN 'a' END, CASE 'b' WHEN 'B' THEN 1 ELSE 0 END");
e("INTERVAL(5, 1, 3, 7), INTERVAL(0, 1), INTERVAL(NULL, 1), STRCMP('text', 'text2'), STRCMP(NULL, 'a')");
// strings, more
e("CONCAT('a', 1.50), CONCAT(1/3), CONCAT(2.0 * 3), LENGTH(1/3), LENGTH(PI()), CONCAT(0.1 + 0.2)");
e("LOCATE('', 'abc'), LOCATE('x', ''), INSTR('abc', ''), LEFT('abc', -1), RIGHT('abc', 0), SUBSTRING('abc', 0), SUBSTRING('abc', 5), MID('abc', 2, -1)");
e("REPEAT('x', 0), REPEAT('x', -1), SPACE(0), LPAD('a', 0, 'x'), RPAD('abc', 2, 'x'), LPAD('a', 3, ''), INSERT('abc', 10, 1, 'x'), INSERT('abc', 1, 10, 'x')");
e("FIND_IN_SET('b', 'a,b,c'), FIND_IN_SET('B', 'a,b,c'), FIND_IN_SET('d', 'a,b'), FIND_IN_SET('', ''), FIND_IN_SET('a,b', 'a,b')");
e("MAKE_SET(5, 'a', 'b', 'c'), MAKE_SET(0, 'a'), EXPORT_SET(5, 'Y', 'N', ',', 4), ELT(0, 'a'), ELT(3, 'a', 'b'), FIELD('x', 'a'), FIELD(NULL, 'a')");
e("QUOTE('x')");
e("CHAR(0x41, NULL, 66), CHAR(256), CHAR_LENGTH('é'), OCTET_LENGTH('ab'), BIT_LENGTH('ab')");
e("INET_ATON('10.0.5.9'), INET_ATON('1.2.3'), INET_NTOA(167773449), INET_NTOA(-1), INET_ATON('256.1.1.1')");
e("DATABASE(), USER(), SYSTEM_USER(), SESSION_USER(), VERSION(), CONNECTION_ID() > 0, LAST_INSERT_ID(), BENCHMARK(10, 1+1)");
e("GET_LOCK('lk', 1), IS_FREE_LOCK('lk'), RELEASE_LOCK('lk'), RELEASE_LOCK('lk'), IS_FREE_LOCK('lk'), RELEASE_LOCK('nosuch')");
// dates
e("DATE_FORMAT('2001-12-26 14:05:09', '%a %b %c %D %d %e %H %h %I %i %j %k %l %M %m %p %r %S %s %T %U %u %V %v %W %w %X %x %Y %y %%')");
e("DATE_FORMAT('2001-01-01', '%U %u %V %v %X %x'), DATE_FORMAT('2000-01-01', '%U %u %V %v %X %x'), DATE_FORMAT('0000-00-00', '%Y-%m-%d %W'), DATE_FORMAT('2001-13-01', '%Y')");
e("TIME_FORMAT('14:05:09', '%H %k %h %I %l %i %s %p %r %T'), TIME_FORMAT('-01:02:03', '%H:%i'), TIME_FORMAT('100:00:00', '%H %h')");
e("DAYOFWEEK('2001-12-26'), WEEKDAY('2001-12-26'), DAYOFMONTH('2001-12-26'), DAYOFYEAR('2001-12-26'), MONTH('2001-12-26'), YEAR('01-12-26'), QUARTER('2001-12-26'), DAYNAME('2001-12-26'), MONTHNAME('2001-12-26')");
e("WEEK('2001-12-31'), WEEK('2001-12-31', 1), WEEK('2000-01-01'), WEEK('2000-01-01', 1), YEARWEEK('2000-01-01'), YEARWEEK('2001-12-31', 1)");
e("HOUR('14:05:09'), MINUTE('14:05:09'), SECOND('14:05:09'), HOUR('2001-12-26 14:05:09'), HOUR('26:00:00'), MINUTE('2001-12-26'), SECOND(NULL)");
e("TO_DAYS('2001-12-26'), TO_DAYS('0000-00-00'), FROM_DAYS(731210), FROM_DAYS(0), FROM_DAYS(366), TO_DAYS(20011226), TO_DAYS('01-12-26')");
e("UNIX_TIMESTAMP('2001-12-26 14:05:09'), UNIX_TIMESTAMP('1969-12-31 23:59:59'), UNIX_TIMESTAMP('2038-01-19 03:14:08'), UNIX_TIMESTAMP(20011226), FROM_UNIXTIME(1009375509), FROM_UNIXTIME(1009375509, '%Y %D %M')");
e("FROM_UNIXTIME(0), FROM_UNIXTIME(-1), FROM_UNIXTIME(2147483648), FROM_UNIXTIME(1009375509) + 0, UNIX_TIMESTAMP(NULL)");
e("SEC_TO_TIME(3661), SEC_TO_TIME(-3661), SEC_TO_TIME(100000), SEC_TO_TIME(3661) + 0, TIME_TO_SEC('01:01:01'), TIME_TO_SEC('-01:00:00'), TIME_TO_SEC('25:00')");
e("PERIOD_ADD(200112, 1), PERIOD_ADD(0112, 13), PERIOD_ADD(200112, -12), PERIOD_DIFF(200202, 200112), PERIOD_DIFF(9912, 0001)");
e("DATE_ADD('2001-12-26', INTERVAL 1 DAY), DATE_ADD('2001-12-31 23:59:59', INTERVAL 1 SECOND), DATE_SUB('2001-03-31', INTERVAL 1 MONTH), ADDDATE('2000-02-29', INTERVAL 1 YEAR), SUBDATE('2001-12-26', INTERVAL 30 DAY)");
e("DATE_ADD('2001-12-26', INTERVAL '1:30' HOUR_MINUTE), DATE_ADD('2001-12-26 10:00:00', INTERVAL '1 1:1:1' DAY_SECOND), DATE_ADD('2001-12-26', INTERVAL '2-3' YEAR_MONTH), DATE_ADD('2001-12-26', INTERVAL -1 DAY_HOUR)");
e("'2001-12-26' + INTERVAL 1 DAY, INTERVAL 1 MONTH + '2001-01-31', '2001-12-26' - INTERVAL 1 YEAR, DATE_ADD('garbage', INTERVAL 1 DAY), DATE_ADD(NULL, INTERVAL 1 DAY), DATE_ADD('2001-12-26', INTERVAL NULL DAY)");
e("EXTRACT(YEAR FROM '2001-12-26'), EXTRACT(YEAR_MONTH FROM '2001-12-26 14:05'), EXTRACT(DAY_MINUTE FROM '2001-12-26 14:05:09'), EXTRACT(HOUR FROM '14:05:09'), EXTRACT(MINUTE_SECOND FROM '2001-12-26 14:05:09')");
e("'2001-12-26' < '2001-12-3', '2001-12-26' = 20011226, CURDATE() > '2000-01-01', NOW() > 20000101000000, '2001-12-26' + 0, '14:05' + 0");
e("DATE_FORMAT(NOW(), '%Y') >= 2001, LENGTH(NOW()), LENGTH(CURTIME()), LENGTH(CURDATE() + 0), LENGTH(NOW() + 0), LENGTH(UNIX_TIMESTAMP()), SYSDATE() = NOW(), CURRENT_DATE = CURDATE()");
// conversion into columns
q("CREATE TABLE cv (i int, u int unsigned, t tinyint, f float, d double, dc decimal(5,2), c char(5), vc varchar(5), dt date, tm time, dtt datetime, y year, e enum('a','b'), s set('x','y'))");
q("INSERT INTO cv VALUES ('12abc', -1, 300, '1.5e3', 'x', '12.345', 'toolongvalue', 12345678, '2001-02-30', '25:61:61', '2001-12-26 25:00:00', 1900, 'c', 'x,z')");
q("INSERT INTO cv VALUES (1e10, 1e10, -200, 1e40, 1e400, -999.999, 1.23456789, 3.14159265, 20011226, 123456, 20011226143005, '69', 3, 3)");
q("INSERT INTO cv VALUES (NULL, '  5', '0x7f', '', '1e', '.5', 'ab  ', ' ab ', '01-2-3', '1:2', '2001-1-2 3:4:5', 70, '', '')");
q("SELECT * FROM cv", 0);
q("SELECT i + 0, u - 1, t * 1.5, f / 3, dc * 2, CONCAT(c, '|'), y + 0, e + 0, s + 0, dt + 0, tm + 0, dtt + 0 FROM cv", 0);
