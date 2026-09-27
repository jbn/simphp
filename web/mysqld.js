/*
 * mysqld.js -- an emulated MySQL 3.23.49 server for the PHP 4.1.1 simulator.
 *
 * PHP's real mysql extension (and the libmysql 3.23.39 client bundled with
 * PHP 4.1.1) connects to /tmp/mysql.sock or 127.0.0.1:3306; simphp routes that
 * socket here. This file speaks the MySQL 3.23 wire protocol (protocol 10)
 * and implements the server side the way MySQL 3.23.49 does it: its lexer and
 * grammar (so syntax errors point where MySQL's do), the Item classes that
 * type and evaluate expressions (result metadata, number formatting,
 * comparison and conversion rules), the Field classes that store values
 * (clipping, truncation, dates), and the SELECT machinery (joins, GROUP BY
 * with its implicit sort, DISTINCT, ORDER BY, LIMIT). The comments name the
 * MySQL source each part follows; tests/mysql-difftest.js compares the result
 * with a real MySQL 3.23.49 server.
 *
 * Each MySQL database is persisted by the embedder as
 * /var/lib/mysql/<db>.sqlite on the simulated disk: SQLite (sql.js) is only
 * the container format, one SQLite table per MySQL table.
 */
(function (root) {
  'use strict';

  const SERVER_VERSION = '3.23.49';
  const PROTOCOL_VERSION = 10;
  // sql/share/english/errmsg.txt of MySQL 3.23.49: the message of error 1000+i
  const ERRMSG = ["hashchk", "isamchk", "NO", "YES", "Can't create file '%-.64s' (errno: %d)", "Can't create table '%-.64s' (errno: %d)", "Can't create database '%-.64s'. (errno: %d)", "Can't create database '%-.64s'. Database exists", "Can't drop database '%-.64s'. Database doesn't exist", "Error dropping database (can't delete '%-.64s', errno: %d)", "Error dropping database (can't rmdir '%-.64s', errno: %d)", "Error on delete of '%-.64s' (errno: %d)", "Can't read record in system table", "Can't get status of '%-.64s' (errno: %d)", "Can't get working directory (errno: %d)", "Can't lock file (errno: %d)", "Can't open file: '%-.64s'. (errno: %d)", "Can't find file: '%-.64s' (errno: %d)", "Can't read dir of '%-.64s' (errno: %d)", "Can't change dir to '%-.64s' (errno: %d)", "Record has changed since last read in table '%-.64s'", "Disk full (%s). Waiting for someone to free some space....", "Can't write, duplicate key in table '%-.64s'", "Error on close of '%-.64s' (errno: %d)", "Error reading file '%-.64s' (errno: %d)", "Error on rename of '%-.64s' to '%-.64s' (errno: %d)", "Error writing file '%-.64s' (errno: %d)", "'%-.64s' is locked against change", "Sort aborted", "View '%-.64s' doesn't exist for '%-.64s'", "Got error %d from table handler", "Table handler for '%-.64s' doesn't have this option", "Can't find record in '%-.64s'", "Incorrect information in file: '%-.64s'", "Incorrect key file for table: '%-.64s'. Try to repair it", "Old key file for table '%-.64s'; Repair it!", "Table '%-.64s' is read only", "Out of memory. Restart daemon and try again (needed %d bytes)", "Out of sort memory. Increase daemon sort buffer size", "Unexpected eof found when reading file '%-.64s' (errno: %d)", "Too many connections", "Out of memory;  Check if mysqld or some other process uses all available memory. If not you may have to use 'ulimit' to allow mysqld to use more memory or you can add more swap space", "Can't get hostname for your address", "Bad handshake", "Access denied for user: '%-.32s@%-.64s' to database '%-.64s'", "Access denied for user: '%-.32s@%-.64s' (Using password: %s)", "No Database Selected", "Unknown command", "Column '%-.64s' cannot be null", "Unknown database '%-.64s'", "Table '%-.64s' already exists", "Unknown table '%-.64s'", "Column: '%-.64s' in %-.64s is ambiguous", "Server shutdown in progress", "Unknown column '%-.64s' in '%-.64s'", "'%-.64s' isn't in GROUP BY", "Can't group on '%-.64s'", "Statement has sum functions and columns in same statement", "Column count doesn't match value count", "Identifier name '%-.100s' is too long", "Duplicate column name '%-.64s'", "Duplicate key name '%-.64s'", "Duplicate entry '%-.64s' for key %d", "Incorrect column specifier for column '%-.64s'", "%s near '%-.80s' at line %d", "Query was empty", "Not unique table/alias: '%-.64s'", "Invalid default value for '%-.64s'", "Multiple primary key defined", "Too many keys specified. Max %d keys allowed", "Too many key parts specified. Max %d parts allowed", "Specified key was too long. Max key length is %d", "Key column '%-.64s' doesn't exist in table", "BLOB column '%-.64s' can't be used in key specification with the used table type", "Too big column length for column '%-.64s' (max = %d). Use BLOB instead", "Incorrect table definition; There can only be one auto column and it must be defined as a key", "%s: ready for connections\n", "%s: Normal shutdown\n", "%s: Got signal %d. Aborting!\n", "%s: Shutdown Complete\n", "%s: Forcing close of thread %ld  user: '%-.32s'\n", "Can't create IP socket", "Table '%-.64s' has no index like the one used in CREATE INDEX. Recreate the table", "Field separator argument is not what is expected. Check the manual", "You can't use fixed rowlength with BLOBs. Please use 'fields terminated by'.", "The file '%-.64s' must be in the database directory or be readable by all", "File '%-.80s' already exists", "Records: %ld  Deleted: %ld  Skipped: %ld  Warnings: %ld", "Records: %ld  Duplicates: %ld", "Incorrect sub part key. The used key part isn't a string, the used length is longer than the key part or the table handler doesn't support unique sub keys", "You can't delete all columns with ALTER TABLE. Use DROP TABLE instead", "Can't DROP '%-.64s'. Check that column/key exists", "Records: %ld  Duplicates: %ld  Warnings: %ld", "INSERT TABLE '%-.64s' isn't allowed in FROM table list", "Unknown thread id: %lu", "You are not owner of thread %lu", "No tables used", "Too many strings for column %-.64s and SET", "Can't generate a unique log-filename %-.64s.(1-999)\n", "Table '%-.64s' was locked with a READ lock and can't be updated", "Table '%-.64s' was not locked with LOCK TABLES", "BLOB column '%-.64s' can't have a default value", "Incorrect database name '%-.100s'", "Incorrect table name '%-.100s'", "The SELECT would examine too many records and probably take a very long time. Check your WHERE and use SET OPTION SQL_BIG_SELECTS=1 if the SELECT is ok", "Unknown error", "Unknown procedure '%-.64s'", "Incorrect parameter count to procedure '%-.64s'", "Incorrect parameters to procedure '%-.64s'", "Unknown table '%-.64s' in %-.32s", "Column '%-.64s' specified twice", "Invalid use of group function", "Table '%-.64s' uses an extension that doesn't exist in this MySQL version", "A table must have at least 1 column", "The table '%-.64s' is full", "Unknown character set: '%-.64s'", "Too many tables. MySQL can only use %d tables in a join", "Too many columns", "Too big row size. The maximum row size, not counting BLOBs, is %d. You have to change some fields to BLOBs", "Thread stack overrun:  Used: %ld of a %ld stack.  Use 'mysqld -O thread_stack=#' to specify a bigger stack if needed", "Cross dependency found in OUTER JOIN.  Examine your ON conditions", "Column '%-.64s' is used with UNIQUE or INDEX but is not defined as NOT NULL", "Can't load function '%-.64s'", "Can't initialize function '%-.64s'; %-.80s", "No paths allowed for shared library", "Function '%-.64s' already exist", "Can't open shared library '%-.64s' (errno: %d %-.64s)", "Can't find function '%-.64s' in library'", "Function '%-.64s' is not defined", "Host '%-.64s' is blocked because of many connection errors.  Unblock with 'mysqladmin flush-hosts'", "Host '%-.64s' is not allowed to connect to this MySQL server", "You are using MySQL as an anonymous users and anonymous users are not allowed to change passwords", "You must have privileges to update tables in the mysql database to be able to change passwords for others", "Can't find any matching row in the user table", "Rows matched: %ld  Changed: %ld  Warnings: %ld", "Can't create a new thread (errno %d). If you are not out of available memory, you can consult the manual for a possible OS-dependent bug", "Column count doesn't match value count at row %ld", "Can't reopen table: '%-.64s'", "Invalid use of NULL value", "Got error '%-.64s' from regexp", "Mixing of GROUP columns (MIN(),MAX(),COUNT()...) with no GROUP columns is illegal if there is no GROUP BY clause", "There is no such grant defined for user '%-.32s' on host '%-.64s'", "%-.16s command denied to user: '%-.32s@%-.64s' for table '%-.64s'", "%-.16s command denied to user: '%-.32s@%-.64s' for column '%-.64s' in table '%-.64s'", "Illegal GRANT/REVOKE command. Please consult the manual which privileges can be used.", "The host or user argument to GRANT is too long", "Table '%-.64s.%-.64s' doesn't exist", "There is no such grant defined for user '%-.32s' on host '%-.64s' on table '%-.64s'", "The used command is not allowed with this MySQL version", "You have an error in your SQL syntax", "Delayed insert thread couldn't get requested lock for table %-.64s", "Too many delayed threads in use", "Aborted connection %ld to db: '%-.64s' user: '%-.32s' (%-.64s)", "Got a packet bigger than 'max_allowed_packet'", "Got a read error from the connection pipe", "Got an error from fcntl()", "Got packets out of order", "Couldn't uncompress communication packet", "Got an error reading communication packets", "Got timeout reading communication packets", "Got an error writing communication packets", "Got timeout writing communication packets", "Result string is longer than max_allowed_packet", "The used table type doesn't support BLOB/TEXT columns", "The used table type doesn't support AUTO_INCREMENT columns", "INSERT DELAYED can't be used with table '%-.64s', because it is locked with LOCK TABLES", "Incorrect column name '%-.100s'", "The used table handler can't index column '%-.64s'", "All tables in the MERGE table are not identically defined", "Can't write, because of unique constraint, to table '%-.64s'", "BLOB column '%-.64s' used in key specification without a key length", "All parts of a PRIMARY KEY must be NOT NULL;  If you need NULL in a key, use UNIQUE instead", "Result consisted of more than one row", "This table type requires a primary key", "This version of MySQL is not compiled with RAID support", "You are using safe update mode and you tried to update a table without a WHERE that uses a KEY column", "Key '%-.64s' doesn't exist in table '%-.64s'", "Can't open table", "The handler for the table doesn't support check/repair", "You are not allowed to execute this command in a transaction", "Got error %d during COMMIT", "Got error %d during ROLLBACK", "Got error %d during FLUSH_LOGS", "Got error %d during CHECKPOINT", "Aborted connection %ld to db: '%-.64s' user: '%-.32s' host: `%-.64s' (%-.64s)", "The handler for the table does not support binary table dump", "Binlog closed, cannot RESET MASTER", "Failed rebuilding the index of  dumped table '%-.64s'", "Error from master: '%-.64s'", "Net error reading from master", "Net error writing to master", "Can't find FULLTEXT index matching the column list", "Can't execute the given command because you have active locked tables or an active transaction", "Unknown system variable '%-.64'", "Table '%-.64s' is marked as crashed and should be repaired", "Table '%-.64s' is marked as crashed and last (automatic?) repair failed", "Warning:  Some non-transactional changed tables couldn't be rolled back", "Multi-statement transaction required more than 'max_binlog_cache_size' bytes of storage. Increase this mysqld variable and try again',\n", "This operation requires a running slave, configure slave and do SLAVE START", "The server is not configured as slave, fix in config file or with CHANGE MASTER TO", "Could not initialize master info structure, check permisions on master.info", "Could not create slave thread, check system resources", "User %-.64s has already more than 'max_user_connections' active connections", "You may only use constant expressions with SET", "Lock wait timeout exceeded; Try restarting transaction", "The total number of locks exceeds the lock table size", "Update locks cannot be acquired during a READ UNCOMMITTED transaction", "DROP DATABASE not allowed while thread is holding global read lock", "CREATE DATABASE not allowed while thread is holding global read lock", "Wrong arguments to %s", "%-.32s@%-.64s is not allowed to create new users", "Incorrect table definition; All MERGE tables must be in the same database", "Deadlock found when trying to get lock; Try restarting transaction", "The used table type doesn't support FULLTEXT indexes", "Cannot add foreign key constraint", "Cannot add a child row: a foreign key constraint fails", "Cannot delete a parent row: a foreign key constraint fails"];
  // sql/share/charsets/latin1.conf of MySQL 3.23.49 (the default character set)
  const CTYPE = new Uint8Array([32, 32, 32, 32, 32, 32, 32, 32, 32, 40, 40, 40, 40, 40, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 72, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 132, 132, 132, 132, 132, 132, 132, 132, 132, 132, 16, 16, 16, 16, 16, 16, 16, 129, 129, 129, 129, 129, 129, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 16, 16, 16, 16, 16, 16, 130, 130, 130, 130, 130, 130, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 16, 16, 16, 16, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 72, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 16, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 16, 2, 2, 2, 2, 2, 2, 2, 2]);
  const TO_LOWER = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 215, 248, 249, 250, 251, 252, 253, 254, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255]);
  const TO_UPPER = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 247, 216, 217, 218, 219, 220, 221, 222, 255]);
  const SORT_ORDER = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 65, 65, 65, 65, 92, 91, 92, 67, 69, 69, 69, 69, 73, 73, 73, 73, 68, 78, 79, 79, 79, 79, 93, 215, 216, 85, 85, 85, 89, 89, 222, 223, 65, 65, 65, 65, 92, 91, 92, 67, 69, 69, 69, 69, 73, 73, 73, 73, 68, 78, 79, 79, 79, 79, 93, 247, 216, 85, 85, 85, 89, 89, 222, 255]);

  // ---------------------------------------------------------------------------
  // Byte strings: everything on the wire is bytes; values are JS strings with
  // one char per byte (latin1).
  // ---------------------------------------------------------------------------
  const bytesToStr = (u8) => {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return s;
  };
  const strToBytes = (s) => {
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i) & 0xff;
    return u8;
  };

  // ---------------------------------------------------------------------------
  // The latin1 character set (include/m_ctype.h, strings/ctype-latin1)
  // ---------------------------------------------------------------------------
  const _U = 1, _L = 2, _NMR = 4, _SPC = 8, _PNT = 16;
  const cc = (s, i) => s.charCodeAt(i) & 0xff;
  const my_isdigit = (c) => (CTYPE[c] & _NMR) !== 0;
  const my_isspace = (c) => (CTYPE[c] & _SPC) !== 0;
  const my_isalpha = (c) => (CTYPE[c] & (_U | _L)) !== 0;
  const my_isalnum = (c) => (CTYPE[c] & (_U | _L | _NMR)) !== 0;
  const my_ispunct = (c) => (CTYPE[c] & _PNT) !== 0;
  const my_isgraph = (c) => (CTYPE[c] & (_PNT | _U | _L | _NMR)) !== 0;
  const my_isxdigit = (c) => (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);
  function caseUp(s) { let o = ''; for (let i = 0; i < s.length; i++) o += String.fromCharCode(TO_UPPER[cc(s, i)]); return o; }
  function caseDn(s) { let o = ''; for (let i = 0; i < s.length; i++) o += String.fromCharCode(TO_LOWER[cc(s, i)]); return o; }
  // my_strcasecmp(): names of columns, databases, keywords
  const strcaseeq = (a, b) => a.length === b.length && caseUp(a) === caseUp(b);

  // sortcmp() (sql/sql_string.cc): compare by sort order, ignoring end space
  function sortcmp(s, t) {
    const len = Math.min(s.length, t.length);
    for (let i = 0; i < len; i++) {
      const a = SORT_ORDER[cc(s, i)], b = SORT_ORDER[cc(t, i)];
      if (a !== b) return a - b;
    }
    if (t.length > len) { for (let i = len; i < t.length; i++) if (!my_isspace(cc(t, i))) return -1; }
    else for (let i = len; i < s.length; i++) if (!my_isspace(cc(s, i))) return 1;
    return 0;
  }
  // stringcmp(): binary strings
  function stringcmp(s, t) {
    const len = Math.min(s.length, t.length);
    for (let i = 0; i < len; i++) {
      const a = cc(s, i), b = cc(t, i);
      if (a !== b) return a - b;
    }
    return s.length - t.length;
  }
  // Field_string::cmp() / Field_blob::cmp(): my_sortcmp on the common part,
  // then the length (CHAR fields are compared blank padded)
  function sortcmpLen(s, t) {
    const len = Math.min(s.length, t.length);
    for (let i = 0; i < len; i++) {
      const a = SORT_ORDER[cc(s, i)], b = SORT_ORDER[cc(t, i)];
      if (a !== b) return a - b;
    }
    return s.length - t.length;
  }
  function padcmp(s, t, binary) {
    // CHAR(n) values compare as if padded with spaces to n
    const n = Math.max(s.length, t.length);
    for (let i = 0; i < n; i++) {
      let a = i < s.length ? cc(s, i) : 32, b = i < t.length ? cc(t, i) : 32;
      if (!binary) { a = SORT_ORDER[a]; b = SORT_ORDER[b]; }
      if (a !== b) return a - b;
    }
    return 0;
  }

  // ---------------------------------------------------------------------------
  // glibc number parsing (the server is a 32-bit i386 binary: long is 32 bits)
  // ---------------------------------------------------------------------------
  const c_isspace = (c) => c === 32 || (c >= 9 && c <= 13);
  const LONG_MAX = 2147483647, LONG_MIN = -2147483648, ULONG_MAX = 4294967295;
  const LL_MAX = (1n << 63n) - 1n, LL_MIN = -(1n << 63n), ULL_MAX = (1n << 64n) - 1n;
  // Parses [space][sign]digits; returns { neg, digits, end, any }
  function scanInt(s, pos = 0) {
    let i = pos;
    while (i < s.length && c_isspace(cc(s, i))) i++;
    let neg = false;
    if (s[i] === '-' || s[i] === '+') { neg = s[i] === '-'; i++; }
    const start = i;
    while (i < s.length && s.charCodeAt(i) >= 48 && s.charCodeAt(i) <= 57) i++;
    return { neg, digits: s.slice(start, i), end: i, any: i > start };
  }
  // strtol(): saturates at LONG_MIN/LONG_MAX (errno ERANGE)
  function strtol(s) {
    const r = scanInt(s);
    if (!r.any) return { v: 0, err: false };
    const v = BigInt(r.digits) * (r.neg ? -1n : 1n);
    if (v > BigInt(LONG_MAX)) return { v: LONG_MAX, err: true };
    if (v < BigInt(LONG_MIN)) return { v: LONG_MIN, err: true };
    return { v: Number(v), err: false };
  }
  // strtoul(): negative numbers wrap, overflow gives ULONG_MAX
  function strtoul(s) {
    const r = scanInt(s);
    if (!r.any) return { v: 0, err: false };
    let v = BigInt(r.digits);
    if (v > BigInt(ULONG_MAX)) return { v: ULONG_MAX, err: true };
    if (r.neg) v = (1n << 32n) - v;
    return { v: Number(v & 0xffffffffn), err: false };
  }
  function strtoll(s) {
    const r = scanInt(s);
    if (!r.any) return { v: 0n, err: false };
    const v = BigInt(r.digits) * (r.neg ? -1n : 1n);
    if (v > LL_MAX) return { v: LL_MAX, err: true };
    if (v < LL_MIN) return { v: LL_MIN, err: true };
    return { v, err: false };
  }
  function strtoull(s) {
    const r = scanInt(s);
    if (!r.any) return { v: 0n, err: false };
    let v = BigInt(r.digits);
    if (v > ULL_MAX) return { v: ULL_MAX, err: true };
    if (r.neg) v = (1n << 64n) - v;
    return { v: v & ULL_MAX, err: false };
  }
  const atol = (s) => strtol(s).v;
  const toLL = (b) => BigInt.asIntN(64, b);   // wrap like a C longlong
  // strtod() of glibc in the C locale: decimal and hex floats, inf, nan
  function strtod(s) {
    let i = 0;
    while (i < s.length && c_isspace(cc(s, i))) i++;
    let neg = false;
    if (s[i] === '-' || s[i] === '+') { neg = s[i] === '-'; i++; }
    const rest = s.slice(i, i + 8).toLowerCase();
    let v;
    if (rest.startsWith('inf')) v = Infinity;
    else if (rest.startsWith('nan')) v = NaN;
    else if (s[i] === '0' && (s[i + 1] === 'x' || s[i + 1] === 'X') && (my_isxdigit(cc(s, i + 2)) || (s[i + 2] === '.' && my_isxdigit(cc(s, i + 3))))) {
      let j = i + 2, mant = 0n, exp = 0;
      while (j < s.length && my_isxdigit(cc(s, j))) { mant = mant * 16n + BigInt(parseInt(s[j], 16)); j++; }
      if (s[j] === '.') { j++; while (j < s.length && my_isxdigit(cc(s, j))) { mant = mant * 16n + BigInt(parseInt(s[j], 16)); exp -= 4; j++; } }
      if ((s[j] === 'p' || s[j] === 'P')) {
        const e = s.slice(j + 1).match(/^[-+]?\d+/);
        if (e) exp += parseInt(e[0], 10);
      }
      v = Number(mant) * Math.pow(2, exp);
    } else {
      const m = s.slice(i).match(/^(\d*)(\.\d*)?/);
      const intp = m[1], frac = m[2] || '';
      if (!intp && frac.length <= 1) return { v: 0, end: 0 };
      let text = (intp || '0') + (frac.length > 1 ? frac : '');
      let j = i + m[0].length;
      const e = s.slice(j).match(/^[eE][-+]?\d+/);
      if (e) { text += e[0]; j += e[0].length; }
      v = Number(text);
    }
    return { v: neg ? -v : v, end: s.length };
  }
  const atof = (s) => strtod(s).v;

  // ---------------------------------------------------------------------------
  // glibc printf for doubles: exact binary to decimal, round half to even
  // ---------------------------------------------------------------------------
  const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
  function dblParts(x) {         // |x| = mant * 2^exp
    f64[0] = x;
    const hi = u32[1], lo = u32[0];
    const e = (hi >>> 20) & 0x7ff;
    let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    let exp;
    if (e === 0) exp = -1074; else { mant |= 1n << 52n; exp = e - 1075; }
    return { neg: (hi >>> 31) === 1, mant, exp };
  }
  const POW10 = [1n];
  const pow10n = (n) => { while (POW10.length <= n) POW10.push(POW10[POW10.length - 1] * 10n); return POW10[n]; };
  function divRoundEven(n, d) {
    const q = n / d, r = n % d;
    if (r * 2n > d || (r * 2n === d && (q & 1n))) return q + 1n;
    return q;
  }
  function specialStr(x, neg) {
    if (isNaN(x)) return neg ? '-nan' : 'nan';
    return neg ? '-inf' : 'inf';
  }
  // %.<prec>f
  function fmtF(x, prec) {
    const { neg, mant, exp } = dblParts(x);
    if (!isFinite(x)) return specialStr(x, neg);
    let q;
    if (exp >= 0) q = (mant << BigInt(exp)) * pow10n(prec);
    else q = divRoundEven(mant * pow10n(prec), 1n << BigInt(-exp));
    let d = q.toString();
    if (prec > 0) {
      d = d.padStart(prec + 1, '0');
      d = d.slice(0, d.length - prec) + '.' + d.slice(d.length - prec);
    }
    return (neg ? '-' : '') + d;
  }
  // digits of |x| rounded to <ndig> significant digits: { digits, exp10 }
  function sigDigits(x, ndig) {
    const { mant, exp } = dblParts(x);
    if (mant === 0n) return { digits: '0'.repeat(ndig), exp10: 0 };
    let k = Math.floor(Math.log10(Math.abs(x)));
    for (let tries = 0; tries < 4; tries++) {
      const s = k - (ndig - 1);
      let num = mant, den = 1n;
      if (exp >= 0) num <<= BigInt(exp); else den <<= BigInt(-exp);
      if (s >= 0) den *= pow10n(s); else num *= pow10n(-s);
      const q = divRoundEven(num, den);
      if (q >= pow10n(ndig)) { k++; continue; }
      if (q < pow10n(ndig - 1)) { k--; continue; }
      return { digits: q.toString(), exp10: k };
    }
    throw new Error('sigDigits');
  }
  // %.<prec>e
  function fmtE(x, prec) {
    const { neg } = dblParts(x);
    if (!isFinite(x)) return specialStr(x, neg);
    const { digits, exp10 } = sigDigits(x, prec + 1);
    const e = x === 0 ? 0 : exp10;
    return (neg ? '-' : '') + digits[0] + (prec > 0 ? '.' + digits.slice(1) : '') + 'e' + (e < 0 ? '-' : '+') + String(Math.abs(e)).padStart(2, '0');
  }
  // %.<prec>g
  function fmtG(x, prec) {
    const { neg } = dblParts(x);
    if (!isFinite(x)) return specialStr(x, neg);
    const P = prec === 0 ? 1 : prec;
    const X = x === 0 ? 0 : sigDigits(x, P).exp10;
    let s;
    if (P > X && X >= -4) {
      s = fmtF(x, P - 1 - X);
      if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    } else {
      s = fmtE(x, P - 1);
      const m = s.match(/^(-?[0-9.]+)(e.*)$/);
      let mant = m[1];
      if (mant.indexOf('.') >= 0) mant = mant.replace(/0+$/, '').replace(/\.$/, '');
      s = mant + m[2];
    }
    return s;
  }

  // Formatting of MySQL errors: printf with %s %d %-.64s %.*s %lu %ld
  function cfmt(fmt, args) {
    let k = 0;
    return fmt.replace(/%(-?)(\d*)(?:\.(\d+|\*))?(l*)([sduc%])/g, (m0, left, width, prec, l, conv) => {
      if (conv === '%') return '%';
      if (prec === '*') prec = String(args[k++]);
      let v = args[k++];
      if (conv === 's') { v = v === null || v === undefined ? '(null)' : String(v); if (prec !== undefined) v = v.slice(0, +prec); }
      else if (conv === 'c') v = String.fromCharCode(Number(v));
      else v = String(typeof v === 'bigint' ? v : Math.trunc(Number(v)));
      if (width && v.length < +width) v = left ? v.padEnd(+width) : v.padStart(+width);
      return v;
    });
  }
  class SqlError extends Error {
    constructor(code, msg) { super(msg); this.code = code; }
  }
  const myError = (code, ...args) => new SqlError(code, cfmt(ERRMSG[code - 1000], args));
  const ER = {
    CANT_CREATE_FILE: 1004, CANT_CREATE_TABLE: 1005, CANT_CREATE_DB: 1006, DB_CREATE_EXISTS: 1007, DB_DROP_EXISTS: 1008,
    CANT_FIND_FILE: 1017, ERROR_ON_RENAME: 1025, CON_COUNT: 1040, OUT_OF_RESOURCES: 1041, ACCESS_DENIED: 1045,
    NO_DB: 1046, UNKNOWN_COM: 1047, BAD_NULL: 1048, BAD_DB: 1049, TABLE_EXISTS: 1050, BAD_TABLE: 1051,
    NON_UNIQ: 1052, BAD_FIELD: 1054, WRONG_FIELD_WITH_GROUP: 1055, WRONG_GROUP_FIELD: 1056, WRONG_SUM_SELECT: 1057,
    WRONG_VALUE_COUNT: 1058, TOO_LONG_IDENT: 1059, DUP_FIELDNAME: 1060, DUP_KEYNAME: 1061, DUP_ENTRY: 1062,
    WRONG_FIELD_SPEC: 1063, PARSE: 1064, EMPTY_QUERY: 1065, NONUNIQ_TABLE: 1066, INVALID_DEFAULT: 1067,
    MULTIPLE_PRI_KEY: 1068, TOO_MANY_KEYS: 1069, TOO_MANY_KEY_PARTS: 1070, TOO_LONG_KEY: 1071, KEY_COLUMN_DOES_NOT_EXIST: 1072,
    BLOB_USED_AS_KEY: 1073, TOO_BIG_FIELDLENGTH: 1074, WRONG_AUTO_KEY: 1075, WRONG_FIELD_TERMINATORS: 1083,
    BLOBS_AND_NO_TERMINATED: 1084, CANT_REMOVE_ALL_FIELDS: 1090, CANT_DROP_FIELD_OR_KEY: 1091, INSERT_INFO: 1092,
    INSERT_TABLE_USED: 1093, NO_SUCH_THREAD: 1094, TABLE_NOT_LOCKED_FOR_WRITE: 1099, TABLE_NOT_LOCKED: 1100,
    BLOB_CANT_HAVE_DEFAULT: 1101, WRONG_DB_NAME: 1102, WRONG_TABLE_NAME: 1103, TOO_BIG_SELECT: 1104, UNKNOWN_ERROR: 1105,
    UNKNOWN_PROCEDURE: 1106, WRONG_PARAMCOUNT_TO_PROCEDURE: 1107, UNKNOWN_TABLE: 1109, FIELD_SPECIFIED_TWICE: 1110,
    INVALID_GROUP_FUNC_USE: 1111, TABLE_MUST_HAVE_COLUMNS: 1113, RECORD_FILE_FULL: 1114, UNKNOWN_CHARACTER_SET: 1115,
    TOO_BIG_ROWSIZE: 1118, WRONG_OUTER_JOIN: 1120, NULL_COLUMN_IN_INDEX: 1121, PASSWORD_ANONYMOUS_USER: 1131,
    PASSWORD_NOT_ALLOWED: 1132, PASSWORD_NO_MATCH: 1133, UPDATE_INFO: 1134, WRONG_VALUE_COUNT_ON_ROW: 1136,
    CANT_REOPEN_TABLE: 1137, INVALID_USE_OF_NULL: 1138, REGEXP_ERROR: 1139, MIX_OF_GROUP_FUNC_AND_FIELDS: 1140,
    NONEXISTING_GRANT: 1141, TABLEACCESS_DENIED: 1142, WRONG_COLUMN_NAME: 1166, WRONG_KEY_COLUMN: 1167,
    BLOB_KEY_WITHOUT_LENGTH: 1170, PRIMARY_CANT_HAVE_NULL: 1171, TOO_MANY_ROWS: 1172, REQUIRES_PRIMARY_KEY: 1173,
    KEY_DOES_NOT_EXITS: 1176, CHECK_NOT_IMPLEMENTED: 1178, CANT_DO_THIS_DURING_AN_TRANSACTION: 1179,
    NO_PERMISSION_TO_CREATE_USER: 1211, NO_SUCH_TABLE: 1146, CANT_OPEN_LIBRARY: 1126, FUNCTION_NOT_DEFINED: 1128, TEXTFILE_NOT_READABLE: 1085, TABLE_CANT_HANDLE_BLOB: 1163, TABLE_CANT_HANDLE_AUTO_INCREMENT: 1164, TABLE_CANT_HANDLE_FULLTEXT: 1214, FILE_EXISTS_ERROR: 1086, NOT_ALLOWED_COMMAND: 1148, FILE_NOT_FOUND: 1017, LOAD_INFO: 1087, WRONG_SUB_KEY: 1089, NO_TABLES_USED: 1096, TOO_BIG_SET: 1097, UNION_TABLES_IN_DIFFERENT_DIR: 1212, SYNTAX: 1149,
  };
  // "You have an error in your SQL syntax near '...' at line N"
  function parseError(rest, line) {
    return new SqlError(ER.PARSE, cfmt(ERRMSG[ER.PARSE - 1000], [ERRMSG[1149 - 1000], rest, line]));
  }

  // int10_to_str / longlong10_to_str
  const llstr = (v) => (typeof v === 'bigint' ? v.toString() : String(v));

  // ---------------------------------------------------------------------------
  // current_thd: the state MySQL keeps per thread while a statement runs
  // ---------------------------------------------------------------------------
  let THD = { cuted_fields: 0, count_cuted_fields: false, query_start: 0, tz: null, conn: null };
  const cut = () => { THD.cuted_fields++; };

  // ---------------------------------------------------------------------------
  // Time zones: localtime_r() for the server's TZ (tzset() at startup)
  // ---------------------------------------------------------------------------
  class TimeZone {
    constructor(name) {
      this.name = name || 'UTC';
      this.utc = /^(UTC|GMT|UCT|Z|Etc\/(UTC|GMT))0?$/i.test(this.name);
      this.fmt = null;
      if (!this.utc) {
        try {
          this.fmt = new Intl.DateTimeFormat('en-US', { timeZone: this.name, hourCycle: 'h23', year: 'numeric', month: 'numeric',
            day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
        } catch (e) { this.utc = true; this.name = 'UTC'; }
      }
      this.cache = new Map();
      this.my_time_zone = 0;      // my_gmt_sec()'s cached offset (a static in MySQL)
    }
    // struct tm of the time_t t (seconds since the epoch)
    localtime(t) {
      if (this.utc) return gmtime(t);
      let tm = this.cache.get(t);
      if (tm) return tm;
      const p = {};
      for (const x of this.fmt.formatToParts(new Date(t * 1000))) p[x.type] = x.value;
      let year = +p.year;
      if (p.era === 'BC') year = 1 - year;
      const daynr = calc_daynr(year, +p.month, +p.day);
      tm = { year, mon: +p.month - 1, mday: +p.day, hour: +p.hour, min: +p.minute, sec: +p.second,
        wday: (calc_weekday(daynr, false) + 1) % 7, yday: daynr - calc_daynr(year, 1, 1) };
      if (this.cache.size > 5000) this.cache.clear();
      this.cache.set(t, tm);
      return tm;
    }
    // tzname[0], as SHOW VARIABLES LIKE 'timezone' shows it
    abbrev() {
      if (this.utc) return 'UTC';
      try {
        const f = new Intl.DateTimeFormat('en-US', { timeZone: this.name, timeZoneName: 'short' });
        const p = f.formatToParts(new Date(Date.UTC(2001, 0, 15))).find((x) => x.type === 'timeZoneName');
        return p ? p.value : this.name;
      } catch (e) { return this.name; }
    }
  }
  function gmtime(t) {
    const days = Math.floor(t / 86400);
    let s = t - days * 86400;
    const daynr = days + 719528;
    const d = get_date_from_daynr(daynr);
    // get_date_from_daynr() gives 0000-00-00 outside its range: compute directly then
    let year = d.year, month = d.month, day = d.day;
    if (!year) { const dt = new Date(t * 1000); year = dt.getUTCFullYear(); month = dt.getUTCMonth() + 1; day = dt.getUTCDate(); }
    const hour = Math.floor(s / 3600); s -= hour * 3600;
    const min = Math.floor(s / 60);
    return { year, mon: month - 1, mday: day, hour, min, sec: s - min * 60, wday: (calc_weekday(daynr, false) + 1) % 7,
      yday: daynr - calc_daynr(year, 1, 1) };
  }
  const nowSeconds = () => Math.floor(Date.now() / 1000);

  // ---------------------------------------------------------------------------
  // sql/time.cc
  // ---------------------------------------------------------------------------
  const YY_PART_YEAR = 70;
  const TIMESTAMP_MAX_YEAR = 2038;
  const DAYS_AT_TIMESTART = 719528;
  const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const TS_NONE = -1, TS_DATE = 0, TS_FULL = 1, TS_TIME = 2;   // timestamp_type
  const newTime = () => ({ year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0, second_part: 0, neg: false, time_type: TS_NONE });

  function calc_daynr(year, month, day) {
    if (year === 0 && month === 0 && day === 0) return 0;
    if (year < 200) { year += 1900; if (year < 1900 + YY_PART_YEAR) year += 100; }
    let delsum = 365 * year + 31 * (month - 1) + day;
    if (month <= 2) year--;
    else delsum -= Math.trunc((month * 4 + 23) / 10);
    const temp = Math.trunc((Math.trunc(year / 100) + 1) * 3 / 4);
    return delsum + Math.trunc(year / 4) - temp;
  }
  // 0 = Monday
  const calc_weekday = (daynr, sundayFirst) => ((daynr + 5 + (sundayFirst ? 1 : 0)) % 7 + 7) % 7;
  const calc_days_in_year = (year) => ((year & 3) === 0 && (year % 100 || (year % 400 === 0 && year)) ? 366 : 365);
  function calc_week(t, withYear, sundayFirst) {
    const daynr = calc_daynr(t.year, t.month, t.day);
    let first_daynr = calc_daynr(t.year, 1, 1);
    let weekday = calc_weekday(first_daynr, sundayFirst);
    let year = t.year, days;
    if (t.month === 1 && weekday >= 4 && t.day <= 7 - weekday) {
      if (!withYear) return { week: 0, year };
      withYear = false;
      year--;
      first_daynr -= (days = calc_days_in_year(year));
      weekday = (weekday + 53 * 7 - days) % 7;
    }
    if (weekday >= 4) days = daynr - (first_daynr + (7 - weekday));
    else days = daynr - (first_daynr - weekday);
    if (withYear && days >= 52 * 7) {
      weekday = (weekday + calc_days_in_year(year)) % 7;
      if (weekday < 4) return { week: 1, year: year + 1 };
    }
    return { week: Math.trunc(days / 7) + 1, year };
  }
  function get_date_from_daynr(daynr) {
    if (daynr <= 365 || daynr >= 3652500) return { year: 0, month: 0, day: 0 };
    let year = Math.trunc(daynr * 100 / 36525);
    const temp = Math.trunc((Math.trunc((year - 1) / 100) + 1) * 3 / 4);
    let day_of_year = daynr - year * 365 - Math.trunc((year - 1) / 4) + temp;
    let days_in_year;
    while (day_of_year > (days_in_year = calc_days_in_year(year))) { day_of_year -= days_in_year; year++; }
    let leap_day = 0;
    if (days_in_year === 366 && day_of_year > 31 + 28) {
      day_of_year--;
      if (day_of_year === 31 + 28) leap_day = 1;
    }
    let month = 1, i = 0;
    while (day_of_year > DAYS_IN_MONTH[i]) { day_of_year -= DAYS_IN_MONTH[i++]; month++; }
    return { year, month, day: day_of_year + leap_day };
  }
  function convert_period_to_month(period) {
    if (period === 0) return 0;
    let a = Math.trunc(period / 100);
    if (a < YY_PART_YEAR) a += 2000; else if (a < 100) a += 1900;
    return a * 12 + period % 100 - 1;
  }
  function convert_month_to_period(month) {
    if (month === 0) return 0;
    let year = Math.trunc(month / 12);
    if (year < 100) year += year < YY_PART_YEAR ? 2000 : 1900;
    return year * 100 + month % 12 + 1;
  }
  // str_to_TIME(): YYMMDD, YYYYMMDD, YYMMDDHHMMSS, YY-MM-DD, YYYY-MM-DD HH.MM.SS, ...
  function str_to_TIME(s, t, fuzzy) {
    const end = s.length;
    let i = 0;
    while (i < end && !my_isdigit(cc(s, i))) i++;
    if (i === end) return TS_NONE;
    let p = i;
    while (p < end && my_isdigit(cc(s, p))) p++;
    const digits = p - i;
    const year_length = (digits === 4 || digits === 8 || digits >= 14) ? 4 : 2;
    let field_length = year_length - 1;
    const date = [0, 0, 0, 0, 0, 0, 0];
    let n;
    for (n = 0; n < 6 && i < end && my_isdigit(cc(s, i)); n++) {
      let v = cc(s, i++) - 48;
      while (i < end && my_isdigit(cc(s, i)) && field_length--) { v = v * 10 + cc(s, i) - 48; i++; }
      date[n] = v;
      if (n === 2 && i < end && s[i] === 'T') i++;
      else if (n !== 5) {
        while (i < end && (my_ispunct(cc(s, i)) || my_isspace(cc(s, i)))) {
          if (my_isspace(cc(s, i)) && n !== 2) return TS_NONE;
          i++;
        }
      }
      field_length = 1;
    }
    if (n === 6 && end - i >= 2 && s[i] === '.' && my_isdigit(cc(s, i + 1))) {
      i++;
      let v = cc(s, i) - 48;
      field_length = 3;
      while (i++ !== end && i < end && my_isdigit(cc(s, i)) && field_length--) v = v * 10 + cc(s, i) - 48;
      date[6] = v;
    }
    if (year_length === 2) date[0] += date[0] < YY_PART_YEAR ? 2000 : 1900;
    const number_of_fields = n;
    if (number_of_fields < 3 || date[1] > 12 || date[2] > 31 || date[3] > 23 || date[4] > 59 || date[5] > 59 ||
      (!fuzzy && (date[1] === 0 || date[2] === 0))) {
      cut();
      return TS_NONE;
    }
    if (i !== end && THD.count_cuted_fields) {
      for (; i < end; i++) if (!my_isspace(cc(s, i))) { cut(); break; }
    }
    t.year = date[0]; t.month = date[1]; t.day = date[2];
    t.hour = date[3]; t.minute = date[4]; t.second = date[5]; t.second_part = date[6];
    t.neg = false;
    return (t.time_type = number_of_fields <= 3 ? TS_DATE : TS_FULL);
  }
  // my_gmt_sec(): local broken-down time to time_t, with MySQL's DST fixups
  function my_gmt_sec(t) {
    const tz = THD.tz;
    let hour = t.hour, day = t.day;
    if (hour >= 24) { day += Math.trunc(hour / 24); hour %= 24; }
    let tmp = (calc_daynr(t.year, t.month, day) - DAYS_AT_TIMESTART) * 86400 + hour * 3600 + t.minute * 60 + t.second + tz.my_time_zone;
    let l = tz.localtime(tmp), loop, diff;
    for (loop = 0; loop < 3 && (hour !== l.hour || t.minute !== l.min); loop++) {
      let days = day - l.mday;
      if (days < -1) days = 1; else if (days > 1) days = -1;
      diff = 3600 * (days * 24 + (hour - l.hour)) + 60 * (t.minute - l.min);
      tz.my_time_zone += diff;
      tmp += diff;
      l = tz.localtime(tmp);
    }
    if (loop === 3 && hour !== l.hour) {
      let days = day - l.mday;
      if (days < -1) days = 1; else if (days > 1) days = -1;
      diff = 3600 * (days * 24 + (hour - l.hour)) + 60 * (t.minute - l.min);
      if (diff === 3600) tmp += 3600 - t.minute * 60 - t.second;
      else if (diff === -3600) tmp -= t.minute * 60 + t.second;
    }
    if (Math.abs(tz.my_time_zone) > 3600 * 12) tz.my_time_zone = 0;
    return tmp;
  }
  function str_to_timestamp(s) {
    const t = newTime();
    if (str_to_TIME(s, t, false) === TS_NONE) return 0;
    if (t.year >= TIMESTAMP_MAX_YEAR || t.year < 1900 + YY_PART_YEAR) { cut(); return 0; }
    return my_gmt_sec(t);
  }
  function str_to_datetime(s, fuzzy) {
    const t = newTime();
    if (str_to_TIME(s, t, fuzzy) === TS_NONE) return 0;
    return t.year * 10000000000 + t.month * 100000000 + t.day * 1000000 + t.hour * 10000 + t.minute * 100 + t.second;
  }
  // str_to_time(): [-] DAYS [H]H:MM:SS, [H]H:MM:SS, [M]M:SS, [H]HMMSS, [M]MSS or [S]S
  function str_to_time(s, t) {
    const end = s.length;
    let i = 0, length = s.length;
    t.neg = false;
    for (; i < end && !my_isdigit(cc(s, i)) && s[i] !== '-'; i++) length--;
    if (i < end && s[i] === '-') { t.neg = true; i++; length--; }
    if (i === end) return true;
    if (length >= 12) {
      const neg = t.neg;
      if (str_to_TIME(s.slice(i), t, true) === TS_FULL) { t.neg = neg; return false; }
      t.neg = neg;
    }
    const date = [0, 0, 0, 0, 0];
    let value = 0, state, found_days = false, found_hours = false;
    for (; i < end && my_isdigit(cc(s, i)); i++) value = value * 10 + cc(s, i) - 48;
    if (s[i] === ' ') { while (++i < end && s[i] === ' '); i--; }
    let fractional = false;
    if (end - i > 1 && s[i] === ' ' && my_isdigit(cc(s, i + 1))) { date[0] = value; state = 1; found_days = true; i++; }
    else if (end - i > 1 && s[i] === ':' && my_isdigit(cc(s, i + 1))) { date[0] = 0; date[1] = value; state = 2; found_hours = true; i++; }
    else {
      date[0] = 0; date[1] = Math.trunc(value / 10000); date[2] = Math.trunc(value / 100) % 100; date[3] = value % 100;
      state = 4; fractional = true;
    }
    if (!fractional) {
      for (;;) {
        for (value = 0; i < end && my_isdigit(cc(s, i)); i++) value = value * 10 + cc(s, i) - 48;
        date[state++] = value;
        if (state === 4 || end - i < 2 || s[i] !== ':' || !my_isdigit(cc(s, i + 1))) break;
        i++;
      }
      if (state !== 4) {
        if (!found_hours && !found_days) {
          // bmove_upp(date+4, date+state, state-1 longs): values end up right aligned
          const vals = date.slice(1, state);
          for (let k = 0; k < 4; k++) date[k] = 0;
          for (let k = 0; k < vals.length; k++) date[4 - vals.length + k] = vals[k];
        } else for (let k = state; k < 4; k++) date[k] = 0;
      }
    }
    if (end - i >= 2 && s[i] === '.' && my_isdigit(cc(s, i + 1))) {
      let fl = 3;
      i++;
      value = cc(s, i) - 48;
      while (++i < end && my_isdigit(cc(s, i)) && fl--) value = value * 10 + cc(s, i) - 48;
      date[4] = value;
    } else date[4] = 0;
    if (date[2] >= 60 || date[3] >= 60) { cut(); return true; }
    t.month = 0; t.year = 0; t.day = date[0]; t.hour = date[1]; t.minute = date[2]; t.second = date[3]; t.second_part = date[4];
    t.time_type = TS_TIME;
    if (i !== end && THD.count_cuted_fields) {
      do { if (!my_isspace(cc(s, i))) { cut(); break; } } while (++i !== end);
    }
    return false;
  }
  // fix_datetime() (sql/field.cc): YYMMDD, YYYYMMDD, YYMMDDHHMMSS to YYYYMMDDHHMMSS
  function fix_datetime(nr) {
    if (nr === 0 || nr >= 10000101000000) return nr;
    if (nr < 101) { cut(); return 0; }
    if (nr <= (YY_PART_YEAR - 1) * 10000 + 1231) return (nr + 20000000) * 1000000;
    if (nr < YY_PART_YEAR * 10000 + 101) { cut(); return 0; }
    if (nr <= 991231) return (nr + 19000000) * 1000000;
    if (nr < 10000101) { cut(); return 0; }
    if (nr <= 99991231) return nr * 1000000;
    if (nr < 101000000) { cut(); return 0; }
    if (nr <= (YY_PART_YEAR - 1) * 10000000000 + 1231235959) return nr + 20000000000000;
    if (nr < YY_PART_YEAR * 10000000000 + 101000000) { cut(); return 0; }
    if (nr <= 991231235959) return nr + 19000000000000;
    cut();
    return 0;
  }
  // get_interval_info() (item_timefunc.cc)
  function get_interval_info(s, count) {
    const end = s.length, values = new Array(count).fill(0);
    let i = 0;
    while (i < end && !my_isdigit(cc(s, i))) i++;
    for (let n = 0; n < count; n++) {
      let value = 0;
      for (; i < end && my_isdigit(cc(s, i)); i++) value = value * 10 + cc(s, i) - 48;
      values[n] = value;
      while (i < end && !my_isdigit(cc(s, i))) i++;
      if (i === end && n !== count - 1) {
        const got = values.slice(0, n + 1);
        values.fill(0);
        for (let k = 0; k < got.length; k++) values[count - got.length + k] = got[k];
        break;
      }
    }
    return { values, error: i !== end };
  }
  const pad2 = (n) => String(n).padStart(2, '0');
  const pad4 = (n) => String(n).padStart(4, '0');
  const fmtDate = (t) => pad4(t.year) + '-' + pad2(t.month) + '-' + pad2(t.day);
  const fmtDateTime = (t) => fmtDate(t) + ' ' + pad2(t.hour) + ':' + pad2(t.minute) + ':' + pad2(t.second);
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  function tmToTime(tm) {
    const t = newTime();
    t.year = tm.year; t.month = tm.mon + 1; t.day = tm.mday; t.hour = tm.hour; t.minute = tm.min; t.second = tm.sec;
    t.time_type = TS_FULL;
    return t;
  }
  // sql/lex.h of MySQL 3.23.49: keywords (always) and functions (when '(' follows)
  const SYMBOLS = {"&&": "AND", "<": "LT", "<=": "LE", "<>": "NE", "!=": "NE", "=": "EQ", ">": "GT_SYM", ">=": "GE", "<<": "SHIFT_LEFT", ">>": "SHIFT_RIGHT", "<=>": "EQUAL_SYM", "ACTION": "ACTION", "ADD": "ADD", "AGGREGATE": "AGGREGATE_SYM", "ALL": "ALL", "ALTER": "ALTER", "AFTER": "AFTER_SYM", "AGAINST": "AGAINST", "ANALYZE": "ANALYZE_SYM", "AND": "AND", "AS": "AS", "ASC": "ASC", "AVG": "AVG_SYM", "AVG_ROW_LENGTH": "AVG_ROW_LENGTH", "AUTO_INCREMENT": "AUTO_INC", "AUTOCOMMIT": "AUTOCOMMIT", "BACKUP": "BACKUP_SYM", "BEGIN": "BEGIN_SYM", "BERKELEYDB": "BERKELEY_DB_SYM", "BDB": "BERKELEY_DB_SYM", "BETWEEN": "BETWEEN_SYM", "BIGINT": "BIGINT", "BIT": "BIT_SYM", "BINARY": "BINARY", "BLOB": "BLOB_SYM", "BOOL": "BOOL_SYM", "BOTH": "BOTH", "BY": "BY", "CASCADE": "CASCADE", "CASE": "CASE_SYM", "CHAR": "CHAR_SYM", "CHARACTER": "CHAR_SYM", "CHANGE": "CHANGE", "CHANGED": "CHANGED", "CHECK": "CHECK_SYM", "CHECKSUM": "CHECKSUM_SYM", "COLUMN": "COLUMN_SYM", "COLUMNS": "COLUMNS", "COMMENT": "COMMENT_SYM", "COMMIT": "COMMIT_SYM", "COMMITTED": "COMMITTED_SYM", "COMPRESSED": "COMPRESSED_SYM", "CONCURRENT": "CONCURRENT", "CONSTRAINT": "CONSTRAINT", "CREATE": "CREATE", "CROSS": "CROSS", "CURRENT_DATE": "CURDATE", "CURRENT_TIME": "CURTIME", "CURRENT_TIMESTAMP": "NOW_SYM", "DATA": "DATA_SYM", "DATABASE": "DATABASE", "DATABASES": "DATABASES", "DATE": "DATE_SYM", "DATETIME": "DATETIME", "DAY": "DAY_SYM", "DAY_HOUR": "DAY_HOUR_SYM", "DAY_MINUTE": "DAY_MINUTE_SYM", "DAY_SECOND": "DAY_SECOND_SYM", "DEC": "DECIMAL_SYM", "DECIMAL": "DECIMAL_SYM", "DEFAULT": "DEFAULT", "DELAYED": "DELAYED_SYM", "DELAY_KEY_WRITE": "DELAY_KEY_WRITE_SYM", "DELETE": "DELETE_SYM", "DESC": "DESC", "DESCRIBE": "DESCRIBE", "DISTINCT": "DISTINCT", "DISTINCTROW": "DISTINCT", "DO": "DO_SYM", "DOUBLE": "DOUBLE_SYM", "DROP": "DROP", "DUMPFILE": "DUMPFILE", "DYNAMIC": "DYNAMIC_SYM", "END": "END", "ELSE": "ELSE", "ESCAPE": "ESCAPE_SYM", "ESCAPED": "ESCAPED", "ENCLOSED": "ENCLOSED", "ENUM": "ENUM", "EXPLAIN": "DESCRIBE", "EXISTS": "EXISTS", "EXTENDED": "EXTENDED_SYM", "FAST": "FAST_SYM", "FIELDS": "COLUMNS", "FILE": "FILE_SYM", "FIRST": "FIRST_SYM", "FIXED": "FIXED_SYM", "FLOAT": "FLOAT_SYM", "FLOAT4": "FLOAT_SYM", "FLOAT8": "DOUBLE_SYM", "FLUSH": "FLUSH_SYM", "FOREIGN": "FOREIGN", "RAID_TYPE": "RAID_TYPE", "RAID_CHUNKS": "RAID_CHUNKS", "RAID_CHUNKSIZE": "RAID_CHUNKSIZE", "ROW_FORMAT": "ROW_FORMAT_SYM", "FROM": "FROM", "FOR": "FOR_SYM", "FULL": "FULL", "FULLTEXT": "FULLTEXT_SYM", "FUNCTION": "UDF_SYM", "GEMINI": "GEMINI_SYM", "GEMINI_SPIN_RETRIES": "GEMINI_SPIN_RETRIES", "GLOBAL": "GLOBAL_SYM", "GRANT": "GRANT", "GRANTS": "GRANTS", "GROUP": "GROUP", "HAVING": "HAVING", "HEAP": "HEAP_SYM", "HIGH_PRIORITY": "HIGH_PRIORITY", "HOUR": "HOUR_SYM", "HOUR_MINUTE": "HOUR_MINUTE_SYM", "HOUR_SECOND": "HOUR_SECOND_SYM", "HOSTS": "HOSTS_SYM", "IDENTIFIED": "IDENTIFIED_SYM", "IGNORE": "IGNORE_SYM", "IN": "IN_SYM", "INDEX": "INDEX", "INFILE": "INFILE", "INNER": "INNER_SYM", "INNOBASE": "INNOBASE_SYM", "INNODB": "INNOBASE_SYM", "INSERT": "INSERT", "INSERT_ID": "INSERT_ID", "INT": "INT_SYM", "INTEGER": "INT_SYM", "INTERVAL": "INTERVAL_SYM", "INT1": "TINYINT", "INT2": "SMALLINT", "INT3": "MEDIUMINT", "INT4": "INT_SYM", "INT8": "BIGINT", "INTO": "INTO", "IF": "IF", "IS": "IS", "ISOLATION": "ISOLATION", "ISAM": "ISAM_SYM", "JOIN": "JOIN_SYM", "KEY": "KEY_SYM", "KEYS": "KEYS", "KILL": "KILL_SYM", "LAST_INSERT_ID": "LAST_INSERT_ID", "LEADING": "LEADING", "LEFT": "LEFT", "LEVEL": "LEVEL_SYM", "LIKE": "LIKE", "LINES": "LINES", "LIMIT": "LIMIT", "LOAD": "LOAD", "LOCAL": "LOCAL_SYM", "LOCK": "LOCK_SYM", "LOCKS": "LOCKS_SYM", "LOGS": "LOGS_SYM", "LONG": "LONG_SYM", "LONGBLOB": "LONGBLOB", "LONGTEXT": "LONGTEXT", "LOW_PRIORITY": "LOW_PRIORITY", "MASTER": "MASTER_SYM", "MASTER_CONNECT_RETRY": "MASTER_CONNECT_RETRY_SYM", "MASTER_HOST": "MASTER_HOST_SYM", "MASTER_LOG_FILE": "MASTER_LOG_FILE_SYM", "MASTER_LOG_POS": "MASTER_LOG_POS_SYM", "MASTER_PASSWORD": "MASTER_PASSWORD_SYM", "MASTER_PORT": "MASTER_PORT_SYM", "MASTER_USER": "MASTER_USER_SYM", "MAX_ROWS": "MAX_ROWS", "MATCH": "MATCH", "MEDIUMBLOB": "MEDIUMBLOB", "MEDIUMTEXT": "MEDIUMTEXT", "MEDIUMINT": "MEDIUMINT", "MERGE": "MERGE_SYM", "MEDIUM": "MEDIUM_SYM", "MIDDLEINT": "MEDIUMINT", "MIN_ROWS": "MIN_ROWS", "MINUTE": "MINUTE_SYM", "MINUTE_SECOND": "MINUTE_SECOND_SYM", "MODE": "MODE_SYM", "MODIFY": "MODIFY_SYM", "MONTH": "MONTH_SYM", "MRG_MYISAM": "MERGE_SYM", "MYISAM": "MYISAM_SYM", "NATURAL": "NATURAL", "NATIONAL": "NATIONAL_SYM", "NCHAR": "NCHAR_SYM", "NUMERIC": "NUMERIC_SYM", "NO": "NO_SYM", "NOT": "NOT", "NULL": "NULL_SYM", "ON": "ON", "OPEN": "OPEN_SYM", "OPTIMIZE": "OPTIMIZE", "OPTION": "OPTION", "OPTIONALLY": "OPTIONALLY", "OR": "OR", "ORDER": "ORDER_SYM", "OUTER": "OUTER", "OUTFILE": "OUTFILE", "PACK_KEYS": "PACK_KEYS_SYM", "PARTIAL": "PARTIAL", "PASSWORD": "PASSWORD", "PURGE": "PURGE", "PRECISION": "PRECISION", "PRIMARY": "PRIMARY_SYM", "PROCEDURE": "PROCEDURE", "PROCESS": "PROCESS", "PROCESSLIST": "PROCESSLIST_SYM", "PRIVILEGES": "PRIVILEGES", "QUICK": "QUICK", "RAID0": "RAID_0_SYM", "READ": "READ_SYM", "REAL": "REAL", "REFERENCES": "REFERENCES", "RELOAD": "RELOAD", "REGEXP": "REGEXP", "RENAME": "RENAME", "REPAIR": "REPAIR", "REPLACE": "REPLACE", "REPEATABLE": "REPEATABLE_SYM", "RESET": "RESET_SYM", "RESTORE": "RESTORE_SYM", "RESTRICT": "RESTRICT", "RETURNS": "UDF_RETURNS_SYM", "REVOKE": "REVOKE", "RIGHT": "RIGHT", "RLIKE": "REGEXP", "ROLLBACK": "ROLLBACK_SYM", "ROW": "ROW_SYM", "ROWS": "ROWS_SYM", "SECOND": "SECOND_SYM", "SELECT": "SELECT_SYM", "SERIALIZABLE": "SERIALIZABLE_SYM", "SESSION": "SESSION_SYM", "SET": "SET", "SHARE": "SHARE_SYM", "SHOW": "SHOW", "SHUTDOWN": "SHUTDOWN", "SLAVE": "SLAVE", "SMALLINT": "SMALLINT", "SONAME": "UDF_SONAME_SYM", "SQL_AUTO_IS_NULL": "SQL_AUTO_IS_NULL", "SQL_BIG_RESULT": "SQL_BIG_RESULT", "SQL_BIG_SELECTS": "SQL_BIG_SELECTS", "SQL_BIG_TABLES": "SQL_BIG_TABLES", "SQL_BUFFER_RESULT": "SQL_BUFFER_RESULT", "SQL_LOG_BIN": "SQL_LOG_BIN", "SQL_LOG_OFF": "SQL_LOG_OFF", "SQL_LOG_UPDATE": "SQL_LOG_UPDATE", "SQL_LOW_PRIORITY_UPDATES": "SQL_LOW_PRIORITY_UPDATES", "SQL_MAX_JOIN_SIZE": "SQL_MAX_JOIN_SIZE", "SQL_QUOTE_SHOW_CREATE": "SQL_QUOTE_SHOW_CREATE", "SQL_SAFE_UPDATES": "SQL_SAFE_UPDATES", "SQL_SELECT_LIMIT": "SQL_SELECT_LIMIT", "SQL_SLAVE_SKIP_COUNTER": "SQL_SLAVE_SKIP_COUNTER", "SQL_SMALL_RESULT": "SQL_SMALL_RESULT", "SQL_WARNINGS": "SQL_WARNINGS", "STRAIGHT_JOIN": "STRAIGHT_JOIN", "START": "START_SYM", "STARTING": "STARTING", "STATUS": "STATUS_SYM", "STRING": "STRING_SYM", "STOP": "STOP_SYM", "STRIPED": "RAID_STRIPED_SYM", "TABLE": "TABLE_SYM", "TABLES": "TABLES", "TEMPORARY": "TEMPORARY", "TERMINATED": "TERMINATED", "TEXT": "TEXT_SYM", "THEN": "THEN_SYM", "TIME": "TIME_SYM", "TIMESTAMP": "TIMESTAMP", "TINYBLOB": "TINYBLOB", "TINYTEXT": "TINYTEXT", "TINYINT": "TINYINT", "TRAILING": "TRAILING", "TRANSACTION": "TRANSACTION_SYM", "TRUNCATE": "TRUNCATE_SYM", "TO": "TO_SYM", "TYPE": "TYPE_SYM", "UNCOMMITTED": "UNCOMMITTED_SYM", "UNION": "UNION_SYM", "UNIQUE": "UNIQUE_SYM", "UNLOCK": "UNLOCK_SYM", "UNSIGNED": "UNSIGNED", "USE": "USE_SYM", "USING": "USING", "UPDATE": "UPDATE_SYM", "USAGE": "USAGE", "VALUES": "VALUES", "VARCHAR": "VARCHAR", "VARIABLES": "VARIABLES", "VARYING": "VARYING", "VARBINARY": "VARBINARY", "WITH": "WITH", "WORK": "WORK_SYM", "WRITE": "WRITE_SYM", "WHEN": "WHEN_SYM", "WHERE": "WHERE", "YEAR": "YEAR_SYM", "YEAR_MONTH": "YEAR_MONTH_SYM", "ZEROFILL": "ZEROFILL", "||": "OR_OR_CONCAT"};
  const FUNCTIONS = {"ABS": ["FUNC_ARG1", "create_func_abs"], "ACOS": ["FUNC_ARG1", "create_func_acos"], "ADDDATE": ["DATE_ADD_INTERVAL", null], "ASCII": ["FUNC_ARG1", "create_func_ascii"], "ASIN": ["FUNC_ARG1", "create_func_asin"], "ATAN": ["ATAN", null], "ATAN2": ["ATAN", null], "BENCHMARK": ["BENCHMARK_SYM", null], "BIN": ["FUNC_ARG1", "create_func_bin"], "BIT_COUNT": ["FUNC_ARG1", "create_func_bit_count"], "BIT_OR": ["BIT_OR", null], "BIT_AND": ["BIT_AND", null], "CEILING": ["FUNC_ARG1", "create_func_ceiling"], "CHAR_LENGTH": ["FUNC_ARG1", "create_func_char_length"], "CHARACTER_LENGTH": ["FUNC_ARG1", "create_func_char_length"], "COALESCE": ["COALESCE", null], "CONCAT": ["CONCAT", null], "CONCAT_WS": ["CONCAT_WS", null], "CONNECTION_ID": ["FUNC_ARG0", "create_func_connection_id"], "CONV": ["FUNC_ARG3", "create_func_conv"], "COUNT": ["COUNT_SYM", null], "COS": ["FUNC_ARG1", "create_func_cos"], "COT": ["FUNC_ARG1", "create_func_cot"], "CURDATE": ["CURDATE", null], "CURTIME": ["CURTIME", null], "DATE_ADD": ["DATE_ADD_INTERVAL", null], "DATE_FORMAT": ["FUNC_ARG2", "create_func_date_format"], "DATE_SUB": ["DATE_SUB_INTERVAL", null], "DAYNAME": ["FUNC_ARG1", "create_func_dayname"], "DAYOFMONTH": ["FUNC_ARG1", "create_func_dayofmonth"], "DAYOFWEEK": ["FUNC_ARG1", "create_func_dayofweek"], "DAYOFYEAR": ["FUNC_ARG1", "create_func_dayofyear"], "DECODE": ["DECODE_SYM", null], "DEGREES": ["FUNC_ARG1", "create_func_degrees"], "ELT": ["ELT_FUNC", null], "ENCODE": ["ENCODE_SYM", null], "ENCRYPT": ["ENCRYPT", null], "EXTRACT": ["EXTRACT_SYM", null], "EXP": ["FUNC_ARG1", "create_func_exp"], "EXPORT_SET": ["EXPORT_SET", null], "FIELD": ["FIELD_FUNC", null], "FIND_IN_SET": ["FUNC_ARG2", "create_func_find_in_set"], "FLOOR": ["FUNC_ARG1", "create_func_floor"], "FORMAT": ["FORMAT_SYM", null], "FROM_DAYS": ["FUNC_ARG1", "create_func_from_days"], "FROM_UNIXTIME": ["FROM_UNIXTIME", null], "GET_LOCK": ["FUNC_ARG2", "create_func_get_lock"], "GREATEST": ["GREATEST_SYM", null], "GROUP_UNIQUE_USERS": ["GROUP_UNIQUE_USERS", null], "HEX": ["FUNC_ARG1", "create_func_hex"], "IFNULL": ["FUNC_ARG2", "create_func_ifnull"], "INET_ATON": ["FUNC_ARG1", "create_func_inet_aton"], "INET_NTOA": ["FUNC_ARG1", "create_func_inet_ntoa"], "INSTR": ["FUNC_ARG2", "create_func_instr"], "ISNULL": ["FUNC_ARG1", "create_func_isnull"], "LCASE": ["FUNC_ARG1", "create_func_lcase"], "LEAST": ["LEAST_SYM", null], "LENGTH": ["FUNC_ARG1", "create_func_length"], "LOAD_FILE": ["FUNC_ARG1", "create_load_file"], "LOCATE": ["LOCATE", null], "LOG": ["FUNC_ARG1", "create_func_log"], "LOG10": ["FUNC_ARG1", "create_func_log10"], "LOWER": ["FUNC_ARG1", "create_func_lcase"], "LPAD": ["FUNC_ARG3", "create_func_lpad"], "LTRIM": ["FUNC_ARG1", "create_func_ltrim"], "MASTER_POS_WAIT": ["FUNC_ARG2", "create_wait_for_master_pos"], "MAKE_SET": ["MAKE_SET_SYM", null], "MAX": ["MAX_SYM", null], "MD5": ["FUNC_ARG1", "create_func_md5"], "MID": ["SUBSTRING", null], "MIN": ["MIN_SYM", null], "MOD": ["FUNC_ARG2", "create_func_mod"], "MONTHNAME": ["FUNC_ARG1", "create_func_monthname"], "NOW": ["NOW_SYM", null], "NULLIF": ["FUNC_ARG2", "create_func_nullif"], "OCTET_LENGTH": ["FUNC_ARG1", "create_func_length"], "OCT": ["FUNC_ARG1", "create_func_oct"], "ORD": ["FUNC_ARG1", "create_func_ord"], "PERIOD_ADD": ["FUNC_ARG2", "create_func_period_add"], "PERIOD_DIFF": ["FUNC_ARG2", "create_func_period_diff"], "PI": ["FUNC_ARG0", "create_func_pi"], "POSITION": ["POSITION_SYM", null], "POW": ["FUNC_ARG2", "create_func_pow"], "POWER": ["FUNC_ARG2", "create_func_pow"], "QUARTER": ["FUNC_ARG1", "create_func_quarter"], "RADIANS": ["FUNC_ARG1", "create_func_radians"], "RAND": ["RAND", null], "RELEASE_LOCK": ["FUNC_ARG1", "create_func_release_lock"], "REPEAT": ["FUNC_ARG2", "create_func_repeat"], "REVERSE": ["FUNC_ARG1", "create_func_reverse"], "ROUND": ["ROUND", null], "RPAD": ["FUNC_ARG3", "create_func_rpad"], "RTRIM": ["FUNC_ARG1", "create_func_rtrim"], "SEC_TO_TIME": ["FUNC_ARG1", "create_func_sec_to_time"], "SESSION_USER": ["USER", null], "SUBDATE": ["DATE_SUB_INTERVAL", null], "SIGN": ["FUNC_ARG1", "create_func_sign"], "SIN": ["FUNC_ARG1", "create_func_sin"], "SOUNDEX": ["FUNC_ARG1", "create_func_soundex"], "SPACE": ["FUNC_ARG1", "create_func_space"], "SQRT": ["FUNC_ARG1", "create_func_sqrt"], "STD": ["STD_SYM", null], "STDDEV": ["STD_SYM", null], "STRCMP": ["FUNC_ARG2", "create_func_strcmp"], "SUBSTRING": ["SUBSTRING", null], "SUBSTRING_INDEX": ["SUBSTRING_INDEX", null], "SUM": ["SUM_SYM", null], "SYSDATE": ["NOW_SYM", null], "SYSTEM_USER": ["USER", null], "TAN": ["FUNC_ARG1", "create_func_tan"], "TIME_FORMAT": ["FUNC_ARG2", "create_func_time_format"], "TIME_TO_SEC": ["FUNC_ARG1", "create_func_time_to_sec"], "TO_DAYS": ["FUNC_ARG1", "create_func_to_days"], "TRIM": ["TRIM", null], "UCASE": ["FUNC_ARG1", "create_func_ucase"], "UNIQUE_USERS": ["UNIQUE_USERS", null], "UNIX_TIMESTAMP": ["UNIX_TIMESTAMP", null], "UPPER": ["FUNC_ARG1", "create_func_ucase"], "USER": ["USER", null], "VERSION": ["FUNC_ARG0", "create_func_version"], "WEEK": ["WEEK_SYM", null], "WEEKDAY": ["FUNC_ARG1", "create_func_weekday"], "YEARWEEK": ["YEARWEEK", null]};
  // keywords the grammar accepts as identifiers (the 'keyword' rule of sql_yacc.yy)
  const IDENT_KEYWORDS = new Set(["ACTION", "AFTER_SYM", "AGAINST", "AGGREGATE_SYM", "AUTOCOMMIT", "AUTO_INC", "AVG_ROW_LENGTH", "AVG_SYM", "BACKUP_SYM", "BEGIN_SYM", "BERKELEY_DB_SYM", "BIT_SYM", "BOOL_SYM", "CHANGED", "CHECKSUM_SYM", "CHECK_SYM", "COMMENT_SYM", "COMMITTED_SYM", "COMMIT_SYM", "COMPRESSED_SYM", "CONCURRENT", "DATA_SYM", "DATETIME", "DATE_SYM", "DAY_SYM", "DELAY_KEY_WRITE_SYM", "DO_SYM", "DUMPFILE", "DYNAMIC_SYM", "END", "ENUM", "ESCAPE_SYM", "EXTENDED_SYM", "FAST_SYM", "FILE_SYM", "FIRST_SYM", "FIXED_SYM", "FLUSH_SYM", "FULL", "GEMINI_SYM", "GLOBAL_SYM", "GRANTS", "HEAP_SYM", "HOSTS_SYM", "HOUR_SYM", "IDENTIFIED_SYM", "INNOBASE_SYM", "ISAM_SYM", "ISOLATION", "LEVEL_SYM", "LOCAL_SYM", "LOCKS_SYM", "LOGS_SYM", "MASTER_CONNECT_RETRY_SYM", "MASTER_HOST_SYM", "MASTER_LOG_FILE_SYM", "MASTER_LOG_POS_SYM", "MASTER_PASSWORD_SYM", "MASTER_PORT_SYM", "MASTER_SYM", "MASTER_USER_SYM", "MAX_ROWS", "MEDIUM_SYM", "MERGE_SYM", "MINUTE_SYM", "MIN_ROWS", "MODE_SYM", "MODIFY_SYM", "MONTH_SYM", "MYISAM_SYM", "NATIONAL_SYM", "NCHAR_SYM", "NO_SYM", "OPEN_SYM", "PACK_KEYS_SYM", "PASSWORD", "PROCESS", "PROCESSLIST_SYM", "QUICK", "RAID_0_SYM", "RAID_CHUNKS", "RAID_CHUNKSIZE", "RAID_STRIPED_SYM", "RAID_TYPE", "RELOAD", "REPAIR", "REPEATABLE_SYM", "RESET_SYM", "RESTORE_SYM", "ROLLBACK_SYM", "ROWS_SYM", "ROW_FORMAT_SYM", "ROW_SYM", "SECOND_SYM", "SERIALIZABLE_SYM", "SESSION_SYM", "SHARE_SYM", "SHUTDOWN", "SLAVE", "START_SYM", "STATUS_SYM", "STOP_SYM", "STRING_SYM", "TEMPORARY", "TEXT_SYM", "TIMESTAMP", "TIME_SYM", "TRANSACTION_SYM", "TRUNCATE_SYM", "TYPE_SYM", "UDF_SYM", "UNCOMMITTED_SYM", "VARIABLES", "WORK_SYM", "YEAR_SYM"]);

  // ---------------------------------------------------------------------------
  // The lexer (sql/sql_lex.cc yylex()). Tokens: { tok, str, start, line }
  // where tok is a grammar token name ('IDENT', 'NUM', 'SELECT_SYM', ...) or
  // the character itself, str the token text (unescaped for strings) and
  // start the tok_start offset that error messages quote from.
  // ---------------------------------------------------------------------------
  const S_START = 0, S_CHAR = 1, S_IDENT = 2, S_IDENT_SEP = 3, S_IDENT_START = 4, S_FOUND_IDENT = 5,
    S_SIGNED_NUMBER = 6, S_REAL = 7, S_HEX_NUMBER = 8, S_CMP_OP = 9, S_LONG_CMP_OP = 10, S_STRING = 11,
    S_COMMENT = 12, S_END = 13, S_OPERATOR_OR_IDENT = 14, S_NUMBER_IDENT = 15, S_INT_OR_REAL = 16,
    S_REAL_OR_POINT = 17, S_BOOL = 18, S_EOL = 19, S_ESCAPE = 20, S_LONG_COMMENT = 21, S_END_LONG_COMMENT = 22,
    S_COLON = 23, S_SET_VAR = 24, S_USER_END = 25, S_HOSTNAME = 26, S_SKIP = 27, S_USER_VARIABLE_DELIMITER = 28;
  const STATE_MAP = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    STATE_MAP[i] = my_isalpha(i) ? S_IDENT : my_isdigit(i) ? S_NUMBER_IDENT : !my_isgraph(i) ? S_SKIP : S_CHAR;
  }
  for (const [ch, st] of [['_', S_IDENT], ['$', S_IDENT], ["'", S_STRING], ['"', S_STRING], ['-', S_SIGNED_NUMBER],
    ['+', S_SIGNED_NUMBER], ['.', S_REAL_OR_POINT], ['>', S_CMP_OP], ['=', S_CMP_OP], ['!', S_CMP_OP], ['<', S_LONG_CMP_OP],
    ['&', S_BOOL], ['|', S_BOOL], ['#', S_COMMENT], [';', S_COLON], [':', S_SET_VAR], ['\\', S_ESCAPE], ['/', S_LONG_COMMENT],
    ['*', S_END_LONG_COMMENT], ['@', S_USER_END], ['`', S_USER_VARIABLE_DELIMITER]]) STATE_MAP[ch.charCodeAt(0)] = st;
  STATE_MAP[0] = S_EOL;
  const MYSQL_VERSION_ID = 32349;

  // int_token(): NUM, LONG_NUM or REAL_NUM by magnitude
  function int_token(str) {
    let s = str, neg = false;
    if (s.length < 10) return 'NUM';
    if (s[0] === '+') s = s.slice(1); else if (s[0] === '-') { s = s.slice(1); neg = true; }
    s = s.replace(/^0+/, '');
    if (s.length < 10) return 'NUM';
    const cmp = (lim, smaller, bigger) => (s <= lim ? smaller : bigger);
    if (neg) {
      if (s.length === 10) return cmp('2147483648', 'NUM', 'LONG_NUM');
      if (s.length < 19) return 'LONG_NUM';
      if (s.length > 19) return 'REAL_NUM';
      return cmp('9223372036854775808', 'LONG_NUM', 'REAL_NUM');
    }
    if (s.length === 10) return cmp('2147483647', 'NUM', 'LONG_NUM');
    if (s.length < 19) return 'LONG_NUM';
    if (s.length > 19) return 'REAL_NUM';
    return cmp('9223372036854775807', 'LONG_NUM', 'REAL_NUM');
  }

  class Lexer {
    constructor(query) {
      const z = query.indexOf('\0');          // the query buffer is a C string
      this.q = z >= 0 ? query.slice(0, z) : query;
      this.ptr = 0;
      this.next_state = S_START;
      this.line = 1;
      this.in_comment = false;
      this.found_comment = false;
      this.buf = [];                            // lookahead
    }
    peekc(o = 0) { const p = this.ptr + o; return p < this.q.length ? cc(this.q, p) : 0; }
    get() { const c = this.ptr < this.q.length ? cc(this.q, this.ptr) : 0; this.ptr++; return c; }
    unget() { this.ptr--; }
    peek(n = 0) { while (this.buf.length <= n) this.buf.push(this.lex()); return this.buf[n]; }
    next() { return this.buf.length ? this.buf.shift() : this.lex(); }
    // re-lex the lookahead (the parser changed next_state)
    relex() { if (this.buf.length) { this.ptr = this.buf[0].start0; this.next_state = this.buf[0].state0; this.buf = []; } }
    tok(tok, str, start) { return { tok, str, start, line: this.line }; }
    keyword(start, len, isFunc) {
      const name = caseUp(this.q.substr(start, len));
      let t = SYMBOLS[name];
      if (t) return { tok: t, name };
      if (isFunc && FUNCTIONS[name]) return { tok: FUNCTIONS[name][0], name, create: FUNCTIONS[name][1] };
      return null;
    }
    lex() {
      const start0 = this.ptr, state0 = this.next_state;
      const t = this.lex1();
      t.start0 = start0; t.state0 = state0;
      t.end = this.ptr;
      return t;
    }
    lex1() {
      let tok_start = this.ptr, c = 0;
      const prev_state = this.next_state;
      let state = this.next_state;
      this.next_state = S_OPERATOR_OR_IDENT;
      const q = this.q;
      for (;;) {
        switch (state) {
          case S_OPERATOR_OR_IDENT:
          case S_START:
            for (c = this.get(); STATE_MAP[c] === S_SKIP; c = this.get()) if (c === 10) this.line++;
            tok_start = this.ptr - 1;
            state = STATE_MAP[c];
            break;
          case S_ESCAPE:
            if (this.get() === 78) return this.tok('NULL_SYM', '\\N', tok_start);  // \N
            // fall through
          case S_CHAR:
          case S_SKIP: {
            this.ptr = tok_start;
            c = this.get();
            if (c !== 41) this.next_state = S_START;        // allow signed numbers after anything but ')'
            const t = this.tok(String.fromCharCode(c), String.fromCharCode(c), tok_start);
            if (c === 44) t.start = this.ptr;                // ',': tok_start points at the next item
            if (c === 0) { t.tok = 'END_OF_INPUT'; this.next_state = S_END; }
            return t;
          }
          case S_IDENT: {
            while (STATE_MAP[c = this.get()] === S_IDENT || STATE_MAP[c] === S_NUMBER_IDENT);
            const length = this.ptr - tok_start - 1;
            if (c === 46 && (STATE_MAP[this.peekc()] === S_IDENT || STATE_MAP[this.peekc()] === S_NUMBER_IDENT)) {
              this.next_state = S_IDENT_SEP;
            } else {
              this.unget();
              const kw = this.keyword(tok_start, length, c === 40);
              if (kw) {
                this.next_state = kw.tok === 'NULL_SYM' ? S_OPERATOR_OR_IDENT : S_START;
                const t = this.tok(kw.tok, q.substr(tok_start, length), tok_start);
                t.kw = kw.name; t.create = kw.create;
                return t;
              }
              this.get();
            }
            this.unget();
            return this.tok('IDENT', q.substr(tok_start, length), tok_start);
          }
          case S_IDENT_SEP:
            this.next_state = S_IDENT_START;
            c = this.get();
            return this.tok('.', '.', tok_start = this.ptr - 1);
          case S_NUMBER_IDENT: {
            while (my_isdigit(c = this.get()));
            if (STATE_MAP[c] !== S_IDENT) { state = S_INT_OR_REAL; break; }
            if (c === 101 || c === 69) {                    // 1e10
              const p = this.peekc();
              if (my_isdigit(p) || ((c = this.get()) === 43 || c === 45)) {
                if (my_isdigit(this.peekc())) {
                  this.get();
                  while (my_isdigit(this.get()));
                  this.unget();
                  return this.tok('FLOAT_NUM', q.slice(tok_start, this.ptr), tok_start);
                }
              }
              this.unget();
            } else if (c === 120 && this.ptr - tok_start === 2 && q[tok_start] === '0') {   // 0x..
              while (my_isxdigit(c = this.get()));
              if (this.ptr - tok_start >= 4) {
                this.unget();
                return this.tok('HEX_NUM', q.slice(tok_start + 2, this.ptr), tok_start);
              }
              this.unget();
            }
          }
          // fall through
          case S_IDENT_START:
            while (STATE_MAP[c = this.get()] === S_IDENT || STATE_MAP[c] === S_NUMBER_IDENT);
            if (c === 46 && (STATE_MAP[this.peekc()] === S_IDENT || STATE_MAP[this.peekc()] === S_NUMBER_IDENT)) this.next_state = S_IDENT_SEP;
            // fall through
          case S_FOUND_IDENT:
            this.unget();
            return this.tok('IDENT', q.slice(tok_start, this.ptr), tok_start);
          case S_USER_VARIABLE_DELIMITER: {       // `quoted identifier`
            const st = this.ptr;
            while ((c = this.get()) && STATE_MAP[c] !== S_USER_VARIABLE_DELIMITER && c !== 255);
            this.unget();
            const t = this.tok('IDENT', q.slice(st, this.ptr), st);
            t.quoted = true;
            if (STATE_MAP[this.peekc()] === S_USER_VARIABLE_DELIMITER) this.get();
            return t;
          }
          case S_SIGNED_NUMBER:
            if (prev_state === S_OPERATOR_OR_IDENT) {
              if (c === 45 && this.peekc() === 45 && my_isspace(this.peekc(1))) state = S_COMMENT;
              else state = S_CHAR;
              break;
            }
            if (!my_isdigit(c = this.get()) || this.peekc() === 120) {
              if (c !== 46) {
                if (c === 45 && my_isspace(this.peekc())) state = S_COMMENT;
                else state = S_CHAR;
                break;
              }
              this.unget();
            }
            while (my_isdigit(c = this.get()));
            if ((c === 101 || c === 69) && (this.peekc() === 43 || this.peekc() === 45 || my_isdigit(this.peekc()))) {
              this.unget(); c = 46;
            }
            // fall through
          case S_INT_OR_REAL:
            if (c !== 46) {
              this.unget();
              const str = q.slice(tok_start, this.ptr);
              return this.tok(int_token(str), str, tok_start);
            }
            // fall through
          case S_REAL:
            while (my_isdigit(c = this.get()));
            if (c === 101 || c === 69) {
              c = this.get();
              if (c === 45 || c === 43) c = this.get();
              if (!my_isdigit(c)) { state = S_CHAR; break; }
              while (my_isdigit(this.get()));
              this.unget();
              return this.tok('FLOAT_NUM', q.slice(tok_start, this.ptr), tok_start);
            }
            this.unget();
            return this.tok('REAL_NUM', q.slice(tok_start, this.ptr), tok_start);
          case S_CMP_OP:
            if (STATE_MAP[this.peekc()] === S_CMP_OP || STATE_MAP[this.peekc()] === S_LONG_CMP_OP) this.get();
            {
              const kw = this.keyword(tok_start, this.ptr - tok_start, false);
              if (kw) { this.next_state = S_START; return this.tok(kw.tok, q.slice(tok_start, this.ptr), tok_start); }
            }
            state = S_CHAR;
            break;
          case S_LONG_CMP_OP:
            if (STATE_MAP[this.peekc()] === S_CMP_OP || STATE_MAP[this.peekc()] === S_LONG_CMP_OP) {
              this.get();
              if (STATE_MAP[this.peekc()] === S_CMP_OP) this.get();
            }
            {
              const kw = this.keyword(tok_start, this.ptr - tok_start, false);
              if (kw) { this.next_state = S_START; return this.tok(kw.tok, q.slice(tok_start, this.ptr), tok_start); }
            }
            state = S_CHAR;
            break;
          case S_BOOL:
            if (c !== this.peekc()) { state = S_CHAR; break; }
            this.get();
            this.next_state = S_START;
            return this.tok(this.keyword(tok_start, 2, false).tok, q.slice(tok_start, this.ptr), tok_start);
          case S_STRING: {
            const s = this.getText(c, tok_start);
            if (s === null) { state = S_CHAR; break; }
            return this.tok('TEXT_STRING', s, tok_start);
          }
          case S_COMMENT:
            this.found_comment = true;
            while ((c = this.get()) !== 10 && c);
            this.unget();
            state = S_START;
            break;
          case S_LONG_COMMENT:
            if (this.peekc() !== 42) { state = S_CHAR; break; }
            this.get();
            this.found_comment = true;
            if (this.peekc() === 33) {                 // /*! MySQL code */
              let version = MYSQL_VERSION_ID;
              this.get();
              state = S_START;
              if (my_isdigit(this.peekc())) {
                const m = q.slice(this.ptr).match(/^\d+/);
                version = parseInt(m[0], 10);
                this.ptr += m[0].length;
              }
              if (version <= MYSQL_VERSION_ID) { this.in_comment = true; break; }
            }
            while (this.ptr < q.length && ((c = this.get()) !== 42 || this.peekc() !== 47)) if (c === 10) this.line++;
            if (this.ptr < q.length) this.get();
            state = S_START;
            break;
          case S_END_LONG_COMMENT:
            if (this.in_comment && this.peekc() === 47) { this.get(); this.in_comment = false; state = S_START; }
            else state = S_CHAR;
            break;
          case S_SET_VAR:
            if (this.peekc() !== 61) { state = S_CHAR; break; }
            this.get();
            return this.tok('SET_VAR', ':=', tok_start);
          case S_COLON:
            if (this.peekc()) { state = S_CHAR; break; }
            // fall through
          case S_EOL:
            this.next_state = S_END;
            return this.tok('END_OF_INPUT', '', tok_start);
          case S_END:
            this.next_state = S_END;
            return this.tok('END', '', this.q.length);
          case S_REAL_OR_POINT:
            if (my_isdigit(this.peekc())) state = S_REAL;
            else { state = S_CHAR; this.next_state = S_IDENT_START; }
            break;
          case S_USER_END: {
            const p = STATE_MAP[this.peekc()];
            if (p === S_STRING || p === S_USER_VARIABLE_DELIMITER);
            else if (p === S_USER_END) { this.next_state = S_USER_END; this.get(); }
            else this.next_state = S_HOSTNAME;
            return this.tok('@', '@', tok_start);
          }
          case S_HOSTNAME:
            for (c = this.get(); my_isalnum(c) || c === 46 || c === 95 || c === 36; c = this.get());
            this.unget();
            return this.tok('LEX_HOSTNAME', q.slice(tok_start, this.ptr), tok_start);
          default:
            state = S_CHAR;
        }
      }
    }
    // get_text(): an unescaped string literal
    getText(sep, tok_start) {
      const q = this.q;
      let found_escape = false;
      while (this.ptr < q.length) {
        const c = this.get();
        if (c === 92) {
          found_escape = true;
          if (this.ptr >= q.length) return null;
          this.ptr++;
        } else if (c === sep) {
          if (this.peekc() === sep && this.ptr < q.length) { this.ptr++; found_escape = true; continue; }
          const raw = q.slice(tok_start + 1, this.ptr - 1);
          if (!found_escape) return raw;
          let out = '';
          for (let i = 0; i < raw.length; i++) {
            const ch = raw[i];
            if (ch === '\\' && i + 1 < raw.length) {
              const e = raw[++i];
              switch (e) {
                case 'n': out += '\n'; break;
                case 't': out += '\t'; break;
                case 'r': out += '\r'; break;
                case 'b': out += '\b'; break;
                case '0': out += '\0'; break;
                case 'Z': out += '\x1a'; break;
                case '_': case '%': out += '\\' + e; break;
                default: out += e;
              }
            } else if (cc(raw, i) === sep) { out += ch; i++; }
            else out += ch;
          }
          return out;
        }
      }
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // The parser (sql/sql_yacc.yy): recursive descent over the same grammar,
  // building Items like the yacc actions do. A syntax error is reported at
  // the token yacc would have failed on, quoting the query from there.
  // ---------------------------------------------------------------------------
  const INTERVAL_TOKENS = {
    DAY_HOUR_SYM: 'DAY_HOUR', DAY_MINUTE_SYM: 'DAY_MINUTE', DAY_SECOND_SYM: 'DAY_SECOND', DAY_SYM: 'DAY',
    HOUR_MINUTE_SYM: 'HOUR_MINUTE', HOUR_SECOND_SYM: 'HOUR_SECOND', HOUR_SYM: 'HOUR', MINUTE_SECOND_SYM: 'MINUTE_SECOND',
    MINUTE_SYM: 'MINUTE', MONTH_SYM: 'MONTH', SECOND_SYM: 'SECOND', YEAR_MONTH_SYM: 'YEAR_MONTH', YEAR_SYM: 'YEAR',
  };
  // operator precedence (the %left/%right lines of sql_yacc.yy)
  const P_OR = 1, P_AND = 2, P_BETWEEN = 3, P_CMP = 4, P_BITOR = 5, P_BITAND = 6, P_SHIFT = 7, P_ADD = 8, P_MUL = 9, P_NEG = 10;
  const BINOPS = {
    OR: [P_OR], OR_OR_CONCAT: [P_OR], AND: [P_AND],
    EQ: [P_CMP], EQUAL_SYM: [P_CMP], GE: [P_CMP], GT_SYM: [P_CMP], LE: [P_CMP], LT: [P_CMP], NE: [P_CMP],
    '|': [P_BITOR], '&': [P_BITAND], SHIFT_LEFT: [P_SHIFT], SHIFT_RIGHT: [P_SHIFT],
    '+': [P_ADD], '-': [P_ADD], '*': [P_MUL], '/': [P_MUL], '%': [P_MUL],
  };

  class Parser {
    constructor(query) {
      this.query = query;
      this.lx = new Lexer(query);
      this.in_sum_expr = 0;
      this.create_refs = false;
      this.lex = { options: {}, sql_command: null };
    }
    get t() { return this.lx.peek(0); }
    peek(n) { return this.lx.peek(n); }
    shift() { const t = this.lx.next(); this.last = t; return t; }
    fail(tok) {
      tok = tok || this.t;
      const q = this.lx.q;
      const at = tok.tok === 'END' || tok.tok === 'END_OF_INPUT' ? q.length : tok.start;
      throw parseError(q.slice(at), tok.line);
    }
    is(tok) { return this.t.tok === tok; }
    accept(tok) { if (this.t.tok === tok) { this.shift(); return true; } return false; }
    expect(tok) { if (this.t.tok !== tok) this.fail(); return this.shift(); }
    // end of the previous token: yacc's tok_end when the lookahead is read
    endPos() { return this.last ? this.last.end : 0; }

    // ident: IDENT | keyword
    isIdent(t = this.t) { return t.tok === 'IDENT' || IDENT_KEYWORDS.has(t.tok); }
    ident() {
      const t = this.t;
      if (!this.isIdent(t)) this.fail();
      this.shift();
      return t.str;
    }
    identOrText() {
      if (this.is('TEXT_STRING') || this.is('LEX_HOSTNAME')) return this.shift().str;
      return this.ident();
    }
    // table_ident: ident | ident '.' ident | '.' ident
    tableIdent() {
      if (this.accept('.')) return { db: null, table: this.ident() };
      const a = this.ident();
      if (this.accept('.')) return { db: a, table: this.ident() };
      return { db: null, table: a };
    }

    // ------------------------------------------------------------ statements
    parse() {
      const lx = this.lx;
      if (this.is('END_OF_INPUT')) {
        this.shift();
        if (!lx.found_comment) throw myError(ER.EMPTY_QUERY);
        return { cmd: 'empty' };
      }
      const st = this.verb();
      if (!this.is('END_OF_INPUT')) this.fail();
      return st;
    }
    verb() {
      const k = this.t.tok;
      switch (k) {
        case 'SELECT_SYM': return this.select();
        case 'INSERT': return this.insert(false);
        case 'REPLACE': return this.insert(true);
        case 'UPDATE_SYM': return this.update();
        case 'DELETE_SYM': return this.del();
        case 'CREATE': return this.create();
        case 'DROP': return this.drop();
        case 'ALTER': return this.alter();
        case 'RENAME': return this.rename();
        case 'SHOW': return this.show();
        case 'DESC': case 'DESCRIBE': return this.describe();
        case 'USE_SYM': { this.shift(); return { cmd: 'use', db: this.ident() }; }
        case 'TRUNCATE_SYM': { this.shift(); this.accept('TABLE_SYM'); return { cmd: 'truncate', table: this.tableIdent() }; }
        case 'SET': return this.set();
        case 'LOCK_SYM': return this.lock();
        case 'UNLOCK_SYM': { this.shift(); if (!this.accept('TABLE_SYM')) this.expect('TABLES'); return { cmd: 'unlock' }; }
        case 'BEGIN_SYM': { this.shift(); this.accept('WORK_SYM'); return { cmd: 'begin' }; }
        case 'COMMIT_SYM': this.shift(); return { cmd: 'commit' };
        case 'ROLLBACK_SYM': this.shift(); return { cmd: 'rollback' };
        case 'OPTIMIZE': case 'ANALYZE_SYM': case 'CHECK_SYM': case 'REPAIR': return this.tableMaint();
        case 'FLUSH_SYM': return this.flush();
        case 'DO_SYM': { this.shift(); return { cmd: 'do', values: this.exprList() }; }
        case 'KILL_SYM': { this.shift(); return { cmd: 'kill', expr: this.expr() }; }
        case 'GRANT': case 'REVOKE': return this.grant();
        case 'LOAD': return this.load();
        case 'RESET_SYM': case 'PURGE': case 'SLAVE': case 'CHANGE': case 'BACKUP_SYM': case 'RESTORE_SYM': return this.misc();
        default: this.fail();
      }
    }

    // SELECT
    select() {
      this.expect('SELECT_SYM');
      const sel = this.newSelect();
      this.selectOptions(sel);
      this.selectItemList(sel);
      // select_into: [select_from] | opt_into select_from | select_from opt_into
      if (this.is('INTO')) { this.optInto(sel); this.selectFrom(sel); }
      else if (this.is('FROM')) { this.selectFrom(sel); if (this.is('INTO')) this.optInto(sel); }
      this.selectLockType(sel);
      return sel;
    }
    newSelect() {
      return { cmd: 'select', options: {}, items: [], tables: [], where: null, group: [], having: null, order: [],
        limit: null, offset: 0, into: null, procedure: null };
    }
    selectOptions(sel) {
      for (;;) {
        const k = this.t.tok;
        if (k === 'STRAIGHT_JOIN') sel.options.straight_join = true;
        else if (k === 'HIGH_PRIORITY' || k === 'SQL_SMALL_RESULT' || k === 'SQL_BIG_RESULT' || k === 'SQL_BUFFER_RESULT' || k === 'ALL');
        else if (k === 'DISTINCT') sel.options.distinct = true;
        else break;
        this.shift();
      }
    }
    selectItemList(sel) {
      if (this.is('*')) { this.shift(); sel.items.push(new Item_field(null, null, '*')); return; }
      for (;;) {
        const t0 = this.t;
        const start = t0.start;
        let item;
        // table_wild: ident '.' '*' | ident '.' ident '.' '*'
        if (this.isIdent(t0) && this.peek(1).tok === '.' && this.peek(2).tok === '*') {
          const tab = this.ident(); this.shift(); this.shift();
          item = new Item_field(null, tab, '*');
        } else if (this.isIdent(t0) && this.peek(1).tok === '.' && this.isIdent(this.peek(2)) && this.peek(3).tok === '.' && this.peek(4).tok === '*') {
          const db = this.ident(); this.shift(); const tab = this.ident(); this.shift(); this.shift();
          item = new Item_field(db, tab, '*');
        } else item = this.expr();
        const end = this.endPos();
        // select_alias
        let alias = null;
        if (this.accept('AS')) alias = this.is('TEXT_STRING') ? this.shift().str : this.ident();
        else if (this.is('TEXT_STRING')) alias = this.shift().str;
        else if (this.isIdent()) alias = this.ident();
        if (alias !== null) item.set_name(alias, true);
        else if (!item.name) item.set_name(this.lx.q.slice(start, end));
        sel.items.push(item);
        if (!this.accept(',')) break;
      }
    }
    optInto(sel) {
      this.expect('INTO');
      if (this.accept('OUTFILE')) sel.into = { outfile: this.expect('TEXT_STRING').str, dump: false };
      else if (this.accept('DUMPFILE')) sel.into = { outfile: this.expect('TEXT_STRING').str, dump: true };
      else this.fail();
      if (!sel.into.dump) this.fieldTerms(sel.into);
    }
    fieldTerms(ex) {
      if (this.accept('COLUMNS')) {
        let any = false;
        for (;;) {
          if (this.accept('TERMINATED')) { this.expect('BY'); ex.field_term = this.textString(); }
          else if (this.accept('OPTIONALLY')) { this.expect('ENCLOSED'); this.expect('BY'); ex.enclosed = this.textString(); ex.opt_enclosed = true; }
          else if (this.accept('ENCLOSED')) { this.expect('BY'); ex.enclosed = this.textString(); }
          else if (this.accept('ESCAPED')) { this.expect('BY'); ex.escaped = this.textString(); }
          else { if (!any) this.fail(); break; }
          any = true;
        }
      }
      if (this.accept('LINES')) {
        let any = false;
        for (;;) {
          if (this.accept('TERMINATED')) { this.expect('BY'); ex.line_term = this.textString(); }
          else if (this.accept('STARTING')) { this.expect('BY'); ex.line_start = this.textString(); }
          else { if (!any) this.fail(); break; }
          any = true;
        }
      }
    }
    textString() {
      if (this.is('TEXT_STRING')) return this.shift().str;
      if (this.is('HEX_NUM')) return hexBytes(this.shift().str);
      this.fail();
    }
    selectFrom(sel) {
      this.expect('FROM');
      this.joinTableList(sel);
      if (this.accept('WHERE')) sel.where = this.expr();
      if (this.is('GROUP')) { this.shift(); this.expect('BY'); sel.group = this.orderList(); }
      if (this.is('HAVING')) {
        this.shift();
        this.create_refs = true;
        sel.having = this.expr();
        this.create_refs = false;
      }
      if (this.is('ORDER_SYM')) { this.shift(); this.expect('BY'); sel.order = this.orderList(); }
      this.limitClause(sel);
      if (this.accept('PROCEDURE')) {
        sel.procedure = { name: this.ident(), args: [] };
        this.expect('(');
        if (!this.is(')')) sel.procedure.args = this.exprList();
        this.expect(')');
      }
    }
    selectLockType() {
      if (this.accept('FOR_SYM')) this.expect('UPDATE_SYM');
      else if (this.accept('LOCK_SYM')) { this.expect('IN_SYM'); this.expect('SHARE_SYM'); this.expect('MODE_SYM'); }
    }
    orderList() {
      const list = [];
      for (;;) {
        const item = this.expr();
        let asc = true;
        if (this.accept('ASC'));
        else if (this.accept('DESC')) asc = false;
        list.push({ item, asc });
        if (!this.accept(',')) break;
      }
      return list;
    }
    ulongNum() {
      const k = this.t.tok;
      if (k === 'NUM' || k === 'REAL_NUM' || k === 'FLOAT_NUM') return strtoul(this.shift().str).v;
      this.fail();
    }
    ulonglongNum() {
      const k = this.t.tok;
      if (k === 'NUM') return BigInt(strtoul(this.shift().str).v);
      if (k === 'LONG_NUM' || k === 'REAL_NUM' || k === 'FLOAT_NUM') return strtoull(this.shift().str).v;
      this.fail();
    }
    limitClause(sel) {
      if (!this.accept('LIMIT')) return;
      const a = this.ulongNum();
      if (this.accept(',')) { sel.offset = a; sel.limit = this.ulongNum(); }
      else sel.limit = a;
    }
    // join_table_list (left recursive: t1 JOIN t2 ON .. JOIN t3 ...)
    joinTableList(sel) {
      if (this.is('(')) {
        // '(' join_table_list ')'
        this.shift();
        this.joinTableList(sel);
        this.expect(')');
      } else sel.tables.push(this.joinTable(sel));
      for (;;) {
        const k = this.t.tok;
        let tab;
        if (k === ',' || k === 'JOIN_SYM') { this.shift(); tab = this.joinTable(sel); }
        else if (k === 'CROSS') { this.shift(); this.expect('JOIN_SYM'); tab = this.joinTable(sel); }
        else if (k === 'STRAIGHT_JOIN') { this.shift(); tab = this.joinTable(sel); tab.straight = true; }
        else if (k === 'INNER_SYM') {
          this.shift(); this.expect('JOIN_SYM');
          tab = this.joinTable(sel);
          const prev = sel.tables[sel.tables.length - 1];
          if (this.accept('ON')) tab.on = this.expr();
          else { this.expect('USING'); tab.on = this.usingList(prev, tab); }
        } else if (k === 'LEFT' || k === 'RIGHT') {
          this.shift(); this.accept('OUTER'); this.expect('JOIN_SYM');
          tab = this.joinTable(sel);
          const prev = sel.tables[sel.tables.length - 1];
          let cond;
          if (this.accept('ON')) cond = this.expr();
          else { this.expect('USING'); cond = this.usingList(prev, tab); }
          if (k === 'LEFT') { tab.on = cond; tab.outer = 'left'; }
          else { prev.on = cond; prev.outer = 'right'; tab.rightOf = prev; }
        } else if (k === 'NATURAL') {
          this.shift();
          let outer = null;
          if (this.accept('LEFT')) { outer = 'left'; this.accept('OUTER'); }
          else if (this.accept('RIGHT')) { outer = 'right'; this.accept('OUTER'); }
          this.expect('JOIN_SYM');
          tab = this.joinTable(sel);
          const prev = sel.tables[sel.tables.length - 1];
          if (outer === 'right') { prev.natural = tab; prev.outer = 'right'; tab.rightOf = prev; }
          else { tab.natural = prev; if (outer) tab.outer = 'left'; }
        } else break;
        sel.tables.push(tab);
      }
    }
    usingList(t1, t2) {
      this.expect('(');
      let cond = null;
      for (;;) {
        const name = this.ident();
        const eq = new Item_func_eq(new Item_field(t1.db, t1.alias, name), new Item_field(t2.db, t2.alias, name));
        cond = cond ? new Item_cond_and(eq, cond) : eq;
        if (!this.accept(',')) break;
      }
      this.expect(')');
      return cond;
    }
    joinTable(sel) {
      if (this.is('{')) {
        // ODBC: { OJ t1 LEFT OUTER JOIN t2 ON expr }
        this.shift(); this.ident();
        sel.tables.push(this.joinTable(sel));
        this.expect('LEFT'); this.expect('OUTER'); this.expect('JOIN_SYM');
        const tab = this.joinTable(sel);
        this.expect('ON');
        tab.on = this.expr(); tab.outer = 'left';
        this.expect('}');
        return tab;
      }
      const ti = this.tableIdent();
      let alias = null;
      if (this.accept('AS') || this.accept('EQ')) alias = this.ident();
      else if (this.isIdent()) alias = this.ident();
      const tab = { db: ti.db, name: ti.table, alias: alias || ti.table, aliased: !!alias };
      // opt_key_definition: USE|IGNORE INDEX|KEY (...)
      if (this.is('USE_SYM') || this.is('IGNORE_SYM')) {
        this.shift();
        if (!this.accept('KEY_SYM')) this.expect('INDEX');
        this.expect('(');
        for (;;) { if (!this.accept('PRIMARY_SYM')) this.ident(); if (!this.accept(',')) break; }
        this.expect(')');
      }
      return tab;
    }

    // ---------------------------------------------------------- expressions
    exprList() {
      const list = [this.expr()];
      while (this.accept(',')) list.push(this.expr());
      return list;
    }
    expr(minPrec = 0) {
      let left = this.simpleExpr();
      for (;;) {
        const t = this.t, k = t.tok;
        // postfix / special forms at comparison level
        if (k === 'IN_SYM' || k === 'LIKE' || k === 'REGEXP' || k === 'IS' || k === 'BETWEEN_SYM' ||
          (k === 'NOT' && ['IN_SYM', 'LIKE', 'REGEXP', 'BETWEEN_SYM'].includes(this.peek(1).tok))) {
          const neg = k === 'NOT';
          const op = neg ? this.peek(1).tok : k;
          const prec = op === 'BETWEEN_SYM' ? P_BETWEEN : P_CMP;
          if (prec < minPrec) break;
          if (neg) this.shift();
          this.shift();
          let it;
          if (op === 'IN_SYM') {
            this.expect('(');
            it = new Item_func_in(left, this.exprList());
            this.expect(')');
          } else if (op === 'LIKE') {
            const pat = this.simpleExpr();
            let esc = '\\';
            if (this.accept('ESCAPE_SYM')) esc = this.expect('TEXT_STRING').str;
            it = new Item_func_like(left, pat, esc);
          } else if (op === 'REGEXP') {
            it = new Item_func_regex(left, this.expr(P_CMP + 1));
          } else if (op === 'IS') {
            if (this.accept('NOT')) { this.expect('NULL_SYM'); it = new Item_func_isnotnull(left); }
            else { this.expect('NULL_SYM'); it = new Item_func_isnull(left); }
          } else {
            const lo = this.expr(P_BETWEEN + 1);
            this.expect('AND');
            const hi = this.expr(P_BETWEEN + 1);
            it = new Item_func_between(left, lo, hi);
          }
          left = neg ? new Item_func_not(it) : it;
          continue;
        }
        const op = BINOPS[k];
        if (!op || op[0] < minPrec) break;
        this.shift();
        if ((k === '+' || k === '-') && this.is('INTERVAL_SYM')) {
          this.shift();
          const n = this.expr();
          const unit = this.interval();
          left = new Item_date_add_interval(left, n, unit, k === '-');
          continue;
        }
        const right = this.expr(op[0] + 1);
        left = makeBinop(k, left, right);
      }
      return left;
    }
    interval() {
      const u = INTERVAL_TOKENS[this.t.tok];
      if (!u) this.fail();
      this.shift();
      return u;
    }
    literal() {
      const t = this.t;
      switch (t.tok) {
        case 'TEXT_STRING': {
          this.shift();
          let s = t.str;
          while (this.is('TEXT_STRING')) s += this.shift().str;   // text_literal TEXT_STRING
          return new Item_string(s, t.str);
        }
        case 'NUM': this.shift(); return new Item_int(t.str, BigInt(atol(t.str)), t.str.length);
        case 'LONG_NUM': this.shift(); return new Item_int(t.str, t.str[0] === '-' ? strtoll(t.str).v : toLL(strtoull(t.str).v), t.str.length);
        case 'REAL_NUM': this.shift(); return new Item_real(t.str);
        case 'FLOAT_NUM': this.shift(); return Item_float(t.str);
        case 'NULL_SYM': this.shift(); return new Item_null();
        case 'HEX_NUM': this.shift(); return new Item_varbinary(t.str);
        case 'DATE_SYM': case 'TIME_SYM': case 'TIMESTAMP':
          if (this.peek(1).tok === 'TEXT_STRING') { this.shift(); return this.literal(); }
      }
      return null;
    }
    // simple_ident: ident | ident.ident | .ident.ident | ident.ident.ident
    simpleIdent() {
      let db = null, table = null, field;
      if (this.accept('.')) { table = this.ident(); this.expect('.'); field = this.ident(); }
      else {
        field = this.ident();
        if (this.is('.')) {
          this.shift();
          table = field; field = this.ident();
          if (this.is('.')) { this.shift(); db = table; table = field; field = this.ident(); }
        }
      }
      return !this.create_refs || this.in_sum_expr > 0 ? new Item_field(db, table, field) : new Item_ref(db, table, field);
    }
    args(n) {
      this.expect('(');
      const a = [];
      for (let i = 0; i < n; i++) { if (i) this.expect(','); a.push(this.expr()); }
      this.expect(')');
      return a;
    }
    simpleExpr() {
      const t = this.t, k = t.tok;
      const lit = this.literal();
      if (lit) return lit;
      switch (k) {
        case '@': {
          this.shift();
          if (this.accept('@')) return getSystemVar(this.identOrText(), this);
          const name = this.identOrText();
          if (this.accept('SET_VAR')) return new Item_func_set_user_var(name, this.expr());
          return new Item_func_get_user_var(name);
        }
        case '-': this.shift(); return new Item_func_neg(this.expr(P_NEG));
        case '~': this.shift(); return new Item_func_bit_neg(this.expr(P_NEG));
        case 'NOT': case '!': this.shift(); return new Item_func_not(this.expr(P_NEG));
        case 'BINARY': this.shift(); return new Item_func_binary(this.expr(P_NEG));
        case '(': { this.shift(); const e = this.expr(); this.expect(')'); return e; }
        case '{': { this.shift(); this.ident(); const e = this.expr(); this.expect('}'); return e; }
        case 'CASE_SYM': {
          this.shift();
          const first = this.is('WHEN_SYM') ? null : this.expr();
          this.expect('WHEN_SYM');
          const list = [];
          for (;;) {
            list.push(this.expr()); this.expect('THEN_SYM'); list.push(this.expr());
            if (!this.accept('WHEN_SYM')) break;
          }
          const els = this.accept('ELSE') ? this.expr() : null;
          this.expect('END');
          return new Item_func_case(list, first, els);
        }
        case 'MATCH': {
          this.shift();
          const paren = this.accept('(');
          const fields = [this.simpleIdent()];
          while (this.accept(',')) fields.push(this.simpleIdent());
          if (paren) this.expect(')');
          this.expect('AGAINST');
          this.expect('(');
          const e = this.expr();
          this.expect(')');
          return new Item_func_match(fields, e);
        }
        case 'INTERVAL_SYM': {
          this.shift();
          if (this.is('(')) {
            // INTERVAL(expr, list) or INTERVAL (expr) unit '+' expr
            this.shift();
            const e = this.expr();
            if (this.accept(',')) {
              const list = this.exprList();
              this.expect(')');
              return new Item_func_interval(e, list);
            }
            this.expect(')');
            const unit = this.interval();
            this.expect('+');
            return new Item_date_add_interval(this.expr(P_ADD + 1), e, unit, false);
          }
          const e = this.expr();
          const unit = this.interval();
          this.expect('+');
          return new Item_date_add_interval(this.expr(P_ADD + 1), e, unit, false);
        }
        case 'AVG_SYM': case 'BIT_AND': case 'BIT_OR': case 'COUNT_SYM': case 'MIN_SYM': case 'MAX_SYM':
        case 'STD_SYM': case 'SUM_SYM':
          return this.sumExpr();
      }
      if (FUNC_TOKENS[k]) return FUNC_TOKENS[k].call(this, t);
      if (this.isIdent(t) || k === '.') return this.simpleIdent();
      this.fail();
    }
    sumExpr() {
      const k = this.shift().tok;
      this.expect('(');
      let it;
      if (k === 'COUNT_SYM' && this.is('*')) { this.shift(); it = new Item_sum_count(new Item_int(null, 0n, 1)); }
      else if (k === 'COUNT_SYM' && this.is('DISTINCT')) {
        this.shift();
        it = new Item_sum_count_distinct(this.exprList());
      } else {
        this.in_sum_expr++;
        const a = this.expr();
        this.in_sum_expr--;
        it = k === 'AVG_SYM' ? new Item_sum_avg(a) : k === 'BIT_AND' ? new Item_sum_and(a) : k === 'BIT_OR' ? new Item_sum_or(a)
          : k === 'COUNT_SYM' ? new Item_sum_count(a) : k === 'MIN_SYM' ? new Item_sum_min(a) : k === 'MAX_SYM' ? new Item_sum_max(a)
          : k === 'STD_SYM' ? new Item_sum_std(a) : new Item_sum_sum(a);
      }
      this.expect(')');
      return it;
    }

    // ----------------------------------------------------------- INSERT etc
    insert(replace) {
      this.shift();
      const st = { cmd: replace ? 'replace' : 'insert', ignore: false, fields: [], values: [], select: null };
      if (replace) { if (!this.accept('LOW_PRIORITY')) this.accept('DELAYED_SYM'); }
      else {
        if (this.accept('LOW_PRIORITY') || this.accept('DELAYED_SYM') || this.accept('HIGH_PRIORITY'));
        if (this.accept('IGNORE_SYM')) st.ignore = true;
      }
      this.accept('INTO');
      st.table = this.tableIdent();
      if (this.is('SET')) {
        this.shift();
        const row = [];
        for (;;) {
          st.fields.push(this.simpleIdent());
          if (!this.accept('EQ')) this.expect('SET_VAR');
          row.push(this.expr());
          if (!this.accept(',')) break;
        }
        st.values.push(row);
        return st;
      }
      if (this.is('(')) {
        this.shift();
        if (!this.accept(')')) {
          for (;;) {
            // insert_ident: simple_ident | table_wild
            if (this.isIdent() && this.peek(1).tok === '.' && this.peek(2).tok === '*') {
              const tab = this.ident(); this.shift(); this.shift();
              st.fields.push(new Item_field(null, tab, '*'));
            } else st.fields.push(this.simpleIdent());
            if (!this.accept(',')) break;
          }
          this.expect(')');
        }
      }
      if (this.accept('VALUES')) {
        for (;;) {
          this.expect('(');
          const row = [];
          if (!this.is(')')) { row.push(this.expr()); while (this.accept(',')) row.push(this.expr()); }
          this.expect(')');
          st.values.push(row);
          if (!this.accept(',')) break;
        }
        return st;
      }
      if (this.is('SELECT_SYM')) {
        this.shift();
        const sel = this.newSelect();
        this.selectOptions(sel);
        this.selectItemList(sel);
        this.selectFrom(sel);
        this.selectLockType(sel);
        st.select = sel;
        return st;
      }
      this.fail();
    }
    update() {
      this.shift();
      const st = { cmd: 'update', ignore: false, fields: [], values: [], where: null, limit: null };
      this.accept('LOW_PRIORITY');
      if (this.accept('IGNORE_SYM')) st.ignore = true;
      st.table = this.tableIdent();
      this.expect('SET');
      for (;;) {
        st.fields.push(this.simpleIdent());
        if (!this.accept('EQ')) this.expect('SET_VAR');
        st.values.push(this.expr());
        if (!this.accept(',')) break;
      }
      if (this.accept('WHERE')) st.where = this.expr();
      if (this.accept('LIMIT')) st.limit = this.ulonglongNum();
      return st;
    }
    del() {
      this.shift();
      const st = { cmd: 'delete', where: null, limit: null };
      while (this.accept('QUICK') || this.accept('LOW_PRIORITY'));
      this.expect('FROM');
      st.table = this.tableIdent();
      if (this.accept('WHERE')) st.where = this.expr();
      if (this.accept('LIMIT')) st.limit = this.ulonglongNum();
      return st;
    }
    tableList() {
      const list = [this.tableIdent()];
      while (this.accept(',')) list.push(this.tableIdent());
      return list;
    }

    // ------------------------------------------------------ CREATE / ALTER
    create() {
      this.shift();
      if (this.accept('DATABASE')) {
        const ifNot = this.optIfNotExists();
        return { cmd: 'create_db', name: this.ident(), ifNotExists: ifNot };
      }
      if (this.is('UNIQUE_SYM') || this.is('FULLTEXT_SYM') || this.is('INDEX')) {
        const kind = this.accept('UNIQUE_SYM') ? 'UNIQUE' : this.accept('FULLTEXT_SYM') ? 'FULLTEXT' : 'MULTIPLE';
        this.expect('INDEX');
        const name = this.ident();
        this.expect('ON');
        const table = this.tableIdent();
        this.expect('(');
        const cols = this.keyList();
        this.expect(')');
        return { cmd: 'create_index', table, key: { type: kind, name, cols } };
      }
      if (this.is('AGGREGATE_SYM') || this.is('UDF_SYM')) {
        this.accept('AGGREGATE_SYM'); this.expect('UDF_SYM');
        const name = this.ident();
        this.expect('UDF_RETURNS_SYM'); this.shift(); this.expect('UDF_SONAME_SYM');
        return { cmd: 'create_function', name, soname: this.expect('TEXT_STRING').str };
      }
      const temporary = this.accept('TEMPORARY');
      this.expect('TABLE_SYM');
      const ifNot = this.optIfNotExists();
      const table = this.tableIdent();
      const st = { cmd: 'create_table', table, temporary, ifNotExists: ifNot, fields: [], keys: [], options: {}, select: null, duplicates: 'error' };
      if (this.is('(')) {
        this.shift();
        this.fieldList(st);
        this.expect(')');
      }
      this.createTableOptions(st.options);
      // create3: opt_duplicate opt_as SELECT ...
      if (this.accept('REPLACE')) st.duplicates = 'replace';
      else if (this.accept('IGNORE_SYM')) st.duplicates = 'ignore';
      if (st.duplicates !== 'error' || this.is('AS') || this.is('SELECT_SYM')) {
        this.accept('AS');
        this.expect('SELECT_SYM');
        const sel = this.newSelect();
        this.selectOptions(sel);
        this.selectItemList(sel);
        if (this.is('FROM')) { this.selectFrom(sel); this.selectLockType(sel); }
        st.select = sel;
      }
      return st;
    }
    optIfNotExists() {
      if (!this.is('IF')) return false;
      this.shift(); this.expect('NOT'); this.expect('EXISTS');
      return true;
    }
    createTableOptions(o) {
      for (;;) {
        const k = this.t.tok;
        const eq = () => this.expect('EQ');
        if (k === 'TYPE_SYM') {
          this.shift(); eq();
          const tt = this.shift().tok;
          const types = { ISAM_SYM: 'ISAM', MYISAM_SYM: 'MYISAM', MERGE_SYM: 'MRG_MYISAM', HEAP_SYM: 'HEAP', BERKELEY_DB_SYM: 'BDB', INNOBASE_SYM: 'INNODB', GEMINI_SYM: 'GEMINI' };
          if (!types[tt]) this.fail(this.last);
          o.type = types[tt];
        } else if (k === 'MAX_ROWS' || k === 'MIN_ROWS') { this.shift(); eq(); o[k.toLowerCase()] = this.ulonglongNum(); }
        else if (k === 'AVG_ROW_LENGTH') { this.shift(); eq(); o.avg_row_length = this.ulongNum(); }
        else if (k === 'PASSWORD') { this.shift(); eq(); this.expect('TEXT_STRING'); }
        else if (k === 'COMMENT_SYM') { this.shift(); eq(); o.comment = this.expect('TEXT_STRING').str; }
        else if (k === 'AUTO_INC') { this.shift(); eq(); o.auto_increment = this.ulonglongNum(); }
        else if (k === 'PACK_KEYS_SYM' || k === 'CHECKSUM_SYM' || k === 'DELAY_KEY_WRITE_SYM') { this.shift(); eq(); o[k] = this.ulongNum(); }
        else if (k === 'ROW_FORMAT_SYM') {
          this.shift(); eq();
          const r = this.shift().tok;
          const rt = { DEFAULT: 'DEFAULT', FIXED_SYM: 'FIXED', DYNAMIC_SYM: 'DYNAMIC', COMPRESSED_SYM: 'COMPRESSED' };
          if (!rt[r]) this.fail(this.last);
          o.row_format = rt[r];
        } else if (k === 'RAID_TYPE') { this.shift(); eq(); if (!this.accept('RAID_STRIPED_SYM') && !this.accept('RAID_0_SYM')) this.ulongNum(); }
        else if (k === 'RAID_CHUNKS' || k === 'RAID_CHUNKSIZE') { this.shift(); eq(); this.ulongNum(); }
        else if (k === 'UNION_SYM') { this.shift(); eq(); this.expect('('); o.union = this.tableList(); this.expect(')'); }
        else break;
      }
    }
    fieldList(st) {
      for (;;) {
        this.fieldListItem(st);
        if (!this.accept(',')) break;
      }
    }
    keyList() {
      const cols = [];
      for (;;) {
        const name = this.ident();
        let len = null;
        if (this.accept('(')) { len = atol(this.expect('NUM').str); this.expect(')'); }
        this.accept('ASC') || this.accept('DESC');
        cols.push({ name, length: len });
        if (!this.accept(',')) break;
      }
      return cols;
    }
    optConstraint() { if (this.accept('CONSTRAINT')) { if (this.isIdent()) this.fieldIdent(); } }
    fieldIdent() {
      if (this.accept('.')) return this.ident();
      const a = this.ident();
      if (this.accept('.')) return this.ident();
      return a;
    }
    fieldListItem(st) {
      const k = this.t.tok;
      // key_type opt_ident '(' key_list ')'
      let keyType = null;
      if (k === 'CONSTRAINT') {
        this.optConstraint();
        const k2 = this.t.tok;
        if (k2 === 'PRIMARY_SYM') { this.shift(); this.expect('KEY_SYM'); keyType = 'PRIMARY'; }
        else if (k2 === 'UNIQUE_SYM') { this.shift(); if (!this.accept('KEY_SYM')) this.accept('INDEX'); keyType = 'UNIQUE'; }
        else if (k2 === 'FOREIGN') return this.foreignKey();
        else if (k2 === 'CHECK_SYM') return this.checkConstraint();
        else this.fail();
      } else if (k === 'PRIMARY_SYM') { this.shift(); this.expect('KEY_SYM'); keyType = 'PRIMARY'; }
      else if (k === 'KEY_SYM' || k === 'INDEX') { this.shift(); keyType = 'MULTIPLE'; }
      else if (k === 'FULLTEXT_SYM') { this.shift(); if (!this.accept('KEY_SYM')) this.accept('INDEX'); keyType = 'FULLTEXT'; }
      else if (k === 'UNIQUE_SYM') { this.shift(); if (!this.accept('KEY_SYM')) this.accept('INDEX'); keyType = 'UNIQUE'; }
      else if (k === 'FOREIGN') return this.foreignKey();
      else if (k === 'CHECK_SYM') return this.checkConstraint();
      if (keyType) {
        let name = null;
        if (!this.is('(')) name = this.fieldIdent();
        this.expect('(');
        const cols = this.keyList();
        this.expect(')');
        st.keys.push({ type: keyType, name, cols });
        return;
      }
      const f = this.fieldSpec(this.fieldIdent());
      st.fields.push(f);
      // add_field_to_list(): PRIMARY KEY and UNIQUE column attributes add keys
      if (f.flags & F.PRI_KEY) st.keys.push({ type: 'PRIMARY', name: null, cols: [{ name: f.name, length: null }] });
      if (f.flags & (F.UNIQUE | F.UNIQUE_KEY)) st.keys.push({ type: 'UNIQUE', name: null, cols: [{ name: f.name, length: null }] });
      if (this.is('REFERENCES')) this.references();
    }
    foreignKey() {
      this.expect('FOREIGN'); this.expect('KEY_SYM');
      if (!this.is('(')) this.fieldIdent();
      this.expect('('); this.keyList(); this.expect(')');
      this.references();
    }
    checkConstraint() { this.expect('CHECK_SYM'); this.expect('('); this.expr(); this.expect(')'); }
    references() {
      this.expect('REFERENCES');
      this.tableIdent();
      if (this.accept('(')) { this.keyList(); this.expect(')'); }
      for (;;) {
        if (this.accept('ON')) {
          if (!this.accept('DELETE_SYM')) this.expect('UPDATE_SYM');
          if (this.accept('RESTRICT') || this.accept('CASCADE'));
          else if (this.accept('SET')) { if (!this.accept('NULL_SYM')) this.expect('DEFAULT'); }
          else { this.expect('NO_SYM'); this.expect('ACTION'); }
        } else if (this.accept('MATCH')) { if (!this.accept('FULL')) this.expect('PARTIAL'); }
        else break;
      }
    }
    // field_spec: type opt_attribute
    fieldSpec(name) {
      const f = { name, type: null, length: null, decimals: null, flags: 0, def: undefined, interval: null, t: this.t };
      const k = this.shift().tok;
      const optLen = () => { if (this.accept('(')) { f.length = this.expect('NUM').str; this.expect(')'); } };
      const fieldOptions = () => {
        for (;;) {
          if (this.accept('UNSIGNED')) f.flags |= F.UNSIGNED;
          else if (this.accept('ZEROFILL')) f.flags |= F.UNSIGNED | F.ZEROFILL;
          else break;
        }
      };
      const floatOptions = () => {
        if (this.accept('(')) {
          f.length = this.expect('NUM').str;
          if (this.accept(',')) f.decimals = this.expect('NUM').str;
          this.expect(')');
        }
      };
      const optBinary = () => { if (this.accept('BINARY')) f.flags |= F.BINARY; };
      const INT = { INT_SYM: T.LONG, TINYINT: T.TINY, SMALLINT: T.SHORT, MEDIUMINT: T.INT24, BIGINT: T.LONGLONG };
      const isChar = k === 'CHAR_SYM' || k === 'NCHAR_SYM' || (k === 'NATIONAL_SYM' && this.is('CHAR_SYM'));
      if (INT[k] !== undefined) { f.type = INT[k]; optLen(); fieldOptions(); }
      else if (k === 'REAL' || k === 'DOUBLE_SYM') {
        f.type = T.DOUBLE;
        if (k === 'DOUBLE_SYM') this.accept('PRECISION');
        if (this.accept('(')) { f.length = this.expect('NUM').str; this.expect(','); f.decimals = this.expect('NUM').str; this.expect(')'); }
        fieldOptions();
      } else if (k === 'FLOAT_SYM') { f.type = T.FLOAT; floatOptions(); fieldOptions(); }
      else if (k === 'BIT_SYM') { f.type = T.TINY; optLen(); f.length = '1'; }
      else if (k === 'BOOL_SYM') { f.type = T.TINY; f.length = '1'; }
      else if (isChar) {
        if (k === 'NATIONAL_SYM') this.shift();
        if (this.accept('VARYING')) {
          this.expect('('); f.length = this.expect('NUM').str; this.expect(')'); optBinary(); f.type = T.VAR_STRING;
        } else if (k === 'NCHAR_SYM' && this.accept('VARCHAR')) {
          this.expect('('); f.length = this.expect('NUM').str; this.expect(')'); optBinary(); f.type = T.VAR_STRING;
        } else if (this.accept('(')) { f.length = this.expect('NUM').str; this.expect(')'); optBinary(); f.type = T.STRING; }
        else { f.length = '1'; optBinary(); f.type = T.STRING; }
      } else if (k === 'BINARY') { this.expect('('); f.length = this.expect('NUM').str; this.expect(')'); f.flags |= F.BINARY; f.type = T.STRING; }
      else if (k === 'VARCHAR' || (k === 'NATIONAL_SYM' && this.is('VARCHAR'))) {
        if (k === 'NATIONAL_SYM') this.shift();
        this.expect('('); f.length = this.expect('NUM').str; this.expect(')'); optBinary(); f.type = T.VAR_STRING;
      } else if (k === 'VARBINARY') { this.expect('('); f.length = this.expect('NUM').str; this.expect(')'); f.flags |= F.BINARY; f.type = T.VAR_STRING; }
      else if (k === 'YEAR_SYM') { f.type = T.YEAR; optLen(); fieldOptions(); }
      else if (k === 'DATE_SYM') f.type = T.DATE;
      else if (k === 'TIME_SYM') f.type = T.TIME;
      else if (k === 'TIMESTAMP') { f.type = T.TIMESTAMP; if (this.accept('(')) { f.length = this.expect('NUM').str; this.expect(')'); } }
      else if (k === 'DATETIME') f.type = T.DATETIME;
      else if (k === 'TINYBLOB') { f.flags |= F.BINARY; f.type = T.TINY_BLOB; }
      else if (k === 'BLOB_SYM') { f.flags |= F.BINARY; f.type = T.BLOB; }
      else if (k === 'MEDIUMBLOB') { f.flags |= F.BINARY; f.type = T.MEDIUM_BLOB; }
      else if (k === 'LONGBLOB') { f.flags |= F.BINARY; f.type = T.LONG_BLOB; }
      else if (k === 'LONG_SYM') {
        if (this.accept('VARBINARY')) { f.flags |= F.BINARY; f.type = T.MEDIUM_BLOB; }
        else if (this.accept('VARCHAR') || (this.is('CHAR_SYM') && this.peek(1).tok === 'VARYING' && this.shift() && this.shift())) f.type = T.MEDIUM_BLOB;
        else this.fail();
      } else if (k === 'TINYTEXT') f.type = T.TINY_BLOB;
      else if (k === 'TEXT_SYM') f.type = T.BLOB;
      else if (k === 'MEDIUMTEXT') f.type = T.MEDIUM_BLOB;
      else if (k === 'LONGTEXT') f.type = T.LONG_BLOB;
      else if (k === 'DECIMAL_SYM' || k === 'NUMERIC_SYM') { f.type = T.DECIMAL; floatOptions(); fieldOptions(); }
      else if (k === 'ENUM' || k === 'SET') {
        f.type = k === 'ENUM' ? T.ENUM : T.SET;
        this.expect('(');
        f.interval = [this.textString()];
        while (this.accept(',')) f.interval.push(this.textString());
        this.expect(')');
      } else this.fail(this.last);
      // opt_attribute
      for (;;) {
        if (this.accept('NULL_SYM')) f.flags &= ~F.NOT_NULL;
        else if (this.is('NOT') && this.peek(1).tok === 'NULL_SYM') { this.shift(); this.shift(); f.flags |= F.NOT_NULL; }
        else if (this.accept('DEFAULT')) { const l = this.literal(); if (!l) this.fail(); f.def = l; }
        else if (this.accept('AUTO_INC')) f.flags |= F.AUTO_INCREMENT | F.NOT_NULL;
        else if (this.is('PRIMARY_SYM')) { this.shift(); this.expect('KEY_SYM'); f.flags |= F.PRI_KEY | F.NOT_NULL; }
        else if (this.accept('UNIQUE_SYM')) { if (this.accept('KEY_SYM')) f.flags |= F.UNIQUE_KEY; else f.flags |= F.UNIQUE; }
        else break;
      }
      return f;
    }
    alter() {
      this.shift();
      const st = { cmd: 'alter', ignore: false, specs: [] };
      if (this.accept('IGNORE_SYM')) st.ignore = true;
      this.expect('TABLE_SYM');
      st.table = this.tableIdent();
      if (this.is('END_OF_INPUT')) return st;
      for (;;) {
        this.alterItem(st);
        if (!this.accept(',')) break;
      }
      return st;
    }
    alterItem(st) {
      const k = this.t.tok;
      if (k === 'ADD') {
        this.shift();
        this.accept('COLUMN_SYM');
        if (this.is('(')) {
          this.shift();
          const tmp = { fields: [], keys: [] };
          this.fieldList(tmp);
          this.expect(')');
          for (const f of tmp.fields) st.specs.push({ op: 'add_field', field: f });
          for (const key of tmp.keys) st.specs.push({ op: 'add_key', key });
          return;
        }
        const tmp = { fields: [], keys: [] };
        this.fieldListItem(tmp);
        let place = null;
        if (this.accept('AFTER_SYM')) place = { after: this.ident() };
        else if (this.accept('FIRST_SYM')) place = { first: true };
        for (const f of tmp.fields) st.specs.push({ op: 'add_field', field: f, place });
        for (const key of tmp.keys) st.specs.push({ op: 'add_key', key });
        return;
      }
      if (k === 'CHANGE' || k === 'MODIFY_SYM') {
        this.shift();
        this.accept('COLUMN_SYM');
        const old = this.fieldIdent();
        const name = k === 'CHANGE' ? this.fieldIdent() : old;
        const f = this.fieldSpec(name);
        let place = null;
        if (this.accept('AFTER_SYM')) place = { after: this.ident() };
        else if (this.accept('FIRST_SYM')) place = { first: true };
        st.specs.push({ op: 'change', old, field: f, place });
        return;
      }
      if (k === 'DROP') {
        this.shift();
        if (this.is('PRIMARY_SYM')) { this.shift(); this.expect('KEY_SYM'); st.specs.push({ op: 'drop_primary' }); return; }
        if (this.is('FOREIGN')) { this.shift(); this.expect('KEY_SYM'); if (this.isIdent()) this.fieldIdent(); return; }
        if (this.is('KEY_SYM') || this.is('INDEX')) { this.shift(); st.specs.push({ op: 'drop_key', name: this.fieldIdent() }); return; }
        this.accept('COLUMN_SYM');
        st.specs.push({ op: 'drop_field', name: this.fieldIdent() });
        this.accept('RESTRICT') || this.accept('CASCADE');
        return;
      }
      if (k === 'ALTER') {
        this.shift();
        this.accept('COLUMN_SYM');
        const name = this.fieldIdent();
        if (this.accept('SET')) { this.expect('DEFAULT'); const l = this.literal(); if (!l) this.fail(); st.specs.push({ op: 'alter_default', name, def: l }); }
        else { this.expect('DROP'); this.expect('DEFAULT'); st.specs.push({ op: 'alter_default', name, def: null }); }
        return;
      }
      if (k === 'RENAME') {
        this.shift();
        this.accept('TO_SYM') || this.accept('AS');
        this.accept('AS') || this.accept('EQ');
        st.specs.push({ op: 'rename', to: this.tableIdent() });
        return;
      }
      if (k === 'ORDER_SYM') { this.shift(); this.expect('BY'); st.specs.push({ op: 'order', list: this.orderList() }); return; }
      const opts = {};
      const before = this.t;
      this.createTableOptions(opts);
      if (this.t === before) this.fail();
      st.specs.push({ op: 'options', options: opts });
    }
    rename() {
      this.shift();
      if (!this.accept('TABLE_SYM')) this.expect('TABLES');
      const pairs = [];
      for (;;) {
        const from = this.tableIdent();
        this.expect('TO_SYM');
        pairs.push({ from, to: this.tableIdent() });
        if (!this.accept(',')) break;
      }
      return { cmd: 'rename', pairs };
    }
    drop() {
      this.shift();
      const k = this.t.tok;
      if (k === 'TABLE_SYM') {
        this.shift();
        const ifExists = this.is('IF') ? (this.shift(), this.expect('EXISTS'), true) : false;
        const tables = this.tableList();
        this.accept('RESTRICT') || this.accept('CASCADE');
        return { cmd: 'drop_table', tables, ifExists };
      }
      if (k === 'INDEX') {
        this.shift();
        const name = this.ident();
        this.expect('ON');
        return { cmd: 'drop_index', name, table: this.tableIdent() };
      }
      if (k === 'DATABASE') {
        this.shift();
        const ifExists = this.is('IF') ? (this.shift(), this.expect('EXISTS'), true) : false;
        return { cmd: 'drop_db', name: this.ident(), ifExists };
      }
      if (k === 'UDF_SYM') { this.shift(); return { cmd: 'drop_function', name: this.ident() }; }
      this.fail();
    }

    // ------------------------------------------------------------- SHOW etc
    wild() { return this.accept('LIKE') ? this.textString() : null; }
    optDb() { return this.accept('FROM') ? this.ident() : null; }
    show() {
      this.shift();
      const k = this.t.tok;
      const full = k === 'FULL' ? (this.shift(), true) : false;
      const k2 = this.t.tok;
      if (!full && k2 === 'DATABASES') { this.shift(); return { cmd: 'show_databases', wild: this.wild() }; }
      if (!full && k2 === 'TABLES') { this.shift(); const db = this.optDb(); return { cmd: 'show_tables', db, wild: this.wild() }; }
      if (!full && k2 === 'TABLE_SYM') { this.shift(); this.expect('STATUS_SYM'); const db = this.optDb(); return { cmd: 'show_table_status', db, wild: this.wild() }; }
      if (!full && k2 === 'OPEN_SYM') { this.shift(); this.expect('TABLES'); const db = this.optDb(); return { cmd: 'show_open_tables', db, wild: this.wild() }; }
      if (k2 === 'COLUMNS') {
        this.shift(); this.expect('FROM');
        const table = this.tableIdent();
        const db = this.optDb();
        if (db) table.db = db;
        return { cmd: 'show_fields', table, full, wild: this.wild() };
      }
      if (full && k2 === 'PROCESSLIST_SYM') { this.shift(); return { cmd: 'show_processlist', full }; }
      if (full) this.fail();
      if (k2 === 'MASTER_SYM') {
        this.shift();
        if (this.accept('LOGS_SYM')) return { cmd: 'show_binlogs' };
        this.expect('STATUS_SYM');
        return { cmd: 'show_master_status' };
      }
      if (k2 === 'KEYS' || k2 === 'INDEX') {
        this.shift(); this.expect('FROM');
        const table = this.tableIdent();
        const db = this.optDb();
        if (db) table.db = db;
        return { cmd: 'show_keys', table };
      }
      if (k2 === 'STATUS_SYM') { this.shift(); return { cmd: 'show_status', wild: this.wild() }; }
      if (k2 === 'PROCESSLIST_SYM') { this.shift(); return { cmd: 'show_processlist', full: false }; }
      if (k2 === 'VARIABLES') { this.shift(); return { cmd: 'show_variables', wild: this.wild() }; }
      if (k2 === 'LOGS_SYM') { this.shift(); return { cmd: 'show_logs' }; }
      if (k2 === 'GRANTS') {
        this.shift(); this.expect('FOR_SYM');
        const user = this.identOrText();
        let host = null;
        if (this.accept('@')) host = this.identOrText();
        return { cmd: 'show_grants', user, host };
      }
      if (k2 === 'CREATE') { this.shift(); this.expect('TABLE_SYM'); return { cmd: 'show_create', table: this.tableIdent() }; }
      if (k2 === 'SLAVE') { this.shift(); this.expect('STATUS_SYM'); return { cmd: 'show_slave_status' }; }
      this.fail();
    }
    describe() {
      this.shift();
      if (this.is('SELECT_SYM')) { const sel = this.select(); sel.describe = true; return sel; }
      const table = this.tableIdent();
      let wild = null;
      if (this.is('TEXT_STRING') || this.is('HEX_NUM')) wild = this.textString();
      else if (this.isIdent()) wild = this.ident();
      return { cmd: 'show_fields', table, full: false, wild };
    }
    set() {
      this.shift();
      this.accept('OPTION');
      const list = [];
      for (;;) {
        list.push(this.optionValue());
        if (!this.accept(',')) break;
      }
      return { cmd: 'set', list };
    }
    optionValue() {
      const k = this.t.tok;
      const equal = () => { if (!this.accept('EQ')) this.expect('SET_VAR'); };
      const OPTS = ['SQL_BIG_TABLES', 'SQL_BIG_SELECTS', 'SQL_LOG_OFF', 'SQL_LOG_UPDATE', 'SQL_LOG_BIN', 'SQL_WARNINGS',
        'SQL_LOW_PRIORITY_UPDATES', 'SQL_AUTO_IS_NULL', 'SQL_SAFE_UPDATES', 'SQL_BUFFER_RESULT', 'SQL_QUOTE_SHOW_CREATE'];
      if (OPTS.includes(k)) { this.shift(); equal(); return { opt: k, value: atol(this.expect('NUM').str) }; }
      if (k === 'AUTOCOMMIT') { this.shift(); equal(); return { opt: k, value: atol(this.expect('NUM').str) }; }
      if (k === 'SQL_SELECT_LIMIT' || k === 'SQL_MAX_JOIN_SIZE' || k === 'TIMESTAMP' || k === 'GEMINI_SPIN_RETRIES') {
        this.shift(); equal();
        if (this.accept('DEFAULT')) return { opt: k, value: null };
        return { opt: k, value: this.ulongNum() };
      }
      if (k === 'LAST_INSERT_ID' || k === 'INSERT_ID') { this.shift(); equal(); return { opt: k, value: this.ulonglongNum() }; }
      if (k === 'CHAR_SYM') {
        this.shift(); this.expect('SET');
        if (this.accept('DEFAULT')) return { opt: 'CHARSET', value: null };
        const name = this.expect('IDENT').str;
        return { opt: 'CHARSET', value: name };
      }
      if (k === 'PASSWORD') {
        this.shift();
        let user = null;
        if (this.accept('FOR_SYM')) { user = this.identOrText(); if (this.accept('@')) this.identOrText(); }
        equal();
        if (this.accept('PASSWORD')) { this.expect('('); this.expect('TEXT_STRING'); this.expect(')'); }
        else this.expect('TEXT_STRING');
        return { opt: 'PASSWORD', user };
      }
      if (k === '@') {
        this.shift();
        const name = this.identOrText();
        equal();
        return { opt: 'USER_VAR', name, expr: this.expr() };
      }
      if (k === 'SQL_SLAVE_SKIP_COUNTER') { this.shift(); equal(); return { opt: k, value: this.ulongNum() }; }
      if (k === 'GLOBAL_SYM' || k === 'SESSION_SYM' || k === 'TRANSACTION_SYM') {
        if (k !== 'TRANSACTION_SYM') this.shift();
        this.expect('TRANSACTION_SYM'); this.expect('ISOLATION'); this.expect('LEVEL_SYM');
        if (this.accept('READ_SYM')) { if (!this.accept('UNCOMMITTED_SYM')) this.expect('COMMITTED_SYM'); }
        else if (this.accept('REPEATABLE_SYM')) this.expect('READ_SYM');
        else this.expect('SERIALIZABLE_SYM');
        return { opt: 'ISOLATION' };
      }
      this.fail();
    }
    lock() {
      this.shift();
      if (!this.accept('TABLE_SYM')) this.expect('TABLES');
      const list = [];
      for (;;) {
        const t = this.tableIdent();
        let alias = null;
        if (this.accept('AS') || this.accept('EQ')) alias = this.ident();
        else if (this.isIdent()) alias = this.ident();
        let mode;
        if (this.accept('READ_SYM')) mode = this.accept('LOCAL_SYM') ? 'read_local' : 'read';
        else if (this.accept('WRITE_SYM')) mode = 'write';
        else if (this.accept('LOW_PRIORITY')) { this.expect('WRITE_SYM'); mode = 'write'; }
        else this.fail();
        list.push({ table: t, alias, mode });
        if (!this.accept(',')) break;
      }
      return { cmd: 'lock', list };
    }
    tableMaint() {
      const k = this.shift().tok;
      if (!this.accept('TABLE_SYM')) this.expect('TABLES');
      const tables = this.tableList();
      const opts = [];
      if (k !== 'OPTIMIZE') {
        if (this.accept('TYPE_SYM')) { this.expect('EQ'); }
        for (;;) {
          const m = this.t.tok;
          if (['QUICK', 'FAST_SYM', 'MEDIUM_SYM', 'EXTENDED_SYM', 'CHANGED'].includes(m)) { opts.push(m); this.shift(); } else break;
        }
      }
      const names = { OPTIMIZE: 'optimize', ANALYZE_SYM: 'analyze', CHECK_SYM: 'check', REPAIR: 'repair' };
      return { cmd: 'table_maint', op: names[k], tables, opts };
    }
    flush() {
      this.shift();
      for (;;) {
        const k = this.t.tok;
        if (k === 'TABLE_SYM' || k === 'TABLES') {
          this.shift();
          if (this.is('WITH')) { this.shift(); this.expect('READ_SYM'); this.expect('LOCK_SYM'); }
          else if (this.isIdent() || this.is('.')) this.tableList();
        } else if (['HOSTS_SYM', 'PRIVILEGES', 'LOGS_SYM', 'STATUS_SYM', 'SLAVE', 'MASTER_SYM'].includes(k)) this.shift();
        else this.fail();
        if (!this.accept(',')) break;
      }
      return { cmd: 'flush' };
    }
    grant() {
      const k = this.shift().tok;
      // privileges
      if (this.accept('ALL')) this.accept('PRIVILEGES');
      else {
        for (;;) {
          const p = this.t.tok;
          if (['SELECT_SYM', 'INSERT', 'UPDATE_SYM', 'REFERENCES'].includes(p)) {
            this.shift();
            if (this.accept('(')) { this.ident(); while (this.accept(',')) this.ident(); this.expect(')'); }
          } else if (['DELETE_SYM', 'USAGE', 'INDEX', 'ALTER', 'CREATE', 'DROP', 'RELOAD', 'SHUTDOWN', 'PROCESS', 'FILE_SYM'].includes(p)) this.shift();
          else if (p === 'GRANT') { this.shift(); this.expect('OPTION'); }
          else this.fail();
          if (!this.accept(',')) break;
        }
      }
      this.expect('ON');
      if (this.accept('*')) { if (this.accept('.')) this.expect('*'); }
      else if (this.isIdent() && this.peek(1).tok === '.' && this.peek(2).tok === '*') { this.ident(); this.shift(); this.shift(); }
      else this.tableIdent();
      this.expect(k === 'GRANT' ? 'TO_SYM' : 'FROM');
      for (;;) {
        this.identOrText();
        if (this.accept('@')) this.identOrText();
        if (this.accept('IDENTIFIED_SYM')) { this.expect('BY'); this.accept('PASSWORD'); this.expect('TEXT_STRING'); }
        if (!this.accept(',')) break;
      }
      if (k === 'GRANT' && this.accept('WITH')) { this.expect('GRANT'); this.expect('OPTION'); }
      return { cmd: k === 'GRANT' ? 'grant' : 'revoke' };
    }
    load() {
      this.shift();
      if (this.accept('TABLE_SYM')) { this.tableIdent(); this.expect('FROM'); this.expect('MASTER_SYM'); return { cmd: 'load_master' }; }
      this.expect('DATA_SYM');
      this.accept('CONCURRENT') || this.accept('LOW_PRIORITY');
      const local = this.accept('LOCAL_SYM');
      this.expect('INFILE');
      const st = { cmd: 'load', local, file: this.expect('TEXT_STRING').str, duplicates: 'error', fields: [] };
      if (this.accept('REPLACE')) st.duplicates = 'replace'; else if (this.accept('IGNORE_SYM')) st.duplicates = 'ignore';
      this.expect('INTO'); this.expect('TABLE_SYM');
      st.table = this.tableIdent();
      this.fieldTerms(st);
      if (this.accept('IGNORE_SYM')) { st.skip = atol(this.expect('NUM').str); this.expect('LINES'); }
      if (this.accept('(')) { if (!this.is(')')) { st.fields.push(this.simpleIdent()); while (this.accept(',')) st.fields.push(this.simpleIdent()); } this.expect(')'); }
      return st;
    }
    misc() {
      const k = this.shift().tok;
      if (k === 'RESET_SYM') { for (;;) { if (!this.accept('SLAVE')) this.expect('MASTER_SYM'); if (!this.accept(',')) break; } return { cmd: 'reset' }; }
      if (k === 'PURGE') { this.expect('MASTER_SYM'); this.expect('LOGS_SYM'); this.expect('TO_SYM'); this.expect('TEXT_STRING'); return { cmd: 'purge' }; }
      if (k === 'SLAVE') { if (!this.accept('START_SYM')) this.expect('STOP_SYM'); return { cmd: 'slave' }; }
      if (k === 'CHANGE') {
        this.expect('MASTER_SYM'); this.expect('TO_SYM');
        for (;;) {
          const m = this.shift().tok;
          if (!/^MASTER_/.test(m)) this.fail(this.last);
          this.expect('EQ');
          this.shift();
          if (!this.accept(',')) break;
        }
        return { cmd: 'change_master' };
      }
      // BACKUP / RESTORE
      if (!this.accept('TABLE_SYM')) this.expect('TABLES');
      const tables = this.tableList();
      this.expect(k === 'BACKUP_SYM' ? 'TO_SYM' : 'FROM');
      return { cmd: k === 'BACKUP_SYM' ? 'backup' : 'restore', tables, dir: this.expect('TEXT_STRING').str };
    }
  }
  function hexBytes(hex) {
    let out = '';
    let i = 0;
    if (hex.length % 2) out += String.fromCharCode(parseInt(hex[i++], 16));
    for (; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return out;
  }
  function makeBinop(k, a, b) {
    switch (k) {
      case 'OR': case 'OR_OR_CONCAT': return new Item_cond_or(a, b);
      case 'AND': return new Item_cond_and(a, b);
      case 'EQ': return new Item_func_eq(a, b);
      case 'EQUAL_SYM': return new Item_func_equal(a, b);
      case 'GE': return new Item_func_ge(a, b);
      case 'GT_SYM': return new Item_func_gt(a, b);
      case 'LE': return new Item_func_le(a, b);
      case 'LT': return new Item_func_lt(a, b);
      case 'NE': return new Item_func_ne(a, b);
      case '|': return new Item_func_bit_or(a, b);
      case '&': return new Item_func_bit_and(a, b);
      case 'SHIFT_LEFT': return new Item_func_shift_left(a, b);
      case 'SHIFT_RIGHT': return new Item_func_shift_right(a, b);
      case '+': return new Item_func_plus(a, b);
      case '-': return new Item_func_minus(a, b);
      case '*': return new Item_func_mul(a, b);
      case '/': return new Item_func_div(a, b);
      case '%': return new Item_func_mod(a, b);
    }
    throw new Error('binop ' + k);
  }

  // ---------------------------------------------------------------------------
  // Items (sql/item*.cc): expressions with MySQL's typing and evaluation.
  // val() is a double, val_int() a BigInt (longlong), val_str() a byte string
  // or null; each sets null_value like MySQL does.
  // ---------------------------------------------------------------------------
  const STRING_RESULT = 0, REAL_RESULT = 1, INT_RESULT = 2;
  const NOT_FIXED_DEC = 31, MAX_BLOB_WIDTH = 8192, MAX_FIELD_WIDTH = 256, MAX_FIELD_NAME = 34, DBL_DIG = 15;
  const RAND_TABLE_BIT = 1 << 30, ALL_TABLES = -1;
  // enum_field_types
  const T = {
    DECIMAL: 0, TINY: 1, SHORT: 2, LONG: 3, FLOAT: 4, DOUBLE: 5, NULL: 6, TIMESTAMP: 7, LONGLONG: 8, INT24: 9,
    DATE: 10, TIME: 11, DATETIME: 12, YEAR: 13, NEWDATE: 14, ENUM: 247, SET: 248, TINY_BLOB: 249, MEDIUM_BLOB: 250,
    LONG_BLOB: 251, BLOB: 252, VAR_STRING: 253, STRING: 254,
  };
  // field flags (include/mysql_com.h); the last ones are used while creating tables
  const F = {
    NOT_NULL: 1, PRI_KEY: 2, UNIQUE_KEY: 4, MULTIPLE_KEY: 8, BLOB: 16, UNSIGNED: 32, ZEROFILL: 64, BINARY: 128,
    ENUM: 256, AUTO_INCREMENT: 512, TIMESTAMP: 1024, SET: 2048, PART_KEY: 16384, GROUP: 32768, UNIQUE: 65536,
  };
  const item_cmp_type = (a, b) => (a === STRING_RESULT && b === STRING_RESULT ? STRING_RESULT : a === INT_RESULT && b === INT_RESULT ? INT_RESULT : REAL_RESULT);
  // (longlong) double on i386 (x87 fistp): out of range and NaN give LONGLONG_MIN
  const TWO63 = 9223372036854775808;
  function dbl2ll(d) {
    if (!(d > -TWO63 && d < TWO63)) return LL_MIN;
    return BigInt(Math.trunc(d));
  }
  const dbl2ulong = (d) => Number(BigInt.asUintN(32, dbl2ll(d)));
  const ll2dbl = (v) => Number(v);
  // String::set(double, decimals)
  const setDouble = (nr, dec) => (dec >= NOT_FIXED_DEC ? fmtG(nr, 14) : fmtF(nr, dec));
  function nr_of_decimals(s) {
    const i = s.indexOf('.');
    if (i < 0) return 0;
    let n = 0;
    while (i + 1 + n < s.length && my_isdigit(cc(s, i + 1 + n))) n++;
    return n;
  }
  const float_length = (item, dec) => (item.decimals !== NOT_FIXED_DEC ? DBL_DIG + 2 + dec : DBL_DIG + 8);

  let ITEM_ID = 0;
  class Item {
    constructor() {
      this.id = ++ITEM_ID;
      this.name = null;
      this.max_length = 0;
      this.decimals = 0;
      this.maybe_null = false;
      this.null_value = false;
      this.binary = false;
      this.with_sum_func = false;
    }
    set_name(s, alias) {
      if (alias) { this.name = s; return; }
      let i = 0;
      while (i < s.length && !my_isgraph(cc(s, i))) i++;
      this.name = s.slice(i, i + MAX_FIELD_WIDTH);
    }
    full_name() { return this.name !== null ? this.name : '???'; }
    result_type() { return REAL_RESULT; }
    fix_fields(ctx) { }
    used_tables() { return 0; }
    const_item() { return this.used_tables() === 0; }
    basic_const_item() { return false; }
    eq(item) { return this.type() === item.type() && this.name !== null && item.name !== null && strcaseeq(this.name, item.name); }
    get_date(t, fuzzy) {
      const res = this.val_str();
      if (res === null || str_to_TIME(res, t, fuzzy) === TS_NONE) { Object.assign(t, newTime()); return true; }
      return false;
    }
    get_time(t) {
      const res = this.val_str();
      if (res === null || str_to_time(res, t)) { Object.assign(t, newTime()); return true; }
      return false;
    }
    init_make_field(type) {
      return { table: '', name: this.name, flags: this.maybe_null ? 0 : F.NOT_NULL, type, length: this.max_length, decimals: this.decimals };
    }
    make_field() { return this.init_make_field(T.DOUBLE); }
    // Item::send()
    send() { return this.val_str(); }
    // Item::save_in_field()
    save_in_field(field) {
      const rt = this.result_type();
      if (rt === STRING_RESULT || (rt === REAL_RESULT && field.result_type() === STRING_RESULT)) {
        const r = this.val_str();
        if (this.null_value) return set_field_to_null(field);
        field.set_notnull();
        field.store_str(r);
      } else if (rt === REAL_RESULT) {
        const nr = this.val();
        if (this.null_value) return set_field_to_null(field);
        field.set_notnull();
        field.store_real(nr);
      } else {
        const nr = this.val_int();
        if (this.null_value) return set_field_to_null(field);
        field.set_notnull();
        field.store_int(nr);
      }
      return false;
    }
    children() { return []; }
    split_sum_func() { }
    walk(fn) { fn(this); for (const c of this.children()) if (c) c.walk(fn); }
  }
  // set_field_to_null(): NOT NULL columns get their "zero" value
  function set_field_to_null(field) {
    // (the value and the NULL flag share one slot here: set_null() is enough)
    if (field.real_maybe_null()) { field.set_null(); return false; }
    if (field.type() === T.TIMESTAMP) { field.set_time(); return false; }
    field.reset();
    if (field.auto_inc && field.table && field.table.next_number) return false;   // set in handler.cc
    if (THD.count_cuted_fields) { cut(); return false; }
    if (!THD.no_errors) throw myError(ER.BAD_NULL, field.field_name);
    return true;
  }

  class Item_null extends Item {
    constructor(name) { super(); this.maybe_null = this.null_value = true; this.name = name || 'NULL'; }
    type() { return 'NULL_ITEM'; }
    result_type() { return STRING_RESULT; }
    val() { this.null_value = true; return 0; }
    val_int() { this.null_value = true; return 0n; }
    val_str() { this.null_value = true; return null; }
    make_field() { const f = this.init_make_field(T.NULL); f.length = 4; return f; }
    save_in_field(field) { return set_field_to_null(field); }
    send() { return null; }
    basic_const_item() { return true; }
    eq(item) { return item.type() === this.type(); }
  }
  class Item_int extends Item {
    constructor(name, value, length) {
      super();
      this.value = value;
      this.max_length = length === undefined ? 21 : length;
      this.name = name;
    }
    type() { return 'INT_ITEM'; }
    result_type() { return INT_RESULT; }
    val_int() { this.null_value = false; return this.value; }
    val() { this.null_value = false; return Number(this.value); }
    val_str() { this.null_value = false; return this.value.toString(); }
    make_field() { return this.init_make_field(T.LONGLONG); }
    save_in_field(field) { field.set_notnull(); field.store_int(this.value); return false; }
    basic_const_item() { return true; }
  }
  class Item_real extends Item {
    constructor(str, value, decimals, length) {
      super();
      if (value === undefined) { this.value = atof(str); this.decimals = nr_of_decimals(str); this.max_length = str.length; }
      else { this.value = value; this.decimals = decimals; this.max_length = length; }
      this.name = str;
    }
    type() { return 'REAL_ITEM'; }
    val() { this.null_value = false; return this.value; }
    val_int() { this.null_value = false; return dbl2ll(this.value + (this.value > 0 ? 0.5 : -0.5)); }
    val_str() { this.null_value = false; return setDouble(this.value, this.decimals); }
    make_field() { return this.init_make_field(T.DOUBLE); }
    save_in_field(field) { field.set_notnull(); field.store_real(this.value); return false; }
    basic_const_item() { return true; }
  }
  function Item_float(str) {
    const it = new Item_real(str);
    it.decimals = NOT_FIXED_DEC;
    it.max_length = DBL_DIG + 8;
    return it;
  }
  class Item_string extends Item {
    constructor(str, name) {
      super();
      this.str_value = str;
      this.max_length = str.length;
      this.name = name === undefined ? str : name;
      this.decimals = NOT_FIXED_DEC;
    }
    type() { return 'STRING_ITEM'; }
    result_type() { return STRING_RESULT; }
    val() { this.null_value = false; return atof(this.str_value); }
    val_int() { this.null_value = false; return strtoll(this.str_value).v; }
    val_str() { this.null_value = false; return this.str_value; }
    make_field() { return this.init_make_field(T.STRING); }
    save_in_field(field) { field.set_notnull(); field.store_str(this.str_value); return false; }
    basic_const_item() { return true; }
  }
  class Item_varbinary extends Item {
    constructor(hex) {
      super();
      this.name = '0x' + hex;
      this.str_value = hexBytes(hex);
      this.max_length = (hex.length + 1) >> 1;
      this.binary = true;
    }
    type() { return 'VARBIN_ITEM'; }
    result_type() { return INT_RESULT; }
    val_int() {
      let v = 0n;
      const s = this.str_value.slice(-8);
      for (let i = 0; i < s.length; i++) v = (v << 8n) + BigInt(cc(s, i));
      return BigInt.asIntN(64, v);
    }
    val() { return Number(this.val_int()); }
    val_str() { return this.str_value; }
    make_field() { return this.init_make_field(T.STRING); }
    save_in_field(field) {
      field.set_notnull();
      if (field.result_type() === STRING_RESULT) field.store_str(this.str_value);
      else field.store_int(this.val_int());
      return false;
    }
  }

  // Item_field: a column of a table in the query
  class Item_field extends Item {
    constructor(db, table, field_name) {
      super();
      this.db_name = db;
      this.table_name = table;
      this.field_name = field_name;
      this.name = field_name;
      this.field = null;
      this.result_field = null;
    }
    type() { return 'FIELD_ITEM'; }
    full_name() {
      if (!this.table_name) return this.field_name;
      return (this.db_name ? this.db_name + '.' : '') + this.table_name + '.' + this.field_name;
    }
    set_field(f) {
      this.field = this.result_field = f;
      this.maybe_null = f.maybe_null();
      this.max_length = f.field_length;
      this.decimals = f.decimals();
      this.table_name = f.table_name;
      this.field_name = f.field_name;
      this.binary = f.binary();
    }
    fix_fields(ctx) {
      if (!this.field) this.set_field(find_field_in_tables(ctx, this));
    }
    result_type() { return this.field.result_type(); }
    used_tables() { return this.field.table.const_table ? 0 : this.field.table.map; }
    val_str() { if ((this.null_value = this.field.is_null())) return null; return this.field.val_str(); }
    val() { if ((this.null_value = this.field.is_null())) return 0; return this.field.val_real(); }
    val_int() { if ((this.null_value = this.field.is_null())) return 0n; return this.field.val_int(); }
    get_date(t, fuzzy) {
      if ((this.null_value = this.field.is_null()) || this.field.get_date(t, fuzzy)) { Object.assign(t, newTime()); return true; }
      return false;
    }
    get_time(t) {
      if ((this.null_value = this.field.is_null()) || this.field.get_time(t)) { Object.assign(t, newTime()); return true; }
      return false;
    }
    make_field() { const f = this.field.make_field(); if (this.name !== null) f.name = this.name; return f; }
    send() { return this.field.is_null() ? null : this.field.val_str(); }
    save_in_field(to) {
      if (this.field.is_null()) { this.null_value = true; return set_field_to_null(to); }
      to.set_notnull();
      field_conv(to, this.field);
      this.null_value = false;
      return false;
    }
    eq(item) { return item.type() === 'FIELD_ITEM' && item.field === this.field; }
  }
  // Item_ref: a HAVING reference to a select list item
  class Item_ref extends Item_field {
    constructor(db, table, field_name, ref) {
      super(db, table, field_name);
      this.ref = ref || null;
    }
    type() { return 'REF_ITEM'; }
    fix_fields(ctx) {
      if (!this.ref) {
        this.ref = find_item_in_list(ctx, this, ctx.items);
        this.max_length = this.ref.max_length;
        this.maybe_null = this.ref.maybe_null;
        this.decimals = this.ref.decimals;
        this.binary = this.ref.binary;
      }
    }
    result_type() { return this.ref.result_type(); }
    used_tables() { return this.ref.used_tables(); }
    val() { const v = this.ref.val_result ? this.ref.val_result() : this.ref.val(); this.null_value = this.ref.null_value; return v; }
    val_int() { const v = this.ref.val_int_result ? this.ref.val_int_result() : this.ref.val_int(); this.null_value = this.ref.null_value; return v; }
    val_str() { const v = this.ref.str_result ? this.ref.str_result() : this.ref.val_str(); this.null_value = this.ref.null_value; return v; }
    get_date(t, fuzzy) { return (this.null_value = this.ref.get_date(t, fuzzy)); }
    make_field() { return this.ref.make_field(); }
    send() { return this.ref.send(); }
    save_in_field(f) { return this.ref.save_in_field(f); }
    eq(item) { return this.ref.eq(item); }
  }

  // ---------------------------------------------------------------- functions
  class Item_func extends Item {
    constructor(args) {
      super();
      this.args = args || [];
      this.used_tables_cache = 0;
      this.const_item_cache = true;
      this.with_sum_func = this.args.some((a) => a && a.with_sum_func);
    }
    type() { return 'FUNC_ITEM'; }
    func_name() { return '?'; }
    children() { return this.args; }
    fix_fields(ctx) {
      this.binary = false;
      this.used_tables_cache = 0;
      this.const_item_cache = true;
      for (const a of this.args) {
        a.fix_fields(ctx);
        if (a.maybe_null) this.maybe_null = true;
        if (a.binary) this.binary = true;
        this.with_sum_func = this.with_sum_func || a.with_sum_func;
        this.used_tables_cache |= a.used_tables();
        this.const_item_cache = this.const_item_cache && a.const_item();
      }
      this.fix_length_and_dec();
    }
    fix_length_and_dec() { }
    used_tables() { return this.used_tables_cache; }
    const_item() { return this.const_item_cache; }
    update_used_tables() {
      this.used_tables_cache = 0;
      this.const_item_cache = true;
      for (const a of this.args) {
        if (a.update_used_tables) a.update_used_tables();
        this.used_tables_cache |= a.used_tables();
        this.const_item_cache = this.const_item_cache && a.const_item();
      }
    }
    fix_num_length_and_dec() {
      this.decimals = 0;
      for (const a of this.args) if (a.decimals > this.decimals) this.decimals = a.decimals;
      this.max_length = float_length(this, this.decimals);
    }
    make_field() {
      const rt = this.result_type();
      return this.init_make_field(rt === STRING_RESULT ? T.VAR_STRING : rt === INT_RESULT ? T.LONGLONG : T.DOUBLE);
    }
    eq(item) {
      if (this === item) return true;
      if (item.type() !== 'FUNC_ITEM' || this.constructor !== item.constructor || this.args.length !== item.args.length) return false;
      return this.args.every((a, i) => a.eq(item.args[i]));
    }
    get_arg0_date(t, fuzzy) { return (this.null_value = this.args[0].get_date(t, fuzzy)); }
    get_arg0_time(t) { return (this.null_value = this.args[0].get_time(t)); }
    // replace sum functions in the arguments by references (split_sum_func)
    split_sum_func(fields) {
      for (let i = 0; i < this.args.length; i++) this.args[i] = splitArg(this.args[i], fields);
    }
  }
  function splitArg(a, fields) {
    if (a.with_sum_func && a.type() !== 'SUM_FUNC_ITEM') { a.split_sum_func(fields); return a; }
    if (a.used_tables() || a.type() === 'SUM_FUNC_ITEM') {
      fields.unshift(a);
      const r = new Item_ref(null, null, a.name, a);
      r.max_length = a.max_length; r.decimals = a.decimals; r.maybe_null = a.maybe_null; r.binary = a.binary;
      r.hidden = a;
      return r;
    }
    return a;
  }
  class Item_real_func extends Item_func {
    val_str() { const nr = this.val(); return this.null_value ? null : setDouble(nr, this.decimals); }
    val_int() { return dbl2ll(this.val()); }
    result_type() { return REAL_RESULT; }
    fix_length_and_dec() { this.decimals = NOT_FIXED_DEC; this.max_length = float_length(this, this.decimals); }
  }
  class Item_int_func extends Item_func {
    val() { return Number(this.val_int()); }
    val_str() { const nr = this.val_int(); return this.null_value ? null : nr.toString(); }
    result_type() { return INT_RESULT; }
    fix_length_and_dec() { this.decimals = 0; this.max_length = 21; }
  }
  // Item_num_op: + - * / %
  class Item_num_op extends Item_func {
    constructor(a, b) { super([a, b]); this.hybrid_type = REAL_RESULT; }
    result_type() { return this.hybrid_type; }
    fix_length_and_dec() { this.fix_num_length_and_dec(); this.find_num_type(); }
    find_num_type() {
      if (this.args[0].result_type() === INT_RESULT && this.args[1].result_type() === INT_RESULT) this.hybrid_type = INT_RESULT;
    }
    val_str() {
      if (this.hybrid_type === INT_RESULT) { const nr = this.val_int(); return this.null_value ? null : nr.toString(); }
      const nr = this.val();
      return this.null_value ? null : setDouble(nr, this.decimals);
    }
    two(fnReal) {
      const v = fnReal(this.args[0].val(), this.args[1].val());
      if ((this.null_value = this.args[0].null_value || this.args[1].null_value)) return 0;
      return v;
    }
    twoInt(fn) {
      const v = fn(this.args[0].val_int(), this.args[1].val_int());
      if ((this.null_value = this.args[0].null_value || this.args[1].null_value)) return 0n;
      return BigInt.asIntN(64, v);
    }
  }
  class Item_func_plus extends Item_num_op {
    func_name() { return '+'; }
    val() { return this.two((a, b) => a + b); }
    val_int() { return this.hybrid_type === INT_RESULT ? this.twoInt((a, b) => a + b) : dbl2ll(this.val()); }
  }
  class Item_func_minus extends Item_num_op {
    func_name() { return '-'; }
    val() { return this.two((a, b) => a - b); }
    val_int() { return this.hybrid_type === INT_RESULT ? this.twoInt((a, b) => a - b) : dbl2ll(this.val()); }
  }
  class Item_func_mul extends Item_num_op {
    func_name() { return '*'; }
    val() { return this.two((a, b) => a * b); }
    val_int() { return this.hybrid_type === INT_RESULT ? this.twoInt((a, b) => a * b) : dbl2ll(this.val()); }
  }
  class Item_func_div extends Item_num_op {
    func_name() { return '/'; }
    val() {
      const a = this.args[0].val(), b = this.args[1].val();
      if ((this.null_value = b === 0 || this.args[0].null_value || this.args[1].null_value)) return 0;
      return a / b;
    }
    val_int() {
      if (this.hybrid_type === INT_RESULT) {
        const a = this.args[0].val_int(), b = this.args[1].val_int();
        if ((this.null_value = b === 0n || this.args[0].null_value || this.args[1].null_value)) return 0n;
        return BigInt.asIntN(64, a / b);
      }
      return dbl2ll(this.val());
    }
    fix_length_and_dec() {
      this.decimals = Math.max(this.args[0].decimals, this.args[1].decimals) + 2;
      this.max_length = this.args[0].max_length - this.args[0].decimals + this.decimals;
      const tmp = float_length(this, this.decimals);
      if (this.max_length > tmp) this.max_length = tmp;
      this.maybe_null = true;
    }
  }
  class Item_func_mod extends Item_num_op {
    func_name() { return '%'; }
    val() {
      const a = Math.floor(this.args[0].val() + 0.5), b = Math.floor(this.args[1].val() + 0.5);
      if ((this.null_value = b === 0 || this.args[0].null_value || this.args[1].null_value)) return 0;
      return a % b;
    }
    val_int() {
      const a = this.args[0].val_int(), b = this.args[1].val_int();
      if ((this.null_value = b === 0n || this.args[0].null_value || this.args[1].null_value)) return 0n;
      return a % b;
    }
    fix_length_and_dec() { this.max_length = this.args[1].max_length; this.decimals = 0; this.maybe_null = true; this.find_num_type(); }
  }
  // Item_num_func: unary with hybrid type
  class Item_num_func extends Item_func {
    constructor(a) { super([a]); this.hybrid_type = REAL_RESULT; }
    result_type() { return this.hybrid_type; }
    val_int() { return dbl2ll(this.val()); }
    val_str() {
      if (this.hybrid_type === INT_RESULT) { const nr = this.val_int(); return this.null_value ? null : nr.toString(); }
      const nr = this.val();
      return this.null_value ? null : setDouble(nr, this.decimals);
    }
    fix_length_and_dec() { this.fix_num_length_and_dec(); }
  }
  class Item_func_neg extends Item_num_func {
    func_name() { return '-'; }
    val() { const v = this.args[0].val(); this.null_value = this.args[0].null_value; return -v; }
    val_int() { const v = this.args[0].val_int(); this.null_value = this.args[0].null_value; return BigInt.asIntN(64, -v); }
    fix_length_and_dec() {
      this.decimals = this.args[0].decimals;
      this.max_length = this.args[0].max_length;
      this.hybrid_type = this.args[0].result_type() === INT_RESULT ? INT_RESULT : REAL_RESULT;
    }
  }
  class Item_func_abs extends Item_num_func {
    func_name() { return 'abs'; }
    val() { const v = this.args[0].val(); this.null_value = this.args[0].null_value; return Math.abs(v); }
    val_int() { const v = this.args[0].val_int(); this.null_value = this.args[0].null_value; return v >= 0n ? v : BigInt.asIntN(64, -v); }
    result_type() { return this.args[0].result_type() === INT_RESULT ? INT_RESULT : REAL_RESULT; }
    fix_length_and_dec() {
      this.decimals = this.args[0].decimals;
      this.max_length = this.args[0].max_length;
      this.hybrid_type = this.args[0].result_type() === INT_RESULT ? INT_RESULT : REAL_RESULT;
    }
  }
  // log, exp, sqrt, trig: Item_dec_func
  class Item_dec_func extends Item_real_func {
    constructor(args, name, fn, bad) { super(args); this.fname = name; this.fn = fn; this.bad = bad || (() => false); }
    func_name() { return this.fname; }
    fix_length_and_dec() { this.decimals = 6; this.max_length = float_length(this, this.decimals); this.maybe_null = true; }
    val() {
      const a = this.args[0].val();
      if (this.args[0].null_value) { this.null_value = true; return 0; }
      let b;
      if (this.args.length > 1) { b = this.args[1].val(); if (this.args[1].null_value) { this.null_value = true; return 0; } }
      if (this.bad(a, b)) { this.null_value = true; return 0; }
      this.null_value = false;
      const r = this.fn(a, b);
      if (this.fname !== 'pow' && this.fname !== 'exp' && this.fname !== 'log' && this.fname !== 'log10' && this.fname !== 'sqrt' && !isFinite(r)) { this.null_value = true; return 0; }
      return r;
    }
  }
  class Item_func_integer extends Item_int_func {
    fix_length_and_dec() {
      this.max_length = this.args[0].max_length - this.args[0].decimals + 1;
      const tmp = float_length(this, this.decimals);
      if (this.max_length > tmp) this.max_length = tmp;
      this.decimals = 0;
    }
  }
  class Item_func_ceiling extends Item_func_integer {
    func_name() { return 'ceiling'; }
    val_int() { const v = this.args[0].val(); this.null_value = this.args[0].null_value; return dbl2ll(Math.ceil(v)); }
  }
  class Item_func_floor extends Item_func_integer {
    func_name() { return 'floor'; }
    val_int() { const v = this.args[0].val(); this.null_value = this.args[0].null_value; return dbl2ll(Math.floor(v)); }
  }
  const rint = (x) => {                       // round half to even (x87 default rounding)
    const r = Math.round(x);
    return (Math.abs(x % 1) === 0.5) ? 2 * Math.round(x / 2) : r;
  };
  const LOG_10 = Array.from({ length: 32 }, (_, i) => Number('1e' + i));
  // floor(nr * p + 0.5) as i386 code computes it: the product and the sum are
  // x87 intermediates with a 64-bit mantissa, rounded to double only when
  // passed to floor() (so -0.00005 * 1e4 + 0.5 is a tiny negative number)
  const x87dv = new DataView(new ArrayBuffer(8));
  function floorHalfX87(nr, p) {
    const d = nr * p;
    if (!isFinite(d) || Math.abs(d) >= 2 ** 52 || nr === 0) return Math.floor(d + 0.5);
    x87dv.setFloat64(0, nr);
    const hi = x87dv.getUint32(0), lo = x87dv.getUint32(4);
    const sign = hi >>> 31 ? -1n : 1n;
    const bexp = (hi >>> 20) & 0x7ff;
    let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    if (bexp) m |= 1n << 52n;
    let e = (bexp || 1) - 1075;
    let P = m * BigInt(p);
    const bits = P.toString(2).length;
    if (bits > 64) {
      const sh = BigInt(bits - 64), rem = P & ((1n << sh) - 1n), half = 1n << (sh - 1n);
      P >>= sh;
      if (rem > half || (rem === half && (P & 1n))) P++;
      e += bits - 64;
    }
    if (e >= 0) return Number(sign * (P << BigInt(e)));
    const den = 1n << BigInt(-e);
    const num = 2n * sign * P + den, div = 2n * den;
    let q = num / div;
    if (num % div < 0n) q--;
    return Number(q);
  }
  class Item_func_round extends Item_real_func {
    constructor(a, b, trunc) { super([a, b]); this.truncate = trunc; }
    func_name() { return this.truncate ? 'truncate' : 'round'; }
    fix_length_and_dec() {
      this.max_length = this.args[0].max_length;
      this.decimals = this.args[0].decimals;
      if (this.args[1].const_item()) {
        const tmp = Number(BigInt.asIntN(32, this.args[1].val_int()));
        this.decimals = tmp < 0 ? 0 : tmp;
      }
    }
    val() {
      const value = this.args[0].val();
      const dec = Number(BigInt.asIntN(32, this.args[1].val_int()));
      const abs_dec = Math.abs(dec);
      if ((this.null_value = this.args[0].null_value || this.args[1].null_value)) return 0;
      const tmp = abs_dec < LOG_10.length ? LOG_10[abs_dec] : Math.pow(10, abs_dec);
      if (this.truncate) return dec < 0 ? Math.floor(value / tmp) * tmp : Math.floor(value * tmp) / tmp;
      return dec < 0 ? rint(value / tmp) * tmp : rint(value * tmp) / tmp;
    }
  }
  class Item_func_rand extends Item_real_func {
    func_name() { return 'rand'; }
    used_tables() { return RAND_TABLE_BIT; }
    const_item() { return false; }
    val() {
      const r = THD.conn.rand;
      if (this.args.length) {
        const tmp = Number(BigInt.asUintN(32, this.args[0].val_int())) + 55555555;
        const seed = tmp >>> 0;
        randominit(r, seed, Math.floor(seed / 2));
        this.args = [];
      }
      return rnd(r);
    }
  }
  function randominit(r, s1, s2) { r.max_value = 0x3FFFFFFF; r.seed1 = s1 % r.max_value; r.seed2 = s2 % r.max_value; }
  function rnd(r) {
    r.seed1 = (r.seed1 * 3 + r.seed2) % r.max_value;
    r.seed2 = (r.seed1 + r.seed2 + 33) % r.max_value;
    return r.seed1 / r.max_value;
  }
  class Item_func_sign extends Item_int_func {
    func_name() { return 'sign'; }
    val_int() { const v = this.args[0].val(); this.null_value = this.args[0].null_value; return v < 0 ? -1n : v > 0 ? 1n : 0n; }
  }
  class Item_func_units extends Item_real_func {
    constructor(name, a, mul, add) { super([a]); this.uname = name; this.mul = mul; this.add = add; }
    func_name() { return this.uname; }
    val() { const v = this.args[0].val(); if ((this.null_value = this.args[0].null_value)) return 0; return v * this.mul + this.add; }
  }
  class Item_func_min_max extends Item_func {
    constructor(args, sign) { super(args); this.cmp_sign = sign; this.cmp_type = STRING_RESULT; }
    result_type() { return this.cmp_type; }
    fix_length_and_dec() {
      this.decimals = 0; this.max_length = 0; this.maybe_null = true; this.binary = false;
      this.cmp_type = this.args[0].result_type();
      for (const a of this.args) {
        if (this.max_length < a.max_length) this.max_length = a.max_length;
        if (this.decimals < a.decimals) this.decimals = a.decimals;
        if (!a.maybe_null) this.maybe_null = false;
        this.cmp_type = item_cmp_type(this.cmp_type, a.result_type());
        if (a.binary) this.binary = true;
      }
    }
    val_str() {
      if (this.cmp_type === INT_RESULT) { const nr = this.val_int(); return this.null_value ? null : nr.toString(); }
      if (this.cmp_type === REAL_RESULT) { const nr = this.val(); return this.null_value ? null : setDouble(nr, this.decimals); }
      let res = null;
      this.null_value = true;
      for (const a of this.args) {
        if (this.null_value) { res = a.val_str(); this.null_value = a.null_value; }
        else {
          const r2 = a.val_str();
          if (r2 !== null) {
            const c = this.binary ? stringcmp(res, r2) : sortcmp(res, r2);
            if ((this.cmp_sign < 0 ? c : -c) < 0) res = r2;
          }
        }
      }
      return res;
    }
    val() {
      let value = 0;
      this.null_value = true;
      for (const a of this.args) {
        if (this.null_value) { value = a.val(); this.null_value = a.null_value; }
        else { const t = a.val(); if (!a.null_value && (t < value ? this.cmp_sign : -this.cmp_sign) > 0) value = t; }
      }
      return value;
    }
    val_int() {
      let value = 0n;
      this.null_value = true;
      for (const a of this.args) {
        if (this.null_value) { value = a.val_int(); this.null_value = a.null_value; }
        else { const t = a.val_int(); if (!a.null_value && (t < value ? this.cmp_sign : -this.cmp_sign) > 0) value = t; }
      }
      return value;
    }
  }
  class Item_func_length extends Item_int_func {
    func_name() { return 'length'; }
    fix_length_and_dec() { this.max_length = 10; }
    val_int() { const r = this.args[0].val_str(); if (r === null) { this.null_value = true; return 0n; } this.null_value = false; return BigInt(r.length); }
  }
  class Item_func_char_length extends Item_func_length { func_name() { return 'char_length'; } }
  class Item_func_locate extends Item_int_func {
    func_name() { return 'locate'; }
    fix_length_and_dec() { this.maybe_null = false; this.max_length = 11; }
    val_int() {
      const a = this.args[0].val_str(), b = this.args[1].val_str();
      if (a === null || b === null) { this.null_value = true; return 0n; }
      this.null_value = false;
      let start = 0;
      if (this.args.length === 3) {
        start = Number(BigInt.asUintN(32, this.args[2].val_int() - 1n));
        if (start > a.length || start + b.length > a.length) return 0n;
      }
      if (!b.length) return BigInt(start + 1);
      return BigInt(a.indexOf(b, start) + 1);
    }
  }
  class Item_func_field extends Item_int_func {
    constructor(item, list) { super(list); this.item = item; }
    func_name() { return 'field'; }
    children() { return [this.item, ...this.args]; }
    fix_fields(ctx) { this.item.fix_fields(ctx); super.fix_fields(ctx); }
    fix_length_and_dec() {
      this.maybe_null = false; this.max_length = 3;
      this.used_tables_cache |= this.item.used_tables();
      this.const_item_cache = this.const_item_cache && this.item.const_item();
      this.with_sum_func = this.with_sum_func || this.item.with_sum_func;
    }
    val_int() {
      const f = this.item.val_str();
      if (f === null) return 0n;
      for (let i = 0; i < this.args.length; i++) { const t = this.args[i].val_str(); if (t !== null && t === f) return BigInt(i + 1); }
      return 0n;
    }
  }
  class Item_func_ascii extends Item_int_func {
    func_name() { return 'ascii'; }
    fix_length_and_dec() { this.max_length = 3; }
    val_int() { const r = this.args[0].val_str(); if (r === null) { this.null_value = true; return 0n; } this.null_value = false; return BigInt(r.length ? cc(r, 0) : 0); }
  }
  class Item_func_ord extends Item_func_ascii { func_name() { return 'ord'; } fix_length_and_dec() { this.max_length = 21; } }
  class Item_func_find_in_set extends Item_int_func {
    func_name() { return 'find_in_set'; }
    fix_length_and_dec() {
      this.decimals = 0; this.max_length = 3;
      this.enum_value = 0;
      if (this.args[0].const_item() && this.args[1].type() === 'FIELD_ITEM' && this.args[1].field.real_type() === T.SET) {
        const find = this.args[0].val_str();
        if (find !== null) {
          this.enum_value = find_enum(this.args[1].field.typelib, find);
          this.enum_bit = this.enum_value ? 1n << BigInt(this.enum_value - 1) : 0n;
        }
      }
    }
    val_int() {
      if (this.enum_value) {
        const tmp = BigInt.asUintN(64, this.args[1].val_int());
        if (!(this.null_value = this.args[1].null_value || this.args[0].null_value)) { if (tmp & this.enum_bit) return BigInt(this.enum_value); }
        return 0n;
      }
      const find = this.args[0].val_str(), buf = this.args[1].val_str();
      if (find === null || buf === null) { this.null_value = true; return 0n; }
      this.null_value = false;
      // (a scan with C's toupper(): ASCII case only; a match must end at a
      // comma or the end, so 'a,b' is found at the start of 'a,b')
      const diff = buf.length - find.length;
      if (diff < 0) return 0n;
      const up = (c) => (c >= 97 && c <= 122 ? c - 32 : c);
      const end = diff + 1;
      let str = 0, position = 1;
      do {
        let pos = 0, found = true;
        while (pos !== find.length) {
          if (up(cc(buf, str)) !== up(cc(find, pos))) { found = false; break; }
          str++; pos++;
        }
        if (found && (str === buf.length || buf[str] === ',')) return BigInt(position);
        while (str < end && buf[str] !== ',') str++;
        position++;
      } while (++str <= end);
      return 0n;
    }
  }
  class Item_func_bitop extends Item_int_func {
    constructor(a, b, op) { super(b === undefined ? [a] : [a, b]); this.op = op; }
    func_name() { return this.op; }
    fix_length_and_dec() { this.decimals = 0; this.max_length = this.op === 'bit_count' ? 2 : 21; }
    val_int() {
      const a = BigInt.asUintN(64, this.args[0].val_int());
      if (this.args[0].null_value) { this.null_value = true; return 0n; }
      let r;
      if (this.args.length === 1) {
        if (this.op === '~') r = BigInt.asUintN(64, ~a);
        else { r = 0n; for (let x = a; x; x >>= 1n) r += x & 1n; }
      } else {
        const b = BigInt.asUintN(64, this.args[1].val_int());
        if (this.args[1].null_value) { this.null_value = true; return 0n; }
        if (this.op === '|') r = a | b; else if (this.op === '&') r = a & b;
        else if (this.op === '<<') r = b < 64n ? BigInt.asUintN(64, a << b) : 0n;
        else r = b < 64n ? a >> b : 0n;
      }
      this.null_value = false;
      return BigInt.asIntN(64, r);
    }
  }
  const Item_func_bit_or = function (a, b) { return new Item_func_bitop(a, b, '|'); };
  const Item_func_bit_and = function (a, b) { return new Item_func_bitop(a, b, '&'); };
  const Item_func_shift_left = function (a, b) { return new Item_func_bitop(a, b, '<<'); };
  const Item_func_shift_right = function (a, b) { return new Item_func_bitop(a, b, '>>'); };
  const Item_func_bit_neg = function (a) { return new Item_func_bitop(a, undefined, '~'); };
  class Item_func_set_last_insert_id extends Item_int_func {
    func_name() { return 'last_insert_id'; }
    fix_length_and_dec() { this.decimals = 0; this.max_length = this.args[0].max_length; }
    val_int() {
      const v = this.args[0].val_int();
      THD.conn.insert_id_used = true;
      THD.conn.last_insert_id = BigInt.asUintN(64, v);
      THD.last_insert_id_set = true;
      this.null_value = this.args[0].null_value;
      return v;
    }
  }
  class Item_func_benchmark extends Item_int_func {
    constructor(count, e) { super([e]); this.count = count; }
    fix_length_and_dec() { this.decimals = 0; this.max_length = 1; this.maybe_null = false; }
    val_int() { const e = this.args[0]; for (let i = 0; i < Math.min(this.count, 100000); i++) e.val_str(); return 0n; }
  }
  class Item_func_lock extends Item_int_func {
    constructor(args, kind) { super(args); this.kind = kind; }
    fix_length_and_dec() { this.decimals = 0; this.max_length = 1; this.maybe_null = true; }
    val_int() {
      const n = this.args[0].val_str();
      if (n === null) { this.null_value = true; return 0n; }
      this.null_value = false;
      const locks = THD.conn.srv.userLocks;
      const conn = THD.conn;
      if (this.kind === 'get') {
        for (const [k, v] of locks) if (v === conn && k !== n) locks.delete(k);
        const owner = locks.get(n);
        if (owner && owner !== conn && !owner.closed) return 0n;
        locks.set(n, conn);
        return 1n;
      }
      if (this.kind === 'is_free') return locks.has(n) ? 0n : 1n;
      const owner = locks.get(n);
      if (!owner) { this.null_value = true; return 0n; }
      if (owner !== conn) return 0n;
      locks.delete(n);
      return 1n;
    }
  }
  class Item_func_inet_aton extends Item_int_func {
    fix_length_and_dec() { this.decimals = 0; this.max_length = 21; this.maybe_null = true; }
    val_int() {
      const s = this.args[0].val_str();
      if (s === null) { this.null_value = true; return 0n; }
      this.null_value = false;
      let result = 0n, byte = 0, c = '.';
      for (let i = 0; i < s.length; i++) {
        c = s[i];
        const d = cc(s, i) - 48;
        if (d >= 0 && d <= 9) { if ((byte = byte * 10 + d) > 255) { this.null_value = true; return 0n; } }
        else if (c === '.') { result = (result << 8n) + BigInt(byte); byte = 0; }
        else { this.null_value = true; return 0n; }
      }
      if (c !== '.') return (result << 8n) + BigInt(byte);
      this.null_value = true;
      return 0n;
    }
  }

  // User variables (@var) and system variables (@@var)
  class Item_func_set_user_var extends Item_func {
    constructor(name, e) { super([e]); this.vname = name; }
    func_name() { return 'set_user_var'; }
    result_type() { return this.cached_result_type; }
    fix_length_and_dec() {
      this.maybe_null = this.args[0].maybe_null; this.max_length = this.args[0].max_length;
      this.decimals = this.args[0].decimals; this.cached_result_type = this.args[0].result_type();
    }
    entry() {
      const vars = THD.conn.user_vars;
      let e = vars.get(this.vname);
      if (!e) { e = { value: null, type: STRING_RESULT }; vars.set(this.vname, e); }
      return e;
    }
    update_hash(v, type) {
      const e = this.entry();
      if ((this.null_value = this.args[0].null_value)) { e.value = null; return; }
      e.value = v; e.type = type;
    }
    val() { const v = this.args[0].val(); this.update_hash(v, REAL_RESULT); return v; }
    val_int() { const v = this.args[0].val_int(); this.update_hash(v, INT_RESULT); return v; }
    val_str() { const v = this.args[0].val_str(); if (v === null) this.update_hash(null, STRING_RESULT); else this.update_hash(v, STRING_RESULT); return v; }
    update() {
      if (this.cached_result_type === REAL_RESULT) this.val();
      else if (this.cached_result_type === INT_RESULT) this.val_int();
      else this.val_str();
    }
  }
  class Item_func_get_user_var extends Item_func {
    constructor(name) { super([]); this.vname = name; }
    func_name() { return 'get_user_var'; }
    fix_length_and_dec() { this.maybe_null = true; this.decimals = NOT_FIXED_DEC; this.max_length = MAX_BLOB_WIDTH; }
    get_entry() {
      const e = THD.conn.user_vars.get(this.vname);
      if (!e || e.value === null) { this.null_value = true; return null; }
      this.null_value = false;
      return e;
    }
    result_type() { const e = THD.conn.user_vars.get(this.vname); return e ? e.type : STRING_RESULT; }
    val_str() {
      const e = this.get_entry();
      if (!e) return null;
      if (e.type === REAL_RESULT) return setDouble(e.value, this.decimals);
      if (e.type === INT_RESULT) return e.value.toString();
      return e.value;
    }
    val() {
      const e = this.get_entry();
      if (!e) return 0;
      if (e.type === REAL_RESULT) return e.value;
      if (e.type === INT_RESULT) return Number(e.value);
      return atof(e.value);
    }
    val_int() {
      const e = this.get_entry();
      if (!e) return 0n;
      if (e.type === REAL_RESULT) return dbl2ll(e.value);
      if (e.type === INT_RESULT) return e.value;
      return BigInt.asIntN(64, strtoull(e.value).v);
    }
    const_item() { return true; }
    used_tables() { return 0; }
  }
  function getSystemVar(name, parser) {
    const up = caseUp(name);
    if (up === 'VERSION') return new Item_string(SERVER_VERSION, '@@version');
    if (up === 'MAX_ALLOWED_PACKET') return new Item_int('@@max_allowed_packet', 1048576n, 21);
    if (up === 'NET_BUFFER_LENGTH') return new Item_int('@@net_buffer_length', 16384n, 21);
    if (up === 'IDENTITY' || up === 'LAST_INSERT_ID') return new Item_last_insert_id('@@' + name);
    parser.fail(parser.last);
  }
  class Item_last_insert_id extends Item_int {
    constructor(name) { super(name, 0n, 21); }
    fix_fields() { this.value = BigInt.asIntN(64, THD.conn.last_insert_id); THD.conn.insert_id_used = true; }
  }

  class Item_func_match extends Item_real_func {
    constructor(fields, e) { super([e]); this.fields = fields; }
    func_name() { return 'match'; }
    fix_fields(ctx) {
      for (const f of this.fields) f.fix_fields(ctx);
      super.fix_fields(ctx);
      throw myError(1191);
    }
    val() { return 0; }
  }

  // ---------------------------------------------------------------------------
  // Comparisons and conditions (sql/item_cmpfunc.cc)
  // ---------------------------------------------------------------------------
  // convert_constant_item(): compare a date/time field with a constant by
  // storing the constant in the field and comparing integers
  function convert_constant_item(field, args, i) {
    const item = args[i];
    if (item.const_item()) {
      const saved = field.save();
      THD.no_errors = true;
      try { item.save_in_field(field); } finally { THD.no_errors = false; }
      if (!item.null_value) {
        const v = field.val_int();
        field.restore(saved);
        args[i] = new Item_int(item.name, v, item.max_length);
        return true;
      }
      field.restore(saved);
    }
    return false;
  }
  class Item_bool_func extends Item_int_func {
    fix_length_and_dec() { this.decimals = 0; this.max_length = 1; }
  }
  class Item_bool_func2 extends Item_int_func {
    constructor(a, b) { super([a, b]); this.cmp = null; }
    fix_length_and_dec() {
      this.max_length = 1;
      const a = this.args;
      if (a[0].type() === 'FIELD_ITEM' && a[0].field.store_for_compare()) {
        if (convert_constant_item(a[0].field, a, 1)) { this.cmp = this.compare_int; return; }
      }
      if (a[1].type() === 'FIELD_ITEM' && a[1].field.store_for_compare()) {
        if (convert_constant_item(a[1].field, a, 0)) { this.cmp = this.compare_int; return; }
      }
      this.set_cmp_func(item_cmp_type(a[0].result_type(), a[1].result_type()));
    }
    set_cmp_func(t) { this.cmp = t === STRING_RESULT ? this.compare_string : t === REAL_RESULT ? this.compare_real : this.compare_int; }
    compare_string() {
      const r1 = this.args[0].val_str();
      if (r1 !== null) {
        const r2 = this.args[1].val_str();
        if (r2 !== null) { this.null_value = false; return this.binary ? stringcmp(r1, r2) : sortcmp(r1, r2); }
      }
      this.null_value = true;
      return -1;
    }
    compare_real() {
      const v1 = this.args[0].val();
      if (!this.args[0].null_value) {
        const v2 = this.args[1].val();
        if (!this.args[1].null_value) { this.null_value = false; return v1 < v2 ? -1 : v1 === v2 ? 0 : 1; }
      }
      this.null_value = true;
      return -1;
    }
    compare_int() {
      const v1 = this.args[0].val_int();
      if (!this.args[0].null_value) {
        const v2 = this.args[1].val_int();
        if (!this.args[1].null_value) { this.null_value = false; return v1 < v2 ? -1 : v1 === v2 ? 0 : 1; }
      }
      this.null_value = true;
      return -1;
    }
  }
  class Item_func_eq extends Item_bool_func2 { func_name() { return '='; } val_int() { return this.cmp() === 0 ? 1n : 0n; } }
  class Item_func_ne extends Item_bool_func2 { func_name() { return '<>'; } val_int() { const v = this.cmp(); return v !== 0 && !this.null_value ? 1n : 0n; } }
  class Item_func_ge extends Item_bool_func2 { func_name() { return '>='; } val_int() { return this.cmp() >= 0 ? 1n : 0n; } }
  class Item_func_gt extends Item_bool_func2 { func_name() { return '>'; } val_int() { return this.cmp() > 0 ? 1n : 0n; } }
  class Item_func_le extends Item_bool_func2 { func_name() { return '<='; } val_int() { const v = this.cmp(); return v <= 0 && !this.null_value ? 1n : 0n; } }
  class Item_func_lt extends Item_bool_func2 { func_name() { return '<'; } val_int() { const v = this.cmp(); return v < 0 && !this.null_value ? 1n : 0n; } }
  class Item_func_equal extends Item_bool_func2 {
    func_name() { return '<=>'; }
    fix_length_and_dec() {
      super.fix_length_and_dec();
      this.cmp_result_type = item_cmp_type(this.args[0].result_type(), this.args[1].result_type());
      this.maybe_null = this.null_value = false;
    }
    val_int() {
      const a = this.args;
      if (this.cmp_result_type === STRING_RESULT) {
        const r1 = a[0].val_str(), r2 = a[1].val_str();
        if (r1 === null || r2 === null) return r1 === r2 ? 1n : 0n;
        return (this.binary ? stringcmp(r1, r2) : sortcmp(r1, r2)) === 0 ? 1n : 0n;
      }
      if (this.cmp_result_type === REAL_RESULT) {
        const v1 = a[0].val(), v2 = a[1].val();
        if (a[0].null_value || a[1].null_value) return a[0].null_value && a[1].null_value ? 1n : 0n;
        return v1 === v2 ? 1n : 0n;
      }
      const v1 = a[0].val_int(), v2 = a[1].val_int();
      if (a[0].null_value || a[1].null_value) return a[0].null_value && a[1].null_value ? 1n : 0n;
      return v1 === v2 ? 1n : 0n;
    }
  }
  class Item_func_strcmp extends Item_bool_func2 {
    func_name() { return 'strcmp'; }
    fix_length_and_dec() { this.max_length = 2; }
    val_int() {
      const a = this.args[0].val_str(), b = this.args[1].val_str();
      if (a === null || b === null) { this.null_value = true; return 0n; }
      this.null_value = false;
      const v = stringcmp(a, b);
      return !v ? 0n : v < 0 ? -1n : 1n;
    }
  }
  class Item_func_not extends Item_bool_func {
    constructor(a) { super([a]); }
    func_name() { return 'not'; }
    val_int() { const v = this.args[0].val(); this.null_value = this.args[0].null_value; return !this.null_value && v === 0 ? 1n : 0n; }
  }
  class Item_func_between extends Item_int_func {
    constructor(a, b, c) { super([a, b, c]); }
    func_name() { return 'between'; }
    fix_length_and_dec() {
      this.max_length = 1;
      const a = this.args;
      this.cmp_type = a[0].result_type();
      this.string_compare = a[0].binary ? stringcmp : sortcmp;
      if (a[0].type() === 'FIELD_ITEM' && a[0].field.store_for_compare()) {
        if (convert_constant_item(a[0].field, a, 1)) this.cmp_type = INT_RESULT;
        if (convert_constant_item(a[0].field, a, 2)) this.cmp_type = INT_RESULT;
      }
    }
    val_int() {
      const a = this.args;
      let v, lo, hi, cmp;
      if (this.cmp_type === STRING_RESULT) { v = a[0].val_str(); cmp = (x, y) => this.string_compare(x, y); }
      else if (this.cmp_type === INT_RESULT) { v = a[0].val_int(); cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0); }
      else { v = a[0].val(); cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0); }
      if ((this.null_value = a[0].null_value)) return 0n;
      if (this.cmp_type === STRING_RESULT) { lo = a[1].val_str(); hi = a[2].val_str(); }
      else if (this.cmp_type === INT_RESULT) { lo = a[1].val_int(); hi = a[2].val_int(); }
      else { lo = a[1].val(); hi = a[2].val(); }
      if (!a[1].null_value && !a[2].null_value) return cmp(v, lo) >= 0 && cmp(v, hi) <= 0 ? 1n : 0n;
      if (a[1].null_value && a[2].null_value) this.null_value = true;
      else if (a[1].null_value) this.null_value = cmp(v, hi) <= 0;
      else this.null_value = cmp(v, lo) >= 0;
      return 0n;
    }
  }
  class Item_func_interval extends Item_int_func {
    constructor(item, list) { super(list); this.item = item; this.intervals = null; }
    func_name() { return 'interval'; }
    children() { return [this.item, ...this.args]; }
    fix_fields(ctx) { this.item.fix_fields(ctx); super.fix_fields(ctx); }
    fix_length_and_dec() {
      if (this.args.length >= 8 && this.args.every((a) => a.type() === 'INT_ITEM' || a.type() === 'REAL_ITEM')) this.intervals = this.args.map((a) => a.val());
      this.maybe_null = false; this.max_length = 2;
      this.used_tables_cache |= this.item.used_tables();
    }
    val_int() {
      const value = this.item.val();
      if (this.item.null_value) return -1n;
      if (this.intervals) {
        let start = 0, end = this.intervals.length - 1;
        while (start !== end) { const mid = (start + end + 1) >> 1; if (this.intervals[mid] <= value) start = mid; else end = mid - 1; }
        return value < this.intervals[start] ? 0n : BigInt(start + 1);
      }
      if (this.args[0].val() > value) return 0n;
      for (let i = 1; i < this.args.length; i++) if (this.args[i].val() > value) return BigInt(i);
      return BigInt(this.args.length);
    }
  }
  // IFNULL, IF, NULLIF, COALESCE, CASE: the type of the result is chosen at fix time
  class Item_func_hybrid_result extends Item_func {
    result_type() { return this.cached_result_type; }
    val_str() { const it = this.pick(); if (!it) { this.null_value = true; return null; } const r = it.val_str(); this.null_value = it.null_value; return r; }
    val() { const it = this.pick(); if (!it) { this.null_value = true; return 0; } const r = it.val(); this.null_value = it.null_value; return r; }
    val_int() { const it = this.pick(); if (!it) { this.null_value = true; return 0n; } const r = it.val_int(); this.null_value = it.null_value; return r; }
  }
  class Item_func_ifnull extends Item_func_hybrid_result {
    constructor(a, b) { super([a, b]); }
    func_name() { return 'ifnull'; }
    fix_length_and_dec() {
      this.maybe_null = this.args[1].maybe_null;
      this.max_length = Math.max(this.args[0].max_length, this.args[1].max_length);
      this.decimals = Math.max(this.args[0].decimals, this.args[1].decimals);
      this.cached_result_type = this.args[0].result_type();
    }
    val() { const v = this.args[0].val(); if (!this.args[0].null_value) { this.null_value = false; return v; } const w = this.args[1].val(); return (this.null_value = this.args[1].null_value) ? 0 : w; }
    val_int() { const v = this.args[0].val_int(); if (!this.args[0].null_value) { this.null_value = false; return v; } const w = this.args[1].val_int(); return (this.null_value = this.args[1].null_value) ? 0n : w; }
    val_str() { const v = this.args[0].val_str(); if (!this.args[0].null_value) { this.null_value = false; return v; } const w = this.args[1].val_str(); return (this.null_value = this.args[1].null_value) ? null : w; }
  }
  class Item_func_if extends Item_func_hybrid_result {
    constructor(a, b, c) { super([a, b, c]); }
    func_name() { return 'if'; }
    fix_length_and_dec() {
      const a = this.args;
      this.maybe_null = a[1].maybe_null || a[2].maybe_null;
      this.max_length = Math.max(a[1].max_length, a[2].max_length);
      this.decimals = Math.max(a[1].decimals, a[2].decimals);
      const t1 = a[1].result_type(), t2 = a[2].result_type();
      this.cached_result_type = t1 === STRING_RESULT || t2 === STRING_RESULT ? STRING_RESULT : t1 === REAL_RESULT || t2 === REAL_RESULT ? REAL_RESULT : t1;
    }
    pick() { return this.args[0].val_int() ? this.args[1] : this.args[2]; }
  }
  class Item_func_nullif extends Item_bool_func2 {
    func_name() { return 'nullif'; }
    result_type() { return this.cached_result_type; }
    fix_length_and_dec() {
      super.fix_length_and_dec();
      this.maybe_null = true;
      this.max_length = this.args[0].max_length;
      this.decimals = this.args[0].decimals;
      this.cached_result_type = this.args[0].result_type();
    }
    val() { if (!this.cmp() || this.null_value) { this.null_value = true; return 0; } const v = this.args[0].val(); this.null_value = this.args[0].null_value; return v; }
    val_int() { if (!this.cmp() || this.null_value) { this.null_value = true; return 0n; } const v = this.args[0].val_int(); this.null_value = this.args[0].null_value; return v; }
    val_str() { if (!this.cmp() || this.null_value) { this.null_value = true; return null; } const v = this.args[0].val_str(); this.null_value = this.args[0].null_value; return v; }
  }
  class Item_func_coalesce extends Item_func_hybrid_result {
    func_name() { return 'coalesce'; }
    fix_length_and_dec() {
      this.max_length = 0; this.decimals = 0;
      this.cached_result_type = this.args[0].result_type();
      for (const a of this.args) { this.max_length = Math.max(this.max_length, a.max_length); this.decimals = Math.max(this.decimals, a.decimals); }
    }
    val_str() { this.null_value = false; for (const a of this.args) { const r = a.val_str(); if (r !== null) return r; } this.null_value = true; return null; }
    val_int() { this.null_value = false; for (const a of this.args) { const r = a.val_int(); if (!a.null_value) return r; } this.null_value = true; return 0n; }
    val() { this.null_value = false; for (const a of this.args) { const r = a.val(); if (!a.null_value) return r; } this.null_value = true; return 0; }
  }
  class Item_func_case extends Item_func_hybrid_result {
    constructor(list, first, els) { super(list); this.first_expr = first; this.else_expr = els; }
    func_name() { return 'case'; }
    children() { return [this.first_expr, ...this.args, this.else_expr]; }
    fix_fields(ctx) {
      if (this.first_expr) this.first_expr.fix_fields(ctx);
      if (this.else_expr) this.else_expr.fix_fields(ctx);
      super.fix_fields(ctx);
      for (const e of [this.first_expr, this.else_expr]) {
        if (e) { this.used_tables_cache |= e.used_tables(); this.const_item_cache = this.const_item_cache && e.const_item(); }
      }
      if (!this.else_expr || this.else_expr.maybe_null) this.maybe_null = true;
    }
    fix_length_and_dec() {
      this.max_length = 0; this.decimals = 0;
      this.cached_result_type = this.args[1].result_type();
      for (let i = 0; i < this.args.length; i += 2) {
        this.max_length = Math.max(this.max_length, this.args[i + 1].max_length);
        this.decimals = Math.max(this.decimals, this.args[i + 1].decimals);
      }
      if (this.else_expr) { this.max_length = Math.max(this.max_length, this.else_expr.max_length); this.decimals = Math.max(this.decimals, this.else_expr.decimals); }
    }
    pick() {
      const f = this.first_expr;
      let s, n, r, su = false, iu = false, ru = false;
      for (let i = 0; i < this.args.length; i += 2) {
        const a = this.args[i];
        if (!f) { if (a.val_int()) return this.args[i + 1]; continue; }
        const t = a.result_type();
        if (t === STRING_RESULT) {
          if (!su) { su = true; if ((s = f.val_str()) === null) return this.else_expr; }
          const x = a.val_str();
          if (x !== null && ((f.binary || a.binary) ? stringcmp(x, s) : sortcmp(x, s)) === 0) return this.args[i + 1];
        } else if (t === INT_RESULT) {
          if (!iu) { iu = true; n = f.val_int(); if (f.null_value) return this.else_expr; }
          if (a.val_int() === n && !a.null_value) return this.args[i + 1];
        } else {
          if (!ru) { ru = true; r = f.val(); if (f.null_value) return this.else_expr; }
          if (a.val() === r && !a.null_value) return this.args[i + 1];
        }
      }
      return this.else_expr;
    }
    val_str() { const it = this.pick(); if (!it) { this.null_value = true; return null; } const r = it.val_str(); if (r === null) this.null_value = true; else this.null_value = false; return r; }
  }
  class Item_func_in extends Item_int_func {
    constructor(item, list) { super(list); this.item = item; }
    func_name() { return ' IN '; }
    children() { return [this.item, ...this.args]; }
    fix_fields(ctx) { this.item.fix_fields(ctx); super.fix_fields(ctx); }
    fix_length_and_dec() {
      const rt = this.item.result_type();
      this.cmpf = rt === STRING_RESULT ? (this.item.binary ? stringcmp : sortcmp) : (x, y) => (x < y ? -1 : x > y ? 1 : 0);
      this.get = rt === STRING_RESULT ? (it) => it.val_str() : rt === INT_RESULT ? (it) => it.val_int() : (it) => it.val();
      this.maybe_null = this.item.maybe_null;
      this.max_length = 2;
      this.used_tables_cache |= this.item.used_tables();
      this.const_item_cache = this.const_item_cache && this.item.const_item();
    }
    val_int() {
      const v = this.get(this.item);
      if ((this.null_value = this.item.null_value)) return 0n;
      for (const a of this.args) {
        const x = this.get(a);
        if (!a.null_value && x !== null && this.cmpf(v, x) === 0) return 1n;
      }
      return 0n;
    }
  }
  class Item_func_isnull extends Item_bool_func {
    constructor(a) { super([a]); }
    func_name() { return 'isnull'; }
    fix_length_and_dec() { this.decimals = 0; this.max_length = 1; this.maybe_null = false; }
    val_int() { this.args[0].val(); return this.args[0].null_value ? 1n : 0n; }
  }
  class Item_func_isnotnull extends Item_bool_func {
    constructor(a) { super([a]); }
    func_name() { return 'isnotnull'; }
    fix_length_and_dec() { this.decimals = 0; this.max_length = 1; this.maybe_null = false; }
    val_int() { this.args[0].val(); return this.args[0].null_value ? 0n : 1n; }
  }
  // Item_cond: AND/OR with the arguments flattened
  class Item_cond extends Item_bool_func {
    constructor(a, b) { super(a ? [a, b] : []); }
    type() { return 'COND_ITEM'; }
    fix_fields(ctx) {
      const flat = [];
      const add = (it) => { if (it instanceof this.constructor) it.args.forEach(add); else flat.push(it); };
      this.args.forEach(add);
      this.args = flat;
      this.used_tables_cache = 0;
      this.const_item_cache = false;
      let allConst = true;
      for (const it of this.args) {
        it.fix_fields(ctx);
        this.used_tables_cache |= it.used_tables();
        this.with_sum_func = this.with_sum_func || it.with_sum_func;
        allConst = allConst && it.const_item();
      }
      this.const_item_cache = false;
      this.fix_length_and_dec();
    }
    const_item() { return this.args.every((a) => a.const_item()); }
    // (from the arguments: also right for conditions the optimizer builds)
    used_tables() { return this.args.reduce((m, a) => m | a.used_tables(), 0); }
  }
  class Item_cond_and extends Item_cond {
    func_name() { return 'and'; }
    val_int() {
      for (const it of this.args) if (it.val_int() === 0n) { this.null_value = it.null_value; return 0n; }
      this.null_value = false;
      return 1n;
    }
  }
  class Item_cond_or extends Item_cond {
    func_name() { return 'or'; }
    val_int() {
      this.null_value = false;
      for (const it of this.args) {
        if (it.val_int() !== 0n) { this.null_value = false; return 1n; }
        if (it.null_value) this.null_value = true;
      }
      return 0n;
    }
  }
  // wild_case_compare() / wild_compare(): LIKE (sql/sql_string.cc)
  function wild_compare(str, wild, escape, caseInsens) {
    const conv = caseInsens ? (c) => SORT_ORDER[c] : (c) => c;
    const WM = 37, WO = 95;               // '%' '_'
    const esc = escape.length ? cc(escape, 0) : -1;
    const rec = (si, wi) => {
      let result = -1;
      while (wi !== wild.length) {
        while (cc(wild, wi) !== WM && cc(wild, wi) !== WO) {
          if (cc(wild, wi) === esc && wi + 1 !== wild.length) wi++;
          if (si === str.length || conv(cc(wild, wi++)) !== conv(cc(str, si++))) return 1;
          if (wi === wild.length) return si !== str.length ? 1 : 0;
          result = 1;
        }
        if (cc(wild, wi) === WO) {
          do {
            if (si === str.length) return result;
            si++;
          } while (++wi < wild.length && cc(wild, wi) === WO);
          if (wi === wild.length) break;
        }
        if (cc(wild, wi) === WM) {
          wi++;
          for (; wi !== wild.length; wi++) {
            if (cc(wild, wi) === WM) continue;
            if (cc(wild, wi) === WO) { if (si === str.length) return -1; si++; continue; }
            break;
          }
          if (wi === wild.length) return 0;
          if (si === str.length) return -1;
          let cmp = cc(wild, wi);
          if (cmp === esc && wi + 1 !== wild.length) cmp = cc(wild, ++wi);
          wi++;
          cmp = conv(cmp);
          do {
            while (si !== str.length && conv(cc(str, si)) !== cmp) si++;
            if (si++ === str.length) return -1;
            const tmp = rec(si, wi);
            if (tmp <= 0) return tmp;
          } while (si !== str.length && cc(wild, wi) !== WM);
          return -1;
        }
      }
      return si !== str.length ? 1 : 0;
    };
    return rec(0, 0);
  }
  class Item_func_like extends Item_bool_func2 {
    constructor(a, b, esc) { super(a, b); this.escape = esc; }
    func_name() { return 'like'; }
    fix_length_and_dec() { this.decimals = 0; this.max_length = 1; }
    val_int() {
      const r = this.args[0].val_str();
      if (this.args[0].null_value) { this.null_value = true; return 0n; }
      const w = this.args[1].val_str();
      if (this.args[1].null_value) { this.null_value = true; return 0n; }
      this.null_value = false;
      return wild_compare(r, w, this.escape, !this.binary) ? 0n : 1n;
    }
  }
  class Item_func_regex extends Item_bool_func {
    constructor(a, b) { super([a, b]); this.re = null; this.is_const = false; }
    func_name() { return 'regex'; }
    fix_fields(ctx) {
      for (const a of this.args) a.fix_fields(ctx);
      this.with_sum_func = this.args[0].with_sum_func || this.args[1].with_sum_func;
      this.max_length = 1; this.decimals = 0;
      this.binary = this.args[0].binary || this.args[1].binary;
      this.used_tables_cache = this.args[0].used_tables() | this.args[1].used_tables();
      this.const_item_cache = this.args[0].const_item() && this.args[1].const_item();
      if (this.args[1].const_item()) {
        const res = this.args[1].val_str();
        if (this.args[1].null_value) { this.maybe_null = true; return; }
        const r = posixRegex(res, !this.binary);
        if (r.error) throw myError(ER.REGEXP_ERROR, r.error);
        this.re = r.re; this.is_const = true;
        this.maybe_null = this.args[0].maybe_null;
      } else this.maybe_null = true;
    }
    val_int() {
      const res = this.args[0].val_str();
      if (this.args[0].null_value) { this.null_value = true; return 0n; }
      let re = this.re;
      if (!this.is_const) {
        const r2 = this.args[1].val_str();
        if (this.args[1].null_value) { this.null_value = true; return 0n; }
        if (r2 !== this.prev) { this.prev = r2; const r = posixRegex(r2, !this.binary); this.re = r.error ? null : r.re; }
        re = this.re;
        if (!re) { this.null_value = true; return 0n; }
      }
      this.null_value = false;
      const z = res.indexOf('\0');
      return re.test(z >= 0 ? res.slice(0, z) : res) ? 1n : 0n;
    }
  }
  // Henry Spencer's POSIX extended regex (MySQL's regex/) translated to a JS
  // RegExp; the errors are regerror()'s texts
  const REG_CLASSES = {
    alnum: 'A-Za-z0-9', alpha: 'A-Za-z', blank: ' \\t', cntrl: '\\x00-\\x1f\\x7f', digit: '0-9', graph: '!-~',
    lower: 'a-z', print: ' -~', punct: '!-\\/:-@\\[-`{-~', space: ' \\t\\n\\r\\f\\v', upper: 'A-Z', xdigit: '0-9A-Fa-f',
  };
  const REG_ERR = {
    EPAREN: 'parentheses not balanced', EBRACK: 'brackets ([ ]) not balanced', EBRACE: 'braces not balanced',
    BADRPT: 'repetition-operator operand invalid', BADBR: 'invalid repetition count(s)', EMPTY: 'empty (sub)expression',
    ECTYPE: 'invalid character class', ERANGE: 'invalid character range', EESCAPE: 'trailing backslash (\\)',
    ECOLLATE: 'invalid collating element',
  };
  function posixRegex(p, icase) {
    let i = 0, out = '';
    const esc = (ch) => ch.replace(/[\\^$.*+?()[\]{}|\/-]/g, '\\$&');
    const hex = (c) => '\\x' + c.toString(16).padStart(2, '0');
    const fail = (e) => { throw { regerr: REG_ERR[e] }; };
    // ERE: regex := branch ('|' branch)* ; branch := piece+ ; piece := atom [*+?{m,n}]
    const parseRe = (depth) => {
      let s = parseBranch(depth);
      while (i < p.length && p[i] === '|') { i++; s += '|' + parseBranch(depth); }
      return s;
    };
    const parseBranch = (depth) => {
      let s = '', n = 0;
      while (i < p.length && p[i] !== '|' && !(p[i] === ')' && depth > 0)) {
        s += parsePiece(depth);
        n++;
      }
      if (!n) fail('EMPTY');
      return s;
    };
    const parsePiece = (depth) => {
      const c = p[i];
      if (c === '*' || c === '+' || c === '?') fail('BADRPT');
      if (c === '{' && i + 1 < p.length && /\d/.test(p[i + 1])) fail('BADRPT');
      let atom = parseAtom(depth);
      for (;;) {
        const d = p[i];
        if (d === '*' || d === '+' || d === '?') { atom = '(?:' + atom + ')' + d; i++; continue; }
        if (d === '{' && i + 1 < p.length && /\d/.test(p[i + 1])) {
          const m = p.slice(i).match(/^\{(\d+)(,(\d*))?\}/);
          if (!m) { if (p.slice(i).match(/^\{\d+(,\d*)?$/)) fail('EBRACE'); fail('BADBR'); }
          const lo = +m[1], hi = m[3] === undefined ? (m[2] ? '' : lo) : m[3] === '' ? '' : +m[3];
          if (lo > 255 || (hi !== '' && (hi > 255 || hi < lo))) fail('BADBR');
          atom = '(?:' + atom + '){' + lo + (m[2] ? ',' + hi : '') + '}';
          i += m[0].length;
          continue;
        }
        break;
      }
      return atom;
    };
    const parseAtom = (depth) => {
      const c = p[i];
      if (c === '(') {
        i++;
        if (i >= p.length) fail('EPAREN');
        if (p[i] === ')') { i++; return '()'; }
        const inner = parseRe(depth + 1);
        if (p[i] !== ')') fail('EPAREN');
        i++;
        return '(' + inner + ')';
      }
      if (c === ')') fail('EPAREN');
      if (c === '^') { i++; return '^'; }
      if (c === '$') { i++; return '$'; }
      if (c === '.') { i++; return '[^]'; }
      if (c === '[') return parseBracket();
      if (c === '\\') {
        if (i + 1 >= p.length) fail('EESCAPE');
        i += 2;
        return esc(p[i - 1]);
      }
      i++;
      return esc(c);
    };
    const parseBracket = () => {
      i++;
      if (p.startsWith('[:<:]]', i)) { i += 6; return '(?<![A-Za-z0-9_\\xc0-\\xff])(?=[A-Za-z0-9_\\xc0-\\xff])'; }
      if (p.startsWith('[:>:]]', i)) { i += 6; return '(?<=[A-Za-z0-9_\\xc0-\\xff])(?![A-Za-z0-9_\\xc0-\\xff])'; }
      let neg = false, body = '';
      if (p[i] === '^') { neg = true; i++; }
      if (p[i] === ']') { body += '\\]'; i++; }
      else if (p[i] === '-') { body += '\\-'; i++; }
      while (i < p.length && p[i] !== ']') {
        if (p[i] === '[' && p[i + 1] === ':') {
          const e = p.indexOf(':]', i + 2);
          if (e < 0) fail('EBRACK');
          const cls = REG_CLASSES[p.slice(i + 2, e)];
          if (!cls) fail('ECTYPE');
          body += cls;
          i = e + 2;
          continue;
        }
        if (p[i] === '[' && (p[i + 1] === '.' || p[i + 1] === '=')) {
          const t = p[i + 1];
          const e = p.indexOf(t + ']', i + 2);
          if (e < 0) fail('EBRACK');
          const name = p.slice(i + 2, e);
          if (name.length !== 1) fail('ECOLLATE');
          body += esc(name);
          i = e + 2;
          continue;
        }
        let a = p[i++];
        if (p[i] === '-' && p[i + 1] !== undefined && p[i + 1] !== ']') {
          const b = p[i + 1];
          i += 2;
          if (b.charCodeAt(0) < a.charCodeAt(0)) fail('ERANGE');
          body += hex(a.charCodeAt(0)) + '-' + hex(b.charCodeAt(0));
        } else body += hex(a.charCodeAt(0));
      }
      if (p[i] !== ']') fail('EBRACK');
      i++;
      return '[' + (neg ? '^' : '') + body + ']';
    };
    try {
      if (!p.length) fail('EMPTY');
      const src = parseRe(0);
      if (i < p.length) fail('EPAREN');
      return { re: new RegExp(src, icase ? 'i' : '') };
    } catch (e) {
      if (e && e.regerr) return { error: e.regerr };
      return { error: 'invalid regular expression' };
    }
  }

  // ---------------------------------------------------------------------------
  // String functions (sql/item_strfunc.cc)
  // ---------------------------------------------------------------------------
  class Item_str_func extends Item_func {
    constructor(args) { super(args); this.decimals = NOT_FIXED_DEC; }
    result_type() { return STRING_RESULT; }
    val() { const r = this.val_str(); return r !== null ? atof(r) : 0; }
    val_int() { const r = this.val_str(); return r !== null ? strtoll(r).v : 0n; }
    cap_blob() { if (this.max_length > MAX_BLOB_WIDTH) { this.max_length = MAX_BLOB_WIDTH; this.maybe_null = true; } }
    left_right_max_length() {
      this.max_length = this.args[0].max_length;
      if (this.args[1].const_item()) {
        const len = Number(BigInt.asIntN(32, this.args[1].val_int()));
        if (len <= 0) this.max_length = 0; else if (len < this.max_length) this.max_length = len;
      }
    }
  }
  // a string function computed from its evaluated arguments; null in, null out
  class Item_str_simple extends Item_str_func {
    constructor(name, args, fn, lenfn) { super(args); this.fname = name; this.fn = fn; this.lenfn = lenfn; }
    func_name() { return this.fname; }
    fix_length_and_dec() { if (this.lenfn) this.lenfn.call(this); else this.max_length = this.args[0].max_length; }
    val_str() {
      const r = this.fn.call(this, this.args);
      this.null_value = r === null;
      return r;
    }
  }
  const strArg = (it) => it.val_str();
  function mkStr(name, n, fn, lenfn) {
    return (args) => new Item_str_simple(name, args, function (a) {
      const v = a.map(strArg);
      if (v.some((x, i) => x === null && i < n)) return null;
      return fn.call(this, v, a);
    }, lenfn);
  }
  class Item_func_concat extends Item_str_func {
    func_name() { return 'concat'; }
    fix_length_and_dec() { this.max_length = this.args.reduce((s, a) => s + a.max_length, 0); this.cap_blob(); }
    val_str() {
      this.null_value = false;
      let res = '';
      for (const a of this.args) {
        const r = a.val_str();
        if (r === null) { this.null_value = true; return null; }
        res += r;
      }
      if (res.length > 1048576) { this.null_value = true; return null; }
      return res;
    }
  }
  class Item_func_concat_ws extends Item_str_func {
    constructor(sep, list) { super(list); this.separator = sep; }
    func_name() { return 'concat_ws'; }
    children() { return [this.separator, ...this.args]; }
    fix_fields(ctx) { this.separator.fix_fields(ctx); super.fix_fields(ctx); }
    fix_length_and_dec() {
      this.max_length = this.args.reduce((s, a) => s + a.max_length, 0); this.cap_blob();
      this.used_tables_cache |= this.separator.used_tables();
      this.const_item_cache = this.const_item_cache && this.separator.const_item();
    }
    val_str() {
      this.null_value = false;
      const sep = this.separator.val_str();
      if (sep === null) { this.null_value = true; return null; }
      const parts = [];
      for (const a of this.args) { const r = a.val_str(); if (r !== null && r.length) parts.push(r); }
      return parts.join(sep);
    }
  }
  class Item_func_trim extends Item_str_func {
    constructor(a, b, mode) { super([a, b]); this.mode = mode; }
    func_name() { return this.mode; }
    fix_length_and_dec() { this.max_length = this.args[0].max_length; }
    val_str() {
      const res = this.args[0].val_str();
      if ((this.null_value = this.args[0].null_value)) return null;
      const rem = this.args[1].val_str();
      if (rem === null || !rem.length || rem.length > res.length) return res;
      let s = 0, e = res.length;
      const n = rem.length;
      if (this.mode !== 'rtrim') {
        if (this.mode === 'ltrim' && n === 1) { while (s !== e && res[s] === rem) s++; }
        else if (this.mode === 'ltrim') { while (s < e - n && res.substr(s, n) === rem) s += n; }
        else while (s + n <= e && res.substr(s, n) === rem) s += n;
      }
      if (this.mode !== 'ltrim') {
        if (this.mode === 'rtrim' && n === 1) { while (s !== e && res[e - 1] === rem) e--; }
        else if (this.mode === 'rtrim') { while (s + n < e && res.substr(e - n, n) === rem) e -= n; }
        else while (s + n <= e && res.substr(e - n, n) === rem) e -= n;
      }
      return res.slice(s, e);
    }
  }
  class Item_func_format extends Item_str_func {
    constructor(a, dec) { super([a]); this.decimals = Math.max(0, Math.min(30, dec)); }
    func_name() { return 'format'; }
    fix_length_and_dec() { const a = this.args[0]; this.max_length = a.max_length + Math.trunc((a.max_length - a.decimals) / 3); }
    val_str() {
      const nr = this.args[0].val();
      if ((this.null_value = this.args[0].null_value)) return null;
      const dec = this.decimals ? this.decimals + 1 : 0;
      let s = setDouble(nr, this.decimals);
      let str_length = s.length;
      if (nr < 0) str_length--;
      const diff = Math.trunc((str_length - dec - 1) / 3);
      if (diff > 0) {
        const neg = s[0] === '-' ? '-' : '';
        const body = neg ? s.slice(1) : s;
        const intLen = body.length - dec;
        let ip = body.slice(0, intLen), out = '';
        while (ip.length > 3) { out = ',' + ip.slice(-3) + out; ip = ip.slice(0, -3); }
        s = neg + ip + out + body.slice(intLen);
      }
      return s;
    }
  }
  class Item_func_repeat extends Item_str_func {
    func_name() { return 'repeat'; }
    fix_length_and_dec() {
      if (this.args[1].const_item()) {
        this.max_length = this.args[0].max_length * Number(BigInt.asIntN(32, this.args[1].val_int()));
        if (this.max_length >= MAX_BLOB_WIDTH || this.max_length < 0) { this.max_length = MAX_BLOB_WIDTH; this.maybe_null = true; }
      } else { this.max_length = MAX_BLOB_WIDTH; this.maybe_null = true; }
    }
    val_str() {
      const count = Number(BigInt.asIntN(32, this.args[1].val_int()));
      const res = this.args[0].val_str();
      if (this.args[0].null_value || this.args[1].null_value) { this.null_value = true; return null; }
      this.null_value = false;
      if (count <= 0) return '';
      if (res.length * count > 1048576) { this.null_value = true; return null; }
      return res.repeat(count);
    }
  }
  class Item_func_pad extends Item_str_func {
    constructor(args, left) { super(args); this.left = left; }
    func_name() { return this.left ? 'lpad' : 'rpad'; }
    fix_length_and_dec() {
      if (this.args[1].const_item()) {
        const len = Number(BigInt.asUintN(32, this.args[1].val_int()));
        this.max_length = Math.max(this.args[0].max_length, len);
        if (this.max_length >= MAX_BLOB_WIDTH) { this.max_length = MAX_BLOB_WIDTH; this.maybe_null = true; }
      } else { this.max_length = MAX_BLOB_WIDTH; this.maybe_null = true; }
    }
    val_str() {
      const count = this.left ? Number(BigInt.asUintN(32, this.args[1].val_int())) : Number(BigInt.asIntN(32, this.args[1].val_int()));
      const res = this.args[0].val_str(), pad = this.args[2].val_str();
      if (res === null || this.args[1].null_value || pad === null) { this.null_value = true; return null; }
      this.null_value = false;
      if (count <= res.length) return res.slice(0, Math.max(0, count));
      if (count > 1048576 || !pad.length) { this.null_value = true; return null; }
      let fill = pad.repeat(Math.ceil((count - res.length) / pad.length)).slice(0, count - res.length);
      return this.left ? fill + res : res + fill;
    }
  }
  class Item_func_conv extends Item_str_func {
    func_name() { return 'conv'; }
    fix_length_and_dec() { this.decimals = 0; this.max_length = 64; }
    val_str() {
      const res = this.args[0].val_str();
      const from = Number(BigInt.asIntN(32, this.args[1].val_int())), to = Number(BigInt.asIntN(32, this.args[2].val_int()));
      if (this.args[0].null_value || this.args[1].null_value || this.args[2].null_value || Math.abs(to) > 36 || Math.abs(to) < 2 ||
        Math.abs(from) > 36 || Math.abs(from) < 2 || !res.length) { this.null_value = true; return null; }
      this.null_value = false;
      const dec = strtoBase(res, Math.abs(from), from < 0);
      return longlong2str(dec, to);
    }
  }
  // strtoll()/strtoull() with a base
  function strtoBase(s, base, signed) {
    let i = 0;
    while (i < s.length && c_isspace(cc(s, i))) i++;
    let neg = false;
    if (s[i] === '-' || s[i] === '+') { neg = s[i] === '-'; i++; }
    if (base === 16 && s[i] === '0' && (s[i + 1] === 'x' || s[i + 1] === 'X')) i += 2;
    let v = 0n, any = false, over = false;
    const B = BigInt(base);
    for (; i < s.length; i++) {
      const d = parseInt(s[i], 36);
      if (isNaN(d) || d >= base) break;
      v = v * B + BigInt(d);
      any = true;
      if (v > ULL_MAX) over = true;
    }
    if (!any) return 0n;
    if (signed) {
      if (over || (!neg && v > LL_MAX)) return LL_MAX;
      if (neg && v > -LL_MIN) return LL_MIN;
      return neg ? -v : v;
    }
    if (over) return -1n;
    return BigInt.asIntN(64, neg ? -v : v);
  }
  // longlong2str(): negative radix means signed
  function longlong2str(v, radix) {
    if (radix < 0) return v.toString(-radix).toUpperCase();
    return BigInt.asUintN(64, v).toString(radix).toUpperCase();
  }
  class Item_func_elt extends Item_str_func {
    constructor(item, list) { super(list); this.item = item; }
    func_name() { return 'elt'; }
    children() { return [this.item, ...this.args]; }
    fix_fields(ctx) { this.item.fix_fields(ctx); super.fix_fields(ctx); }
    fix_length_and_dec() {
      this.max_length = 0; this.decimals = 0;
      // (from the second string on, as MySQL's loop does)
      for (const a of this.args.slice(1)) { this.max_length = Math.max(this.max_length, a.max_length); this.decimals = Math.max(this.decimals, a.decimals); }
      this.maybe_null = true;
      this.with_sum_func = this.with_sum_func || this.item.with_sum_func;
      this.used_tables_cache |= this.item.used_tables();
      this.const_item_cache = this.const_item_cache && this.item.const_item();
    }
    pickArg() {
      const n = Number(BigInt.asUintN(32, this.item.val_int()));
      if (n === 0 || n > this.args.length) { this.null_value = true; return null; }
      this.null_value = false;
      return this.args[n - 1];
    }
    val_str() { const a = this.pickArg(); return a ? a.val_str() : null; }
    val() { const a = this.pickArg(); return a ? a.val() : 0; }
    val_int() { const a = this.pickArg(); return a ? a.val_int() : 0n; }
  }
  class Item_func_make_set extends Item_str_func {
    constructor(item, list) { super(list); this.item = item; }
    func_name() { return 'make_set'; }
    children() { return [this.item, ...this.args]; }
    fix_fields(ctx) { this.item.fix_fields(ctx); super.fix_fields(ctx); }
    fix_length_and_dec() {
      // (the sum starts at the second string, as MySQL's loop does)
      this.max_length = this.args.length - 1 + this.args.slice(1).reduce((s, a) => s + a.max_length, 0);
      this.used_tables_cache |= this.item.used_tables();
      this.const_item_cache = this.const_item_cache && this.item.const_item();
    }
    val_str() {
      let bits = BigInt.asUintN(64, this.item.val_int());
      if ((this.null_value = this.item.null_value)) return null;
      if (this.args.length < 64) bits &= (1n << BigInt(this.args.length)) - 1n;
      const out = [];
      for (let i = 0; bits; bits >>= 1n, i++) if (bits & 1n) { const r = this.args[i].val_str(); if (r !== null) out.push(r); }
      return out.join(',');
    }
  }
  class Item_func_char extends Item_str_func {
    func_name() { return 'char'; }
    fix_length_and_dec() { this.maybe_null = false; this.max_length = this.args.length; this.binary = false; }
    val_str() {
      let s = '';
      for (const a of this.args) { const n = Number(BigInt.asIntN(32, a.val_int())); if (!a.null_value) s += String.fromCharCode(n & 255); }
      this.null_value = false;
      return s;
    }
  }
  class Item_func_binary extends Item_str_func {
    constructor(a) { super([a]); }
    func_name() { return 'binary'; }
    fix_length_and_dec() { this.binary = true; this.max_length = this.args[0].max_length; }
    val_str() { const r = this.args[0].val_str(); this.null_value = this.args[0].null_value; return r; }
  }
  class Item_func_database extends Item_str_func {
    func_name() { return 'database'; }
    fix_length_and_dec() { this.max_length = MAX_FIELD_NAME; }
    val_str() { this.null_value = false; return THD.conn.db || ''; }
  }
  class Item_func_user extends Item_str_func {
    func_name() { return 'user'; }
    fix_length_and_dec() { this.max_length = 16 + 60 + 1; }
    val_str() { this.null_value = false; return THD.conn.user + '@' + THD.conn.host; }
  }
  // SQL_CRYPT (sql/sql_crypt.cc): ENCODE()/DECODE()
  class SqlCrypt {
    constructor(seed) {
      const hash = hash_password(seed);
      const r = {};
      randominit(r, hash[0], hash[1]);
      this.decode_buff = new Uint8Array(256); this.encode_buff = new Uint8Array(256);
      for (let i = 0; i <= 255; i++) this.decode_buff[i] = i;
      for (let i = 0; i <= 255; i++) {
        const idx = Math.floor(rnd(r) * 255.0);
        const a = this.decode_buff[idx]; this.decode_buff[idx] = this.decode_buff[i]; this.decode_buff[i] = a;
      }
      for (let i = 0; i <= 255; i++) this.encode_buff[this.decode_buff[i]] = i;
      this.org_rand = { ...r };
    }
    init() { this.rand = { ...this.org_rand }; this.shift = 0; }
    encode(s) {
      let o = '';
      for (let i = 0; i < s.length; i++) {
        this.shift ^= Math.floor(rnd(this.rand) * 255.0);
        const idx = cc(s, i) ^ this.shift;
        o += String.fromCharCode(this.encode_buff[idx]);
        this.shift ^= this.encode_buff[idx];
      }
      return o;
    }
    decode(s) {
      let o = '';
      for (let i = 0; i < s.length; i++) {
        this.shift ^= Math.floor(rnd(this.rand) * 255.0);
        const idx = this.decode_buff[cc(s, i)] ^ this.shift;
        o += String.fromCharCode(idx);
        this.shift ^= cc(s, i);
      }
      return o;
    }
  }
  // hash_password() (sql/password.c): the pre-4.1 PASSWORD() hash
  function hash_password(pw) {
    let nr = 1345345333, add = 7, nr2 = 0x12345671;
    for (let i = 0; i < pw.length; i++) {
      const c = cc(pw, i);
      if (c === 32 || c === 9) continue;
      nr = (nr ^ ((((nr & 63) + add) * c) + Math.imul(nr, 256))) >>> 0;
      nr2 = (nr2 + ((Math.imul(nr2, 256) ^ nr) >>> 0)) >>> 0;
      add += c;
    }
    return [(nr & 0x7fffffff) >>> 0, (nr2 & 0x7fffffff) >>> 0];
  }
  const make_scrambled_password = (pw) => hash_password(pw).map((x) => x.toString(16).padStart(8, '0')).join('');
  class Item_func_encode extends Item_str_func {
    constructor(a, seed, dec) { super([a]); this.crypt = new SqlCrypt(seed); this.dec = dec; }
    func_name() { return this.dec ? 'decode' : 'encode'; }
    fix_length_and_dec() { this.max_length = this.args[0].max_length; this.maybe_null = this.args[0].maybe_null; }
    val_str() {
      const r = this.args[0].val_str();
      if (r === null) { this.null_value = true; return null; }
      this.null_value = false;
      this.crypt.init();
      return this.dec ? this.crypt.decode(r) : this.crypt.encode(r);
    }
  }
  const SOUNDEX_MAP = '01230120022455012623010202';
  function soundex(res) {
    let i = 0;
    while (i < res.length && my_isspace(cc(res, i))) i++;
    if (i === res.length) return '';
    const scode = (c) => { const ch = TO_UPPER[c]; return ch < 65 || ch > 90 ? '0' : SOUNDEX_MAP[ch - 65]; };
    let out = String.fromCharCode(TO_UPPER[cc(res, i)]);
    let last = scode(cc(res, i));
    for (i++; i < res.length; i++) {
      const c = cc(res, i);
      if (!my_isalpha(c)) continue;
      const ch = scode(c);
      if (ch !== '0' && ch !== last) { out += ch; last = ch; }
    }
    while (out.length < 4) out += '0';
    return out;
  }
  function md5(str) {
    const K = [], S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    const bytes = strToBytes(str);
    const len = bytes.length, nblk = ((len + 8) >> 6) + 1;
    const w = new Uint32Array(nblk * 16);
    for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
    w[len >> 2] |= 0x80 << ((len % 4) * 8);
    w[nblk * 16 - 2] = (len * 8) >>> 0;
    w[nblk * 16 - 1] = Math.floor(len / 0x20000000);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let o = 0; o < w.length; o += 16) {
      let a = a0, b = b0, c = c0, d = d0;
      for (let i = 0; i < 64; i++) {
        let f, g;
        if (i < 16) { f = (b & c) | (~b & d); g = i; }
        else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
        else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
        else { f = c ^ (b | ~d); g = (7 * i) % 16; }
        const tmp = d; d = c; c = b;
        const x = (a + f + K[i] + w[o + g]) >>> 0;
        const s = S[(i >> 4) * 4 + (i % 4)];
        b = (b + ((x << s) | (x >>> (32 - s)))) >>> 0;
        a = tmp;
      }
      a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
    }
    return [a0, b0, c0, d0].map((v) => [0, 8, 16, 24].map((s) => ((v >>> s) & 255).toString(16).padStart(2, '0')).join('')).join('');
  }
  const I32 = (it) => Number(BigInt.asIntN(32, it.val_int()));
  const STR_FUNCS = {
    md5: mkStr('md5', 1, (v) => md5(v[0]), function () { this.max_length = 32; }),
    reverse: mkStr('reverse', 1, (v) => v[0].split('').reverse().join('')),
    lcase: mkStr('lcase', 1, (v) => caseDn(v[0])),
    ucase: mkStr('ucase', 1, (v) => caseUp(v[0])),
    password: mkStr('password', 1, (v) => (v[0].length ? make_scrambled_password(v[0]) : ''), function () { this.max_length = 16; }),
    soundex: mkStr('soundex', 1, (v) => soundex(v[0]), function () { this.max_length = Math.max(this.args[0].max_length, 4); }),
    substring_index: mkStr('substr_index', 3, function (v, a) {
      const count = I32(a[2]);
      if (a[2].null_value) return null;
      const [res, delim] = v;
      if (!res.length || !delim.length || !count) return '';
      if (count > 0) {
        let off = -delim.length, n = count;
        for (;;) {
          off = res.indexOf(delim, off + delim.length);
          if (off < 0) return res;
          if (!--n) return res.slice(0, off);
        }
      }
      let off = res.length, n = count;
      for (;;) {
        off = res.lastIndexOf(delim, off - delim.length);
        if (off < 0 || off + delim.length > res.length) return res;
        if (!++n) return res.slice(off + delim.length);
        if (off === 0) return res;
      }
    }),
    insert: mkStr('insert', 4, function (v, a) {
      let start = Number(BigInt.asUintN(32, a[1].val_int() - 1n)), length = Number(BigInt.asUintN(32, a[2].val_int()));
      if (a[1].null_value || a[2].null_value) return null;
      const res = v[0];
      if (start > res.length + 1) return res;
      if (length > res.length - start) length = Math.max(0, res.length - start);
      return res.slice(0, start) + v[3] + res.slice(start + length);
    }, function () { this.max_length = this.args[0].max_length + this.args[3].max_length; this.cap_blob(); }),
    replace: mkStr('replace', 3, function (v) {
      if (!v[1].length) return v[0];
      return v[0].split(v[1]).join(v[2]);
    }, function () {
      this.max_length = this.args[0].max_length;
      const diff = this.args[2].max_length - this.args[1].max_length;
      if (diff > 0 && this.args[1].max_length) this.max_length = (Math.trunc(this.max_length / this.args[1].max_length) + 1) * diff;
      this.cap_blob();
    }),
    left: mkStr('left', 1, function (v, a) {
      const len = I32(a[1]);
      if (len <= 0) return '';
      return v[0].slice(0, len);
    }, function () { this.left_right_max_length(); }),
    right: mkStr('right', 1, function (v, a) {
      const len = I32(a[1]);
      if (len <= 0) return '';
      return v[0].length <= len ? v[0] : v[0].slice(v[0].length - len);
    }, function () { this.left_right_max_length(); }),
    substr: mkStr('substr', 1, function (v, a) {
      const start = I32(a[1]) - 1;
      const length = a.length === 3 ? I32(a[2]) : 2147483647;
      if (a[1].null_value || (a.length === 3 && a[2].null_value)) return null;
      const res = v[0];
      if (start < 0 || start + 1 > res.length || length <= 0) return '';
      return res.substr(start, Math.min(length, res.length - start));
    }, function () {
      this.max_length = this.args[0].max_length;
      if (this.args[1].const_item()) {
        const start = I32(this.args[1]) - 1;
        if (start < 0 || start >= this.max_length) this.max_length = 0; else this.max_length -= start;
      }
      if (this.args.length === 3 && this.args[2].const_item()) {
        const len = I32(this.args[2]);
        if (len <= 0) this.max_length = 0; else if (len < this.max_length) this.max_length = len;
      }
    }),
    export_set: mkStr('export_set', 0, function (v, a) {
      const set = BigInt.asUintN(64, a[0].val_int());
      if (a[0].null_value || v[1] === null || v[2] === null) return null;
      let n = 64, sep = ',';
      if (a.length === 5) { n = Math.min(64, I32(a[4])); if (a[4].null_value) return null; }
      if (a.length >= 4) { sep = v[3]; if (sep === null) return null; }
      const out = [];
      for (let i = 0; i < n; i++) out.push((set >> BigInt(i)) & 1n ? v[1] : v[2]);
      return out.join(sep);
    }, function () {
      const len = Math.max(this.args[1].max_length, this.args[2].max_length);
      this.max_length = len * 64 + (this.args.length > 3 ? this.args[3].max_length : 1) * 63;
    }),
    inet_ntoa: mkStr('inet_ntoa', 0, function (v, a) {
      const n = BigInt.asUintN(64, a[0].val_int());
      if (a[0].null_value) return null;
      const b = [];
      for (let i = 0; i < 8; i++) b.push(Number((n >> BigInt(8 * i)) & 255n));
      let p = 8;
      while (p > 4 && b[p - 1] === 0) p--;
      const out = [];
      while (p-- > 0) out.push(String(b[p]));
      return out.join('.');
    }, function () { this.decimals = 0; this.max_length = 3 * 8 + 7; }),
    // Item_load_file: a world-readable file of at most max_allowed_packet bytes
    load_file: mkStr('load_file', 1, (v) => {
      const srv = THD.conn.srv;
      const path = absPath(srv, v[0]);
      const s = srv.fileStat(path);
      if (!s || !(s.mode & 4) || (s.mode & 0o170000) !== 0o100000) return null;
      const d = srv.fileRead(path);
      return d === null || d.length > 1048576 ? null : d;
    }, function () { this.binary = true; this.maybe_null = true; this.max_length = MAX_BLOB_WIDTH; }),
    encrypt: mkStr('encrypt', 1, function (v, a) {
      if (!v[0].length) return '';
      let salt;
      if (a.length === 1) {
        const t = THD.query_start;
        const b2a = (c) => String.fromCharCode(c >= 38 ? c - 38 + 97 : c >= 12 ? c - 12 + 65 : c + 46);
        salt = b2a(t & 0x3f) + b2a((t >> 5) & 0x3f);
      } else {
        salt = v[1];
        if (a[1].null_value || salt === null || salt.length < 2) return null;
      }
      return des_crypt(v[0], salt);
    }, function () { this.maybe_null = true; this.max_length = 13; }),
  };

  // ---------------------------------------------------------------------------
  // Date and time functions (sql/item_timefunc.cc)
  // ---------------------------------------------------------------------------
  class Item_date_int extends Item_int_func {
    constructor(args, name, len, fn, maybe) { super(args); this.fname = name; this.len = len; this.fn = fn; this.maybe = maybe; }
    func_name() { return this.fname; }
    fix_length_and_dec() { this.decimals = 0; this.max_length = this.len; if (this.maybe) this.maybe_null = true; }
    val_int() { const r = this.fn.call(this, this.args); return typeof r === 'bigint' ? r : BigInt(r); }
  }
  const tm = () => newTime();
  function dateInt(name, len, fn, maybe = true) { return (args) => new Item_date_int(args, name, len, fn, maybe); }
  const DATE_FUNCS = {
    period_add: dateInt('period_add', 6, function (a) {
      const period = Number(BigInt.asUintN(32, a[0].val_int())), months = I32(a[1]);
      if ((this.null_value = a[0].null_value || a[1].null_value) || period === 0) return 0;
      return convert_month_to_period(Number(BigInt.asUintN(32, BigInt(convert_period_to_month(period) + months))));
    }, false),
    period_diff: dateInt('period_diff', 6, function (a) {
      const p1 = Number(BigInt.asUintN(32, a[0].val_int())), p2 = Number(BigInt.asUintN(32, a[1].val_int()));
      if ((this.null_value = a[0].null_value || a[1].null_value)) return 0;
      return convert_period_to_month(p1) - convert_period_to_month(p2);
    }, false),
    to_days: dateInt('to_days', 6, function () { const t = tm(); if (this.get_arg0_date(t, false)) return 0; return calc_daynr(t.year, t.month, t.day); }, false),
    dayofyear: dateInt('dayofyear', 3, function () { const t = tm(); if (this.get_arg0_date(t, false)) return 0; return calc_daynr(t.year, t.month, t.day) - calc_daynr(t.year, 1, 1) + 1; }),
    dayofmonth: dateInt('dayofmonth', 2, function () { const t = tm(); this.get_arg0_date(t, true); return t.day; }),
    month: dateInt('month', 2, function () { const t = tm(); this.get_arg0_date(t, true); return t.month; }),
    quarter: dateInt('quarter', 1, function () { const t = tm(); this.get_arg0_date(t, true); return Math.trunc((t.month + 2) / 3); }),
    hour: dateInt('hour', 2, function () { const t = tm(); this.get_arg0_time(t); return t.hour; }),
    minute: dateInt('minute', 2, function () { const t = tm(); this.get_arg0_time(t); return t.minute; }),
    second: dateInt('second', 2, function () { const t = tm(); this.get_arg0_time(t); return t.second; }),
    week: dateInt('week', 2, function (a) { const t = tm(); if (this.get_arg0_date(t, false)) return 0; return calc_week(t, false, a[1].val_int() === 0n).week; }),
    yearweek: dateInt('yearweek', 6, function (a) { const t = tm(); if (this.get_arg0_date(t, false)) return 0; const w = calc_week(t, true, a[1].val_int() === 0n); return w.week + w.year * 100; }),
    year: dateInt('year', 4, function () { const t = tm(); this.get_arg0_date(t, true); return t.year; }),
    unix_timestamp: dateInt('timestamp', 10, function (a) {
      if (!a.length) return THD.query_start;
      if (a[0].type() === 'FIELD_ITEM' && a[0].field.type() === T.TIMESTAMP) {
        this.null_value = a[0].field.is_null();
        return a[0].field.get_timestamp();
      }
      const s = a[0].val_str();
      if ((this.null_value = a[0].null_value)) return 0;
      return str_to_timestamp(s);
    }, false),
    time_to_sec: dateInt('time_to_sec', 10, function () {
      const t = tm();
      this.get_arg0_time(t);
      const s = t.hour * 3600 + t.minute * 60 + t.second;
      return t.neg ? -s : s;
    }, false),
  };
  // month(), weekday(), dayname(), monthname(): Item_func subclasses with their own types
  class Item_func_weekday extends Item_func {
    constructor(a, odbc) { super([a]); this.odbc = odbc; }
    func_name() { return 'weekday'; }
    result_type() { return INT_RESULT; }
    fix_length_and_dec() { this.decimals = 0; this.max_length = 1; this.maybe_null = true; }
    val_int() {
      const v = Number(BigInt.asUintN(32, this.args[0].val_int()));
      if ((this.null_value = this.args[0].null_value || !v)) return 0n;
      return BigInt(calc_weekday(v, this.odbc) + (this.odbc ? 1 : 0));
    }
    val() { return Number(this.val_int()); }
    val_str() { const v = this.val_int(); return this.null_value ? null : v.toString(); }
  }
  class Item_func_dayname extends Item_func_weekday {
    constructor(a) { super(a, false); }
    func_name() { return 'dayname'; }
    result_type() { return STRING_RESULT; }
    fix_length_and_dec() { this.decimals = 0; this.max_length = 9; this.maybe_null = true; }
    val_str() { const w = Number(this.val_int()); return this.null_value ? null : DAY_NAMES[w]; }
  }
  class Item_func_monthname extends Item_func {
    constructor(a) { super([a]); }
    func_name() { return 'monthname'; }
    result_type() { return STRING_RESULT; }
    fix_length_and_dec() { this.decimals = 0; this.max_length = 10; this.maybe_null = true; }
    val_int() { const t = tm(); this.get_arg0_date(t, true); return BigInt(t.month); }
    val() { return Number(this.val_int()); }
    val_str() { const m = Number(this.val_int()); if (!m) { this.null_value = true; return null; } this.null_value = false; return MONTH_NAMES[m - 1]; }
  }
  // Item_date: FROM_DAYS(), CURDATE()
  class Item_date extends Item_func {
    result_type() { return STRING_RESULT; }
    fix_length_and_dec() { this.decimals = 0; this.max_length = 10; }
    val() { return Number(this.val_int()); }
    val_str() {
      const v = Number(this.val_int());
      if (this.null_value) return null;
      if (!v) return '0000-00-00';
      return pad4(Math.trunc(v / 10000) % 10000) + '-' + pad2(Math.trunc(v / 100) % 100) + '-' + pad2(v % 100);
    }
    get_date(t, fuzzy) {
      const v = Number(this.val_int());
      if (this.null_value) { Object.assign(t, newTime()); return true; }
      Object.assign(t, newTime());
      t.year = Math.trunc(v / 10000); t.month = Math.trunc(v / 100) % 100; t.day = v % 100; t.time_type = TS_DATE;
      return !fuzzy && (!t.month || !t.day);
    }
    save_in_field(field) {
      const t = newTime();
      let tt = TS_FULL;
      if (this.get_date(t, true)) { if (this.null_value) return set_field_to_null(field); tt = TS_NONE; }
      field.set_notnull();
      field.store_time(t, tt);
      return false;
    }
  }
  class Item_func_from_days extends Item_date {
    constructor(a) { super([a]); }
    func_name() { return 'from_days'; }
    val_int() {
      const v = this.args[0].val_int();
      if ((this.null_value = this.args[0].null_value)) return 0n;
      const d = get_date_from_daynr(Number(BigInt.asIntN(32, v)));
      return BigInt(d.year * 10000 + d.month * 100 + d.day);
    }
  }
  class Item_func_curdate extends Item_date {
    func_name() { return 'curdate'; }
    fix_length_and_dec() {
      super.fix_length_and_dec();
      const l = THD.tz.localtime(THD.query_start);
      this.value = (l.year) * 10000 + (l.mon + 1) * 100 + l.mday;
    }
    val_int() { this.null_value = false; return BigInt(this.value); }
  }
  class Item_func_curtime extends Item_func {
    func_name() { return 'curtime'; }
    result_type() { return STRING_RESULT; }
    fix_length_and_dec() {
      this.decimals = 0; this.max_length = 8;
      const l = THD.tz.localtime(THD.query_start);
      this.value = l.hour * 10000 + l.min * 100 + l.sec;
      this.buff = pad2(l.hour) + ':' + pad2(l.min) + ':' + pad2(l.sec);
    }
    val() { return this.value; }
    val_int() { return BigInt(this.value); }
    val_str() { return this.buff; }
  }
  class Item_func_now extends Item_func {
    func_name() { return 'now'; }
    result_type() { return STRING_RESULT; }
    fix_length_and_dec() {
      this.decimals = 0; this.max_length = 19;
      this.ltime = tmToTime(THD.tz.localtime(THD.query_start));
      const t = this.ltime;
      this.value = ((t.year % 10000) * 10000 + t.month * 100 + t.day) * 1000000 + t.hour * 10000 + t.minute * 100 + t.second;
      this.buff = fmtDateTime({ ...t, year: t.year % 10000 });
    }
    val() { return this.value; }
    val_int() { return BigInt(this.value); }
    val_str() { return this.buff; }
    get_date(t) { Object.assign(t, this.ltime); return false; }
    save_in_field(f) { f.set_notnull(); f.store_time(this.ltime, TS_FULL); return false; }
  }
  class Item_func_date_format extends Item_str_func {
    constructor(a, b, date_or_time) { super([a, b]); this.date_or_time = date_or_time; }
    func_name() { return 'date_format'; }
    fix_length_and_dec() {
      this.decimals = 0;
      if (this.args[1].type() === 'STRING_ITEM') { this.fixed_length = true; this.max_length = format_length(this.args[1].str_value); }
      else { this.fixed_length = false; this.max_length = Math.min(this.args[1].max_length * 10, MAX_BLOB_WIDTH); }
      this.maybe_null = true;
    }
    val_str() {
      const t = newTime();
      if (!this.date_or_time) { if (this.get_arg0_date(t, true)) return null; }
      else {
        const r = this.args[0].val_str();
        if (r === null || str_to_time(r, t)) { this.null_value = true; return null; }
        t.year = t.month = t.day = 0;
        this.null_value = false;
      }
      const fmt = this.args[1].val_str();
      if (fmt === null || !fmt.length) { this.null_value = true; return null; }
      let s = '';
      for (let i = 0; i < fmt.length; i++) {
        if (fmt[i] !== '%' || i + 1 === fmt.length) { s += fmt[i]; continue; }
        const c = fmt[++i];
        const bad = () => { this.null_value = true; return null; };
        switch (c) {
          case 'M': if (!t.month) return bad(); s += MONTH_NAMES[t.month - 1]; break;
          case 'b': if (!t.month) return bad(); s += MONTH_NAMES[t.month - 1].slice(0, 3); break;
          case 'W': if (this.date_or_time) return bad(); s += DAY_NAMES[calc_weekday(calc_daynr(t.year, t.month, t.day), false)]; break;
          case 'a': if (this.date_or_time) return bad(); s += DAY_NAMES[calc_weekday(calc_daynr(t.year, t.month, t.day), false)].slice(0, 3); break;
          case 'D':
            if (this.date_or_time) return bad();
            s += t.day + (t.day >= 10 && t.day <= 19 ? 'th' : ['th', 'st', 'nd', 'rd'][t.day % 10] || 'th');
            break;
          case 'Y': s += pad4(t.year); break;
          case 'y': s += pad2(t.year % 100); break;
          case 'm': s += pad2(t.month); break;
          case 'c': s += t.month; break;
          case 'd': s += pad2(t.day); break;
          case 'e': s += t.day; break;
          case 'H': s += pad2(t.hour); break;
          case 'h': case 'I': s += pad2((t.hour + 11) % 12 + 1); break;
          case 'i': s += pad2(t.minute); break;
          case 'j': if (this.date_or_time) return bad(); s += String(calc_daynr(t.year, t.month, t.day) - calc_daynr(t.year, 1, 1) + 1).padStart(3, '0'); break;
          case 'k': s += t.hour; break;
          case 'l': s += (t.hour + 11) % 12 + 1; break;
          case 'p': s += t.hour < 12 ? 'AM' : 'PM'; break;
          case 'r': s += pad2((t.hour + 11) % 12 + 1) + ':' + pad2(t.minute) + ':' + pad2(t.second) + (t.hour < 12 ? ' AM' : ' PM'); break;
          case 'S': case 's': s += pad2(t.second); break;
          case 'T': s += pad2(t.hour) + ':' + pad2(t.minute) + ':' + pad2(t.second); break;
          case 'U': case 'u': s += pad2(calc_week(t, false, c === 'U').week); break;
          case 'v': case 'V': s += pad2(calc_week(t, true, c === 'V').week); break;
          case 'x': case 'X': s += pad4(calc_week(t, true, c === 'X').year); break;
          case 'w': s += calc_weekday(calc_daynr(t.year, t.month, t.day), true); break;
          default: s += c;
        }
      }
      return s;
    }
  }
  function format_length(f) {
    let size = 0;
    for (let i = 0; i < f.length; i++) {
      if (f[i] !== '%' || i === f.length - 1) { size++; continue; }
      const c = f[++i];
      if ('MW'.includes(c)) size += 9;
      else if ('DYxX'.includes(c)) size += 4;
      else if ('abj'.includes(c)) size += 3;
      else if ('UuVvHymdhIiklpSsce'.includes(c)) size += 2;
      else if (c === 'r') size += 11;
      else if (c === 'T') size += 8;
      else size++;
    }
    return size;
  }
  class Item_func_from_unixtime extends Item_func {
    constructor(a) { super([a]); }
    func_name() { return 'from_unixtime'; }
    result_type() { return STRING_RESULT; }
    fix_length_and_dec() { this.decimals = 0; this.max_length = 19; }
    lt() { const v = this.args[0].val_int(); if ((this.null_value = this.args[0].null_value)) return null; return THD.tz.localtime(Number(BigInt.asIntN(32, v))); }
    val_str() {
      const l = this.lt();
      if (!l) return null;
      return pad4(l.year) + '-' + pad2(l.mon + 1) + '-' + pad2(l.mday) + ' ' + pad2(l.hour) + ':' + pad2(l.min) + ':' + pad2(l.sec);
    }
    val_int() {
      const l = this.lt();
      if (!l) return 0n;
      return BigInt((l.year * 10000 + (l.mon + 1) * 100 + l.mday) * 1000000 + l.hour * 10000 + l.min * 100 + l.sec);
    }
    val() { return Number(this.val_int()); }
    get_date(t) { const l = this.lt(); if (!l) return true; Object.assign(t, tmToTime(l)); return false; }
  }
  class Item_func_sec_to_time extends Item_str_func {
    constructor(a) { super([a]); }
    func_name() { return 'sec_to_time'; }
    fix_length_and_dec() { this.maybe_null = true; this.max_length = 13; }
    val_str() {
      let s = this.args[0].val_int();
      if ((this.null_value = this.args[0].null_value)) return null;
      let sign = '';
      if (s < 0n) { s = -s; sign = '-'; }
      const sec = Number(s % 3600n);
      return sign + String(s / 3600n).padStart(2, '0') + ':' + pad2(Math.trunc(sec / 60)) + ':' + pad2(sec % 60);
    }
    val_int() {
      let s = this.args[0].val_int();
      if ((this.null_value = this.args[0].null_value)) return 0n;
      let sign = 1n;
      if (s < 0n) { s = -s; sign = -1n; }
      return sign * ((s / 3600n) * 10000n + ((s / 60n) % 60n) * 100n + s % 60n);
    }
    val() { return Number(this.val_int()); }
  }
  const DATE_UNITS = ['SECOND', 'MINUTE', 'HOUR', 'MINUTE_SECOND', 'HOUR_SECOND', 'HOUR_MINUTE', 'DAY_SECOND', 'DAY_MINUTE', 'DAY_HOUR'];
  class Item_date_add_interval extends Item_str_func {
    constructor(a, b, unit, sub) { super([a, b]); this.unit = unit; this.sub = sub; }
    func_name() { return 'date_add_interval'; }
    fix_length_and_dec() { this.maybe_null = true; this.max_length = 19; }
    get_interval() {
      const it = this.args[1], u = this.unit;
      const iv = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0, neg: false };
      if (['YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND'].includes(u)) {
        let value = Number(BigInt.asIntN(32, it.val_int()));
        if (it.null_value) return null;
        if (value < 0) { iv.neg = true; value = -value; }
        iv[u.toLowerCase()] = value;
        return iv;
      }
      let s = it.val_str();
      if (s === null) return null;
      let i = 0;
      while (i < s.length && my_isspace(cc(s, i))) i++;
      if (i < s.length && s[i] === '-') { iv.neg = true; i++; }
      s = s.slice(i);
      const parts = { YEAR_MONTH: ['year', 'month'], DAY_HOUR: ['day', 'hour'], DAY_MINUTE: ['day', 'hour', 'minute'],
        DAY_SECOND: ['day', 'hour', 'minute', 'second'], HOUR_MINUTE: ['hour', 'minute'], HOUR_SECOND: ['hour', 'minute', 'second'],
        MINUTE_SECOND: ['minute', 'second'] }[u];
      const r = get_interval_info(s, parts.length);
      if (r.error) return null;
      parts.forEach((p, k) => { iv[p] = r.values[k]; });
      return iv;
    }
    get_date(t) {
      const iv = this.args[0].get_date(t, false) ? null : this.get_interval();
      if (!iv) { this.null_value = true; return true; }
      let sign = iv.neg ? -1 : 1;
      if (this.sub) sign = -sign;
      this.null_value = false;
      const u = this.unit;
      if (DATE_UNITS.includes(u)) {
        t.time_type = TS_FULL;
        let sec = (t.day - 1) * 86400 + t.hour * 3600 + t.minute * 60 + t.second +
          sign * (iv.day * 86400 + iv.hour * 3600 + iv.minute * 60 + iv.second);
        let days = Math.trunc(sec / 86400); sec -= days * 86400;
        if (sec < 0) { days--; sec += 86400; }
        t.second = sec % 60; t.minute = Math.trunc(sec / 60) % 60; t.hour = Math.trunc(sec / 3600);
        const daynr = calc_daynr(t.year, t.month, 1) + days;
        Object.assign(t, get_date_from_daynr(daynr));
        if (daynr < 0 || daynr >= 3652424) { this.null_value = true; return true; }
      } else if (u === 'DAY') {
        const period = calc_daynr(t.year, t.month, t.day) + sign * iv.day;
        if (period < 0 || period >= 3652424) { this.null_value = true; return true; }
        Object.assign(t, get_date_from_daynr(period));
      } else if (u === 'YEAR') {
        t.year += sign * iv.year;
        if (t.year < 0 || t.year >= 10000) { this.null_value = true; return true; }
        if (t.month === 2 && t.day === 29 && calc_days_in_year(t.year) !== 366) t.day = 28;
      } else {
        const period = t.year * 12 + sign * iv.year * 12 + t.month - 1 + sign * iv.month;
        if (period < 0 || period >= 120000) { this.null_value = true; return true; }
        t.year = Math.trunc(period / 12); t.month = period % 12 + 1;
        if (t.day > DAYS_IN_MONTH[t.month - 1]) {
          t.day = DAYS_IN_MONTH[t.month - 1];
          if (t.month === 2 && calc_days_in_year(t.year) === 366) t.day++;
        }
      }
      return false;
    }
    val_str() {
      const t = newTime();
      if (this.get_date(t)) return null;
      return t.time_type === TS_DATE ? fmtDate(t) : fmtDateTime(t);
    }
    val_int() {
      const t = newTime();
      if (this.get_date(t)) return 0n;
      return BigInt((t.year * 10000 + t.month * 100 + t.day) * 1000000 + t.hour * 10000 + t.minute * 100 + t.second);
    }
    val() { return Number(this.val_int()); }
  }
  class Item_extract extends Item_int_func {
    constructor(unit, a) { super([a]); this.unit = unit; }
    func_name() { return 'extract'; }
    fix_length_and_dec() {
      this.maybe_null = true;
      const L = { YEAR: [4, 1], YEAR_MONTH: [6, 1], MONTH: [2, 1], DAY: [2, 1], DAY_HOUR: [9, 0], DAY_MINUTE: [11, 0], DAY_SECOND: [13, 0],
        HOUR: [2, 0], HOUR_MINUTE: [4, 0], HOUR_SECOND: [6, 0], MINUTE: [2, 0], MINUTE_SECOND: [4, 0], SECOND: [2, 0] }[this.unit];
      this.max_length = L[0]; this.date_value = !!L[1];
    }
    val_int() {
      const t = newTime();
      let neg = 1;
      if (this.date_value) { if (this.get_arg0_date(t, true)) return 0n; }
      else {
        const r = this.args[0].val_str();
        if (r === null || str_to_time(r, t)) { this.null_value = true; return 0n; }
        neg = t.neg ? -1 : 1;
        this.null_value = false;
      }
      const v = { YEAR: t.year, YEAR_MONTH: t.year * 100 + t.month, MONTH: t.month, DAY: t.day, DAY_HOUR: (t.day * 100 + t.hour) * neg,
        DAY_MINUTE: (t.day * 10000 + t.hour * 100 + t.minute) * neg, DAY_SECOND: (t.day * 1000000 + t.hour * 10000 + t.minute * 100 + t.second) * neg,
        HOUR: t.hour * neg, HOUR_MINUTE: (t.hour * 100 + t.minute) * neg, HOUR_SECOND: (t.hour * 10000 + t.minute * 100 + t.second) * neg,
        MINUTE: t.minute * neg, MINUTE_SECOND: (t.minute * 100 + t.second) * neg, SECOND: t.second * neg }[this.unit];
      return BigInt(v);
    }
  }

  // crypt(3) of glibc: traditional DES, 25 rounds, 12-bit salt
  const des_crypt = (() => {
    const IP = [58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
      57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7];
    const FP = [40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31, 38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
      36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27, 34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25];
    const PC1 = [57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
      63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4];
    const PC2 = [14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
      41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32];
    const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];
    const E = [32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
      16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1];
    const P = [16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10, 2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25];
    const S = [
      [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8, 4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
      [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5, 0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
      [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1, 13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
      [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9, 10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
      [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6, 4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
      [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8, 9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
      [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6, 1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
      [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2, 7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
    ];
    const ALPH = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const a64 = (c) => { const i = ALPH.indexOf(c); return i < 0 ? 0 : i; };
    return (pw, salt) => {
      const key = [];
      for (let i = 0; i < 8; i++) { const c = i < pw.length ? cc(pw, i) : 0; for (let b = 6; b >= 0; b--) key.push((c >> b) & 1); key.push(0); }
      let cd = PC1.map((p) => key[p - 1]);
      const ks = [];
      for (let r = 0; r < 16; r++) {
        for (let s = 0; s < SHIFTS[r]; s++) { cd = [...cd.slice(1, 28), cd[0], ...cd.slice(29, 56), cd[28]]; }
        ks.push(PC2.map((p) => cd[p - 1]));
      }
      const s1 = salt.length > 0 ? salt[0] : '.', s2 = salt.length > 1 ? salt[1] : '.';
      const sv = a64(s1) | (a64(s2) << 6);
      const Ex = E.slice();
      for (let i = 0; i < 12; i++) if ((sv >> i) & 1) { const t = Ex[i]; Ex[i] = Ex[i + 24]; Ex[i + 24] = t; }
      let block = new Array(64).fill(0);
      for (let n = 0; n < 25; n++) {
        const ip = IP.map((p) => block[p - 1]);
        let L = ip.slice(0, 32), R = ip.slice(32);
        for (let r = 0; r < 16; r++) {
          const er = Ex.map((p) => R[p - 1]).map((b, i) => b ^ ks[r][i]);
          const f = [];
          for (let k = 0; k < 8; k++) {
            const b = er.slice(k * 6, k * 6 + 6);
            const v = S[k][(b[0] << 5) | (b[5] << 4) | (b[1] << 3) | (b[2] << 2) | (b[3] << 1) | b[4]];
            for (let q = 3; q >= 0; q--) f.push((v >> q) & 1);
          }
          const pf = P.map((p) => f[p - 1]);
          const nr = L.map((b, i) => b ^ pf[i]);
          L = R; R = nr;
        }
        const pre = R.concat(L);
        block = FP.map((p) => pre[p - 1]);
      }
      let out = s1 + s2;
      const bits = block.concat([0, 0]);
      for (let i = 0; i < 66; i += 6) {
        let v = 0;
        for (let k = 0; k < 6; k++) v = (v << 1) | bits[i + k];
        out += ALPH[v];
      }
      return out;
    };
  })();

  // ---------------------------------------------------------------------------
  // Sum functions (sql/item_sum.cc)
  // ---------------------------------------------------------------------------
  class Item_sum extends Item {
    constructor(args) {
      super();
      this.args = args;
      this.with_sum_func = true;
      this.result_field = null;
    }
    type() { return 'SUM_FUNC_ITEM'; }
    children() { return this.args; }
    // make_const() (opt_sum_query()) turns a COUNT/MIN/MAX into a constant
    used_tables() { return this.constSum ? 0 : ALL_TABLES; }
    const_item() { return !!this.constSum; }
    keep_field_type() { return false; }
    fix_length_and_dec() { this.maybe_null = true; this.null_value = true; }
    check_allowed(ctx) {
      if (!ctx.allow_sum_func) throw myError(ER.INVALID_GROUP_FUNC_USE);
    }
    fix_fields(ctx) {
      this.check_allowed(ctx);
      ctx.allow_sum_func = false;
      this.decimals = 0;
      this.maybe_null = false;
      for (const a of this.args) {
        a.fix_fields(ctx);
        if (this.decimals < a.decimals) this.decimals = a.decimals;
        if (a.maybe_null) this.maybe_null = true;
      }
      this.max_length = float_length(this, this.decimals);
      this.null_value = true;
      this.fix_length_and_dec();
      ctx.allow_sum_func = true;
    }
    make_field() {
      let f;
      if (this.args[0].type() === 'FIELD_ITEM' && this.keep_field_type()) f = this.args[0].field.make_field();
      else {
        const rt = this.result_type();
        f = { flags: this.maybe_null ? 0 : F.NOT_NULL, length: this.max_length, decimals: this.decimals,
          type: rt === INT_RESULT ? T.LONG : rt === REAL_RESULT ? T.DOUBLE : T.VAR_STRING };
      }
      f.table = '';
      f.name = this.name;
      return f;
    }
    val_str() { const nr = this.val(); return this.null_value ? null : setDouble(nr, this.decimals); }
    val_int() { return dbl2ll(this.val()); }
  }
  class Item_sum_int extends Item_sum {
    fix_length_and_dec() { this.decimals = 0; this.max_length = 21; this.maybe_null = this.null_value = false; }
    result_type() { return INT_RESULT; }
    val() { return Number(this.val_int()); }
    val_str() { const nr = this.val_int(); return this.null_value ? null : nr.toString(); }
  }
  class Item_sum_sum extends Item_sum {
    constructor(a) { super([a]); this.sum = 0; }
    func_name() { return 'sum'; }
    fix_length_and_dec() { this.maybe_null = this.null_value = true; }
    reset() { this.null_value = false; this.sum = 0; this.add(); }
    add() { this.sum += this.args[0].val(); }
    val() { return this.sum; }
  }
  class Item_sum_count extends Item_sum_int {
    constructor(a) { super([a]); this.count = 0; }
    func_name() { return 'count'; }
    reset() { this.count = 0; this.add(); }
    add() {
      if (!this.args[0].maybe_null) this.count++;
      else { this.args[0].val_int(); if (!this.args[0].null_value) this.count++; }
    }
    val_int() { return BigInt(this.count); }
  }
  class Item_sum_count_distinct extends Item_sum_int {
    func_name() { return 'count_distinct'; }
    reset() { this.seen = []; this.count = 0; this.add(); }
    add() {
      const vals = [];
      for (const a of this.args) {
        const rt = a.result_type();
        const v = rt === STRING_RESULT ? a.val_str() : rt === INT_RESULT ? a.val_int() : a.val();
        if (a.null_value) return;
        vals.push({ v, rt, bin: a.binary });
      }
      const same = (x) => x.every((e, i) => (e.rt === STRING_RESULT ? (e.bin ? stringcmp(e.v, vals[i].v) : sortcmp(e.v, vals[i].v)) === 0 : e.v === vals[i].v));
      if (this.seen.some(same)) return;
      this.seen.push(vals);
      this.count++;
    }
    val_int() { return BigInt(this.count || 0); }
  }
  class Item_sum_avg extends Item_sum {
    constructor(a) { super([a]); }
    func_name() { return 'avg'; }
    fix_length_and_dec() { this.decimals += 4; this.maybe_null = true; }
    reset() { this.sum = 0; this.count = 0; this.add(); }
    add() { const nr = this.args[0].val(); if (!this.args[0].null_value) { this.sum += nr; this.count++; } }
    val() { if (!this.count) { this.null_value = true; return 0; } this.null_value = false; return this.sum / this.count; }
  }
  class Item_sum_std extends Item_sum {
    constructor(a) { super([a]); }
    func_name() { return 'std'; }
    fix_length_and_dec() { this.decimals += 4; this.maybe_null = true; }
    reset() { this.sum = this.sum_sqr = 0; this.count = 0; this.add(); }
    add() { const nr = this.args[0].val(); if (!this.args[0].null_value) { this.sum += nr; this.sum_sqr += nr * nr; this.count++; } }
    val() {
      if (!this.count) { this.null_value = true; return 0; }
      this.null_value = false;
      const tmp2 = (this.sum_sqr - this.sum * this.sum / this.count) / this.count;
      return tmp2 <= 0 ? 0 : Math.sqrt(tmp2);
    }
  }
  class Item_sum_hybrid extends Item_sum {
    constructor(a, sign) { super([a]); this.cmp_sign = sign; }
    fix_fields(ctx) {
      this.check_allowed(ctx);
      ctx.allow_sum_func = false;
      const item = this.args[0];
      item.fix_fields(ctx);
      this.hybrid_type = item.result_type();
      if (this.hybrid_type === INT_RESULT) this.max_length = 21;
      else if (this.hybrid_type === REAL_RESULT) this.max_length = float_length(this, this.decimals);
      else this.max_length = item.max_length;
      this.decimals = item.decimals;
      this.maybe_null = item.maybe_null;
      this.binary = item.binary;
      this.null_value = true;
      ctx.allow_sum_func = true;
    }
    keep_field_type() { return true; }
    result_type() { return this.hybrid_type; }
    reset() { this.sum = 0; this.value = ''; this.null_value = true; this.add(); }
    add() {
      if (this.hybrid_type !== STRING_RESULT) {
        const nr = this.args[0].val();
        if (!this.args[0].null_value && (this.null_value || (this.cmp_sign > 0 ? nr < this.sum : nr > this.sum))) { this.sum = nr; this.null_value = false; }
      } else {
        const r = this.args[0].val_str();
        if (!this.args[0].null_value) {
          const c = this.null_value ? 0 : (this.binary ? stringcmp(this.value, r) : sortcmp(this.value, r));
          if (this.null_value || (this.cmp_sign > 0 ? c > 0 : c < 0)) { this.value = r; this.null_value = false; }
        }
      }
    }
    val() { if (this.null_value) return 0; if (this.hybrid_type === STRING_RESULT) return atof(this.value); return this.sum; }
    val_str() { if (this.null_value) return null; if (this.hybrid_type === STRING_RESULT) return this.value; return setDouble(this.sum, this.decimals); }
  }
  class Item_sum_min extends Item_sum_hybrid { constructor(a) { super(a, 1); } func_name() { return 'min'; } }
  class Item_sum_max extends Item_sum_hybrid { constructor(a) { super(a, -1); } func_name() { return 'max'; } }
  class Item_sum_bit extends Item_sum_int {
    constructor(a, reset, or) { super([a]); this.reset_bits = reset; this.or = or; }
    func_name() { return this.or ? 'bit_or' : 'bit_and'; }
    reset() { this.bits = this.reset_bits; this.add(); }
    add() {
      const v = BigInt.asUintN(64, this.args[0].val_int());
      if (!this.args[0].null_value) this.bits = this.or ? this.bits | v : this.bits & v;
    }
    val_int() { return BigInt.asIntN(64, this.bits === undefined ? this.reset_bits : this.bits); }
  }
  const Item_sum_or = function (a) { return new Item_sum_bit(a, 0n, true); };
  const Item_sum_and = function (a) { return new Item_sum_bit(a, ULL_MAX, false); };

  // ---------------------------------------------------------------------------
  // Functions: FUNC_ARGn tokens (sql/item_create.cc) and the functions with
  // their own grammar rules (simple_expr in sql/sql_yacc.yy)
  // ---------------------------------------------------------------------------
  const dec = (name, fn, bad) => (a) => new Item_dec_func(a, name, fn, bad);
  const intf = (cls) => (a) => new cls(a);
  const CREATE = {
    create_func_abs: (a) => new Item_func_abs(a[0]),
    create_func_acos: dec('acos', Math.acos, (x) => x < -1 || x > 1),
    create_func_ascii: (a) => new Item_func_ascii(a),
    create_func_ord: (a) => new Item_func_ord(a),
    create_func_asin: dec('asin', Math.asin, (x) => x < -1 || x > 1),
    create_func_bin: (a) => new Item_func_conv([a[0], new Item_int(null, 10n, 2), new Item_int(null, 2n, 1)]),
    create_func_bit_count: (a) => new Item_func_bitop(a[0], undefined, 'bit_count'),
    create_func_ceiling: (a) => new Item_func_ceiling(a),
    create_func_connection_id: () => new Item_int('CONNECTION_ID()', BigInt(THD.conn.threadId), 10),
    create_func_conv: (a) => new Item_func_conv(a),
    create_func_cos: dec('cos', Math.cos),
    create_func_cot: (a) => new Item_func_div(new Item_int('1', 1n, 1), dec('tan', Math.tan)(a)),
    create_func_date_format: (a) => new Item_func_date_format(a[0], a[1], false),
    create_func_dayofmonth: DATE_FUNCS.dayofmonth,
    create_func_dayofweek: (a) => new Item_func_weekday(DATE_FUNCS.to_days(a), true),
    create_func_dayofyear: DATE_FUNCS.dayofyear,
    create_func_dayname: (a) => new Item_func_dayname(DATE_FUNCS.to_days(a)),
    create_func_degrees: (a) => new Item_func_units('degrees', a[0], 180 / Math.PI, 0),
    create_func_exp: dec('exp', Math.exp),
    create_func_find_in_set: (a) => new Item_func_find_in_set(a),
    create_func_floor: (a) => new Item_func_floor(a),
    create_func_from_days: (a) => new Item_func_from_days(a[0]),
    create_func_get_lock: (a) => new Item_func_lock(a, 'get'),
    create_func_hex: (a) => new Item_func_conv([a[0], new Item_int(null, 10n, 2), new Item_int(null, 16n, 2)]),
    create_func_inet_ntoa: STR_FUNCS.inet_ntoa,
    create_func_inet_aton: (a) => new Item_func_inet_aton(a),
    create_func_ifnull: (a) => new Item_func_ifnull(a[0], a[1]),
    create_func_nullif: (a) => new Item_func_nullif(a[0], a[1]),
    create_func_locate: (a) => new Item_func_locate([a[1], a[0]]),
    create_func_instr: (a) => new Item_func_locate([a[0], a[1]]),
    create_func_isnull: (a) => new Item_func_isnull(a[0]),
    create_func_lcase: STR_FUNCS.lcase,
    create_func_length: (a) => new Item_func_length(a),
    create_func_char_length: (a) => new Item_func_char_length(a),
    create_func_log: dec('log', Math.log, (x) => x <= 0),
    create_func_log10: dec('log10', Math.log10, (x) => x <= 0),
    create_func_lpad: (a) => new Item_func_pad(a, true),
    create_func_ltrim: (a) => new Item_func_trim(a[0], new Item_string(' '), 'ltrim'),
    create_func_md5: STR_FUNCS.md5,
    create_func_mod: (a) => new Item_func_mod(a[0], a[1]),
    create_func_monthname: (a) => new Item_func_monthname(a[0]),
    create_func_month: DATE_FUNCS.month,
    create_func_oct: (a) => new Item_func_conv([a[0], new Item_int(null, 10n, 2), new Item_int(null, 8n, 1)]),
    create_func_period_add: DATE_FUNCS.period_add,
    create_func_period_diff: DATE_FUNCS.period_diff,
    create_func_pi: () => new Item_real('PI()', Math.PI, 6, 8),
    create_func_pow: dec('pow', Math.pow),
    create_func_quarter: DATE_FUNCS.quarter,
    create_func_radians: (a) => new Item_func_units('radians', a[0], Math.PI / 180, 0),
    create_func_release_lock: (a) => new Item_func_lock(a, 'release'),
    create_func_repeat: (a) => new Item_func_repeat(a),
    create_func_reverse: STR_FUNCS.reverse,
    create_func_rpad: (a) => new Item_func_pad(a, false),
    create_func_rtrim: (a) => new Item_func_trim(a[0], new Item_string(' '), 'rtrim'),
    create_func_sec_to_time: (a) => new Item_func_sec_to_time(a[0]),
    create_func_sign: (a) => new Item_func_sign(a),
    create_func_sin: dec('sin', Math.sin),
    create_func_space: (a) => new Item_func_repeat([new Item_string(' '), a[0]]),
    create_func_soundex: STR_FUNCS.soundex,
    create_func_sqrt: dec('sqrt', Math.sqrt, (x) => x < 0),
    create_func_strcmp: (a) => new Item_func_strcmp(a[0], a[1]),
    create_func_tan: dec('tan', Math.tan),
    create_func_time_format: (a) => new Item_func_date_format(a[0], a[1], true),
    create_func_time_to_sec: DATE_FUNCS.time_to_sec,
    create_func_to_days: DATE_FUNCS.to_days,
    create_func_ucase: STR_FUNCS.ucase,
    create_func_version: () => new Item_string(SERVER_VERSION, null),
    create_func_weekday: (a) => new Item_func_weekday(DATE_FUNCS.to_days(a), false),
    create_func_year: DATE_FUNCS.year,
    create_load_file: STR_FUNCS.load_file,
    create_wait_for_master_pos: (a) => new Item_date_int(a, 'master_pos_wait', 1, () => 0),
  };
  const ARGN = { FUNC_ARG0: 0, FUNC_ARG1: 1, FUNC_ARG2: 2, FUNC_ARG3: 3 };
  // token -> function(parser, token) returning an Item; 'kw' marks keywords that
  // are identifiers unless '(' follows
  const FUNC_TOKENS = {};
  function funcTok(tok, fn, identUnlessParen) {
    FUNC_TOKENS[tok] = function (t) {
      if (identUnlessParen && this.peek(1).tok !== '(') return this.simpleIdent();
      this.shift();
      return fn.call(this, t);
    };
  }
  for (const k of Object.keys(ARGN)) {
    funcTok(k, function (t) {
      const a = this.args(ARGN[k]);
      const c = CREATE[t.create];
      if (!c) throw myError(ER.SYNTAX);
      const it = c(a);
      return it;
    });
  }
  // helpers for the grammar of each function
  function argList(p, min) {
    p.expect('(');
    const list = [p.expr()];
    while (p.accept(',')) list.push(p.expr());
    if (list.length < min) p.fail();
    p.expect(')');
    return list;
  }
  function optionalBraces(p) { if (p.is('(') && p.peek(1).tok === ')') { p.shift(); p.shift(); return true; } return false; }
  funcTok('ATAN', function () {
    {
      this.expect('(');
      const a = this.expr();
      if (this.accept(',')) { const b = this.expr(); this.expect(')'); return new Item_dec_func([a, b], 'atan', Math.atan2); }
      this.expect(')');
      return new Item_dec_func([a], 'atan', Math.atan);
    }
  });
  funcTok('CHAR_SYM', function () { return new Item_func_char(argList(this, 1)); });
  funcTok('COALESCE', function () { return new Item_func_coalesce(argList(this, 1)); });
  funcTok('CONCAT', function () { return new Item_func_concat(argList(this, 1)); });
  funcTok('CONCAT_WS', function () { const l = argList(this, 2); return new Item_func_concat_ws(l[0], l.slice(1)); });
  funcTok('CURDATE', function () { optionalBraces(this); return new Item_func_curdate([]); });
  funcTok('CURTIME', function () {
    if (optionalBraces(this)) return new Item_func_curtime([]);
    if (this.is('(')) return new Item_func_curtime(this.args(1));
    return new Item_func_curtime([]);
  });
  funcTok('NOW_SYM', function () {
    if (optionalBraces(this)) return new Item_func_now([]);
    if (this.is('(')) return new Item_func_now(this.args(1));
    return new Item_func_now([]);
  });
  for (const [tok, sub] of [['DATE_ADD_INTERVAL', false], ['DATE_SUB_INTERVAL', true]]) {
    funcTok(tok, function () {
      this.expect('(');
      const a = this.expr();
      this.expect(',');
      this.expect('INTERVAL_SYM');
      const n = this.expr();
      const unit = this.interval();
      this.expect(')');
      return new Item_date_add_interval(a, n, unit, sub);
    });
  }
  funcTok('DATABASE', function () { this.expect('('); this.expect(')'); return new Item_func_database([]); });
  funcTok('ELT_FUNC', function () { const l = argList(this, 2); return new Item_func_elt(l[0], l.slice(1)); });
  funcTok('MAKE_SET_SYM', function () { const l = argList(this, 2); return new Item_func_make_set(l[0], l.slice(1)); });
  funcTok('ENCRYPT', function () {
    this.expect('(');
    const a = [this.expr()];
    if (this.accept(',')) a.push(this.expr());
    this.expect(')');
    return STR_FUNCS.encrypt(a);
  });
  for (const [tok, d] of [['DECODE_SYM', true], ['ENCODE_SYM', false]]) {
    funcTok(tok, function () {
      this.expect('(');
      const a = this.expr();
      this.expect(',');
      const seed = this.expect('TEXT_STRING').str;
      this.expect(')');
      return new Item_func_encode(a, seed, d);
    });
  }
  funcTok('EXPORT_SET', function () {
    const l = argList(this, 3);
    if (l.length > 5) this.fail(this.last);
    return STR_FUNCS.export_set(l);
  });
  funcTok('FORMAT_SYM', function () {
    this.expect('(');
    const a = this.expr();
    this.expect(',');
    const n = atol(this.expect('NUM').str);
    this.expect(')');
    return new Item_func_format(a, n);
  });
  funcTok('FROM_UNIXTIME', function () {
    this.expect('(');
    const a = this.expr();
    if (this.accept(',')) { const b = this.expr(); this.expect(')'); return new Item_func_date_format(new Item_func_from_unixtime(a), b, false); }
    this.expect(')');
    return new Item_func_from_unixtime(a);
  });
  funcTok('FIELD_FUNC', function () { const l = argList(this, 2); return new Item_func_field(l[0], l.slice(1)); });
  funcTok('HOUR_SYM', function () { return DATE_FUNCS.hour(this.args(1)); }, true);
  funcTok('MINUTE_SYM', function () { return DATE_FUNCS.minute(this.args(1)); }, true);
  funcTok('MONTH_SYM', function () { return DATE_FUNCS.month(this.args(1)); }, true);
  funcTok('SECOND_SYM', function () { return DATE_FUNCS.second(this.args(1)); }, true);
  funcTok('YEAR_SYM', function () { return DATE_FUNCS.year(this.args(1)); }, true);
  funcTok('IF', function () { const a = this.args(3); return new Item_func_if(a[0], a[1], a[2]); });
  funcTok('INSERT', function () { return STR_FUNCS.insert(this.args(4)); });
  funcTok('LAST_INSERT_ID', function () {
    this.expect('(');
    if (this.accept(')')) return new Item_last_insert_id('last_insert_id()');
    const a = this.expr();
    this.expect(')');
    return new Item_func_set_last_insert_id([a]);
  });
  funcTok('LEFT', function () { return STR_FUNCS.left(this.args(2)); });
  funcTok('RIGHT', function () { return STR_FUNCS.right(this.args(2)); });
  funcTok('LOCATE', function () {
    const l = argList(this, 2);
    if (l.length > 3) this.fail(this.last);
    return new Item_func_locate(l.length === 2 ? [l[1], l[0]] : [l[1], l[0], l[2]]);
  });
  funcTok('GREATEST_SYM', function () { return new Item_func_min_max(argList(this, 2), -1); });
  funcTok('LEAST_SYM', function () { return new Item_func_min_max(argList(this, 2), 1); });
  funcTok('PASSWORD', function () { return STR_FUNCS.password(this.args(1)); }, true);
  funcTok('POSITION_SYM', function () {
    this.expect('(');
    const a = this.expr(P_CMP + 1);
    this.expect('IN_SYM');
    const b = this.expr();
    this.expect(')');
    return new Item_func_locate([b, a]);
  });
  funcTok('RAND', function () {
    this.expect('(');
    if (this.accept(')')) return new Item_func_rand([]);
    const a = this.expr();
    this.expect(')');
    return new Item_func_rand([a]);
  });
  funcTok('REPLACE', function () { return STR_FUNCS.replace(this.args(3)); });
  funcTok('ROUND', function () {
    this.expect('(');
    const a = this.expr();
    if (this.accept(',')) { const b = this.expr(); this.expect(')'); return new Item_func_round(a, b, false); }
    this.expect(')');
    return new Item_func_round(a, new Item_int('0', 0n, 1), false);
  });
  funcTok('TRUNCATE_SYM', function () { const a = this.args(2); return new Item_func_round(a[0], a[1], true); }, true);
  funcTok('SUBSTRING', function () {
    this.expect('(');
    const a = this.expr();
    if (this.accept('FROM')) {
      const b = this.expr();
      if (this.accept('FOR_SYM')) { const c = this.expr(); this.expect(')'); return STR_FUNCS.substr([a, b, c]); }
      this.expect(')');
      return STR_FUNCS.substr([a, b]);
    }
    this.expect(',');
    const b = this.expr();
    if (this.accept(',')) { const c = this.expr(); this.expect(')'); return STR_FUNCS.substr([a, b, c]); }
    this.expect(')');
    return STR_FUNCS.substr([a, b]);
  });
  funcTok('SUBSTRING_INDEX', function () { return STR_FUNCS.substring_index(this.args(3)); });
  funcTok('TRIM', function () {
    this.expect('(');
    const pad = () => (this.is('FROM') ? new Item_string(' ') : this.expr());
    for (const [tok, mode] of [['LEADING', 'ltrim'], ['TRAILING', 'rtrim'], ['BOTH', 'trim']]) {
      if (this.accept(tok)) {
        const r = pad();
        this.expect('FROM');
        const s = this.expr();
        this.expect(')');
        return new Item_func_trim(s, r, mode);
      }
    }
    const a = this.expr();
    if (this.accept('FROM')) { const s = this.expr(); this.expect(')'); return new Item_func_trim(s, a, 'trim'); }
    this.expect(')');
    return new Item_func_trim(a, new Item_string(' '), 'trim');
  });
  funcTok('UNIX_TIMESTAMP', function () {
    this.expect('(');
    if (this.accept(')')) return DATE_FUNCS.unix_timestamp([]);
    const a = this.expr();
    this.expect(')');
    return DATE_FUNCS.unix_timestamp([a]);
  });
  funcTok('USER', function () { this.expect('('); this.expect(')'); return new Item_func_user([]); });
  for (const [tok, f] of [['WEEK_SYM', 'week'], ['YEARWEEK', 'yearweek']]) {
    funcTok(tok, function () {
      this.expect('(');
      const a = this.expr();
      if (this.accept(',')) { const b = this.expr(); this.expect(')'); return DATE_FUNCS[f]([a, b]); }
      this.expect(')');
      return DATE_FUNCS[f]([a, new Item_int('0', 0n, 1)]);
    });
  }
  funcTok('BENCHMARK_SYM', function () {
    this.expect('(');
    const n = this.ulongNum();
    this.expect(',');
    const e = this.expr();
    this.expect(')');
    return new Item_func_benchmark(n, e);
  });
  funcTok('EXTRACT_SYM', function () {
    this.expect('(');
    const unit = this.interval();
    this.expect('FROM');
    const e = this.expr();
    this.expect(')');
    return new Item_extract(unit, e);
  });

  // ---------------------------------------------------------------------------
  // Fields (sql/field.cc): how each column type stores and prints values.
  // A field's value lives in table.record[field.idx]; null means SQL NULL.
  // Stored forms: integers/timestamp/year/date/time/datetime/enum as Number,
  // BIGINT and SET as BigInt, DECIMAL as its fixed-width string, strings and
  // blobs as byte strings (CHAR without its end space).
  // ---------------------------------------------------------------------------
  class Field {
    constructor(o) {
      this.field_name = o.name;
      this.field_length = o.length || 0;
      this.flags = o.flags || 0;
      this.nullable = !(this.flags & F.NOT_NULL);
      this.dec = o.dec === undefined ? 0 : o.dec;
      this.unsigned_flag = !!(this.flags & F.UNSIGNED);
      this.zerofill = !!(this.flags & F.ZEROFILL);
      this.binary_flag = !!(this.flags & F.BINARY);
      this.table = null;
      this.idx = 0;
      this.auto_inc = !!(this.flags & F.AUTO_INCREMENT);
    }
    get table_name() { return this.table ? this.table.alias : ''; }
    get v() { return this.table.record[this.idx]; }
    set v(x) { this.table.record[this.idx] = x; }
    is_null() { return this.table.null_row || this.v === null; }
    real_maybe_null() { return this.nullable; }
    maybe_null() { return this.nullable || !!this.table.maybe_null; }
    set_null() { if (this.nullable) this.v = null; }
    set_notnull() { if (this.v === null) this.v = this.zero(); }
    reset() { this.v = this.zero(); }
    save() { return this.v; }
    restore(x) { this.v = x; }
    decimals() { return this.dec; }
    binary() { return true; }
    real_type() { return this.type(); }
    store_for_compare() { return false; }
    result_type() { return REAL_RESULT; }
    // the comparison type for index use (dates compare as numbers)
    cmp_type() { return this.result_type(); }
    optimize_range() { return true; }
    get_date(t, fuzzy) {
      const r = this.val_str();
      if (str_to_TIME(r, t, fuzzy) === TS_NONE) return true;
      return false;
    }
    get_time(t) { return str_to_time(this.val_str(), t); }
    store_time(t, type) {
      if (type === TS_DATE) this.store_str(fmtDate(t));
      else if (type === TS_FULL) this.store_str(fmtDateTime(t));
      else if (type === TS_TIME) this.store_str(pad2(t.hour) + ':' + pad2(t.minute) + ':' + pad2(t.second));
      else this.store_str('');
    }
    make_field() {
      return { table: this.table_name, name: this.field_name, length: this.field_length, type: this.type(),
        flags: this.table && this.table.maybe_null ? this.flags & ~F.NOT_NULL : this.flags, decimals: this.dec };
    }
    // compare two stored values (Field::cmp)
    cmpv(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
    add_zerofill_and_unsigned(s) { if (this.unsigned_flag) s += ' unsigned'; if (this.zerofill) s += ' zerofill'; return s; }
    prepend_zeros(s) { return this.zerofill && s.length < this.field_length ? s.padStart(this.field_length, '0') : s; }
    pack_length() { return this.field_length; }
    clone(table) {
      const f = Object.create(Object.getPrototypeOf(this));
      Object.assign(f, this);
      f.table = table;
      return f;
    }
    // storage (SQLite container) conversions
    toStore(v) { return v; }
    fromStore(v) { return v; }
  }

  // Integer fields: Field_tiny, Field_short, Field_medium, Field_long
  const INT_INFO = {
    [T.TINY]: { name: 'tinyint', min: -128, max: 127, umax: 255 },
    [T.SHORT]: { name: 'smallint', min: -32768, max: 32767, umax: 65535 },
    [T.INT24]: { name: 'mediumint', min: -8388608, max: 8388607, umax: 16777215 },
    [T.LONG]: { name: 'int', min: -2147483648, max: 2147483647, umax: 4294967295 },
  };
  class Field_int extends Field {
    constructor(o, ftype) { super(o); this.ftype = ftype; this.info = INT_INFO[ftype]; }
    type() { return this.ftype; }
    result_type() { return INT_RESULT; }
    zero() { return 0; }
    clip(n) {
      const lo = this.unsigned_flag ? 0 : this.info.min, hi = this.unsigned_flag ? this.info.umax : this.info.max;
      if (n < lo) { cut(); return lo; }
      if (n > hi) { cut(); return hi; }
      return n;
    }
    store_str(s) {
      if (this.ftype === T.LONG) {
        let i = 0;
        while (i < s.length && my_isspace(cc(s, i))) i++;
        const t = s.slice(i);
        let r;
        if (this.unsigned_flag) {
          if (!t.length || t[0] === '-') { this.v = 0; cut(); return; }
          r = strtoul(t);
        } else r = strtol(t);
        if (r.err || (THD.count_cuted_fields && !test_if_int(t))) cut();
        this.v = r.v;
        return;
      }
      const r = strtol(s);
      const lo = this.unsigned_flag ? 0 : this.info.min, hi = this.unsigned_flag ? this.info.umax : this.info.max;
      if (r.v < lo) { this.v = lo; cut(); }
      else if (r.v > hi) { this.v = hi; cut(); }
      else { this.v = r.v; if (THD.count_cuted_fields && !test_if_int(s)) cut(); }
    }
    store_real(nr) {
      nr = rint(nr);
      if (this.ftype === T.LONG) {
        if (this.unsigned_flag) { if (nr < 0) { this.v = 0; cut(); } else if (nr > 4294967295) { this.v = 4294967295; cut(); } else this.v = dbl2ulong(nr); }
        else if (nr < -2147483648) { this.v = -2147483648; cut(); }
        else if (nr > 2147483647) { this.v = 2147483647; cut(); }
        else this.v = Number(dbl2ll(nr));
        return;
      }
      this.v = this.clip(isNaN(nr) ? 0 : nr);
    }
    store_int(nr) {
      const lo = BigInt(this.unsigned_flag ? 0 : this.info.min), hi = BigInt(this.unsigned_flag ? this.info.umax : this.info.max);
      if (nr < lo) { this.v = Number(lo); cut(); }
      else if (nr > hi) { this.v = Number(hi); cut(); }
      else this.v = Number(nr);
    }
    val_real() { return this.v; }
    val_int() { return BigInt(this.v); }
    val_str() { return this.prepend_zeros(String(this.v)); }
    sql_type() { return this.add_zerofill_and_unsigned(this.info.name + '(' + this.field_length + ')'); }
    pack_length() { return { [T.TINY]: 1, [T.SHORT]: 2, [T.INT24]: 3, [T.LONG]: 4 }[this.ftype]; }
    fromStore(v) { return typeof v === 'string' ? Number(v) : v; }
  }
  class Field_longlong extends Field {
    type() { return T.LONGLONG; }
    result_type() { return INT_RESULT; }
    zero() { return 0n; }
    store_str(s) {
      let i = 0;
      while (i < s.length && my_isspace(cc(s, i))) i++;
      const t = s.slice(i);
      let r;
      if (this.unsigned_flag) {
        if (!t.length || t[0] === '-') { this.v = 0n; cut(); return; }
        r = strtoull(t);
        r.v = BigInt.asIntN(64, r.v);
      } else r = strtoll(t);
      if (r.err || (THD.count_cuted_fields && !test_if_int(t))) cut();
      this.v = r.v;
    }
    store_real(nr) {
      nr = rint(nr);
      if (this.unsigned_flag) {
        if (nr < 0) { this.v = 0n; cut(); }
        else if (nr >= 18446744073709551615) { this.v = -1n; cut(); }
        else this.v = BigInt.asIntN(64, BigInt(Math.trunc(nr)));
      } else if (nr <= -TWO63) { this.v = LL_MIN; cut(); }
      else if (nr >= TWO63) { this.v = LL_MAX; cut(); }
      else this.v = BigInt(Math.trunc(nr));
    }
    store_int(nr) { this.v = BigInt.asIntN(64, nr); }
    val_real() { return this.unsigned_flag ? Number(BigInt.asUintN(64, this.v)) : Number(this.v); }
    val_int() { return this.v; }
    val_str() { return this.prepend_zeros((this.unsigned_flag ? BigInt.asUintN(64, this.v) : this.v).toString()); }
    cmpv(a, b) { if (this.unsigned_flag) { a = BigInt.asUintN(64, a); b = BigInt.asUintN(64, b); } return a < b ? -1 : a > b ? 1 : 0; }
    sql_type() { return this.add_zerofill_and_unsigned('bigint(' + this.field_length + ')'); }
    pack_length() { return 8; }
    toStore(v) { return v === null ? null : v.toString(); }
    fromStore(v) { return v === null ? null : BigInt(v); }
  }
  // test_if_int(), test_if_real(): for warnings in batch mode only
  function test_if_int(s) {
    let i = 0;
    while (i < s.length && my_isspace(cc(s, i))) i++;
    if (s[i] === '-' || s[i] === '+') i++;
    if (i === s.length) return false;
    for (; i < s.length; i++) {
      if (!my_isdigit(cc(s, i))) {
        if (s[i] === '.') { for (i++; i < s.length && s[i] === '0'; i++); if (i === s.length) return true; }
        if (!my_isspace(cc(s, i))) return false;
        for (i++; i < s.length; i++) if (!my_isspace(cc(s, i))) return false;
        return true;
      }
    }
    return true;
  }
  const test_if_real = (s) => /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]\d+)?\s*$/.test(s);

  class Field_float extends Field {
    constructor(o, dbl) { super(o); this.dbl = dbl; }
    type() { return this.dbl ? T.DOUBLE : T.FLOAT; }
    zero() { return 0; }
    fixed(nr) { return this.dec < NOT_FIXED_DEC ? floorHalfX87(nr, LOG_10[this.dec]) / LOG_10[this.dec] : nr; }
    store_str(s) {
      const nr = atof(s);
      if (THD.count_cuted_fields && !test_if_real(s)) cut();
      if (this.dbl) this.v = nr; else this.store_real(nr, true);
    }
    store_real(nr, raw) {
      nr = this.fixed(nr);
      if (this.dbl) { this.v = nr; return; }
      const FLT_MAX = 3.4028234663852886e38;
      if (nr < -FLT_MAX) { this.v = Math.fround(-FLT_MAX); cut(); }
      else if (nr > FLT_MAX) { this.v = Math.fround(FLT_MAX); cut(); }
      else this.v = Math.fround(nr);
    }
    store_int(nr) { this.v = this.dbl ? Number(nr) : Math.fround(Number(nr)); }
    val_real() { return this.v; }
    val_int() { return dbl2ll(this.v); }
    val_str() {
      let s;
      if (this.dec >= NOT_FIXED_DEC) s = fmtG(this.v, this.dbl ? DBL_DIG : 6);
      else s = fmtF(this.v, this.dec);
      return this.prepend_zeros(s);
    }
    sql_type() {
      const n = this.dbl ? 'double' : 'float';
      return this.add_zerofill_and_unsigned(this.dec === NOT_FIXED_DEC ? n : n + '(' + this.field_length + ',' + this.dec + ')');
    }
    pack_length() { return this.dbl ? 8 : 4; }
  }
  class Field_decimal extends Field {
    type() { return T.DECIMAL; }
    zero() { return this.format_zero(); }
    format_zero() { const s = this.dec ? '0.' + '0'.repeat(this.dec) : '0'; return s.padStart(this.field_length, this.zerofill ? '0' : ' '); }
    overflow(neg) {
      let len = this.field_length, pre = '';
      if (neg && !this.unsigned_flag) { pre = '-'; len--; }
      let s = pre + (neg && this.unsigned_flag ? '0' : '9').repeat(len);
      if (this.dec) s = s.slice(0, this.field_length - this.dec - 1) + '.' + s.slice(this.field_length - this.dec);
      this.v = s;
    }
    store_str(from) {
      let i = 0, end = from.length;
      let tmp_dec = this.dec ? this.dec + 1 : 0;
      while (i !== end && my_isspace(cc(from, i))) i++;
      let fyll = ' ';
      if (this.zerofill) { fyll = '0'; if (i !== end) while (from[i] === '0' && i !== end - 1) i++; }
      // number_dec()
      const sd = { sign: 0, extra: 0, nr_length: 0, nr_dec: 0, sign_char: '' };
      let error = false;
      if (i === end) { cut(); sd.extra = 1; error = true; }
      else {
        let p = i;
        if (from[p] === '-' || from[p] === '+') { sd.sign_char = from[p]; sd.sign = 1; p++; }
        let st = p;
        while (p !== end && my_isdigit(cc(from, p))) p++;
        if (!(sd.nr_length = p - st)) sd.extra = 1;
        if (p !== end && from[p] === '.') { p++; st = p; while (p !== end && my_isdigit(cc(from, p))) p++; sd.nr_dec = p - st; }
        else sd.nr_dec = 0;
        if (THD.count_cuted_fields) {
          let q = p;
          while (q !== end && my_isspace(cc(from, q))) q++;
          if (q !== end) { cut(); error = true; }
        }
      }
      if (sd.sign) {
        i++;
        if (this.unsigned_flag) { if (!error) cut(); this.overflow(true); return; }
      }
      for (let k = sd.nr_length + sd.extra - (this.field_length - tmp_dec) + sd.sign; k > 0; k--) {
        if (from[i] === '0') { i++; sd.nr_length--; continue; }
        if (sd.sign && sd.sign_char === '+' && k === 1) { sd.sign = 0; break; }
        cut();
        this.overflow(sd.sign && sd.sign_char === '-');
        return;
      }
      let to = '';
      for (let k = this.field_length - tmp_dec - sd.nr_length - sd.extra - sd.sign; k-- > 0;) to += fyll;
      if (sd.sign) to += sd.sign_char;
      if (sd.extra) to += '0';
      to += from.substr(i, sd.nr_length);
      i += sd.nr_length;
      if (tmp_dec--) {
        to += '.';
        if (sd.nr_dec) i++;
        const take = Math.min(sd.nr_dec, tmp_dec);
        to += from.substr(i, take);
        i += take;
        to += '0'.repeat(tmp_dec - take);
      }
      if (!error && THD.count_cuted_fields && i < end) {
        for (; i < end; i++) { if (from[i] !== '0') { if (!my_isspace(cc(from, i))) cut(); break; } }
      }
      this.v = to;
    }
    store_real(nr) {
      if (this.unsigned_flag && nr < 0) { this.overflow(true); cut(); return; }
      const buf = fmtF(nr, this.dec);
      if (buf.length > this.field_length) { this.overflow(nr < 0); cut(); }
      else this.v = buf.padStart(this.field_length, this.zerofill ? '0' : ' ');
    }
    store_int(nr) {
      if (this.unsigned_flag && nr < 0n) { this.overflow(true); cut(); return; }
      const buf = nr.toString();
      const int_part = this.field_length - (this.dec ? this.dec + 1 : 0);
      if (buf.length > int_part) { this.overflow(nr < 0n); cut(); return; }
      this.v = buf.padStart(int_part, this.zerofill ? '0' : ' ') + (this.dec ? '.' + '0'.repeat(this.dec) : '');
    }
    val_real() { return atof(this.v); }
    val_int() { return this.unsigned_flag ? BigInt.asIntN(64, strtoull(this.v).v) : strtoll(this.v).v; }
    val_str() { return this.v.replace(/^ +/, ''); }
    cmpv(a, b) {
      // Field_decimal::cmp() on the fixed-width strings
      let i = 0, swap = 0;
      const n = this.field_length;
      for (; i < n && (a[i] === b[i] || ((c_isspace(cc(a, i)) || a[i] === '+' || a[i] === '0') && (c_isspace(cc(b, i)) || b[i] === '+' || b[i] === '0'))); i++) {
        if (a[i] === '-') swap = -2;
      }
      if (i === n) return 0;
      if (a[i] === '-') return -1;
      if (b[i] === '-') return 1;
      for (; i < n; i++) if (a[i] !== b[i]) { const r = a[i] < b[i] ? -1 : 1; return swap ? -r : r; }
      return 0;
    }
    sql_type() {
      let tmp = this.field_length;
      if (!this.unsigned_flag) tmp--;
      if (this.dec) tmp--;
      return this.add_zerofill_and_unsigned('decimal(' + tmp + ',' + this.dec + ')');
    }
  }
  class Field_timestamp extends Field {
    constructor(o) { super(o); this.flags |= F.NOT_NULL | F.UNSIGNED | F.ZEROFILL; this.nullable = false; this.unsigned_flag = this.zerofill = true; }
    type() { return T.TIMESTAMP; }
    result_type() { return this.field_length === 8 || this.field_length === 14 ? INT_RESULT : STRING_RESULT; }
    store_for_compare() { return true; }
    zero() { return 0; }
    // NULL stored in a TIMESTAMP means "now"
    set_null() { this.set_time(); }
    set_time() { this.v = THD.query_start; }
    store_str(s) { this.v = str_to_timestamp(s) >>> 0; }
    store_real(nr) {
      if (nr < 0 || nr > 99991231235959) { nr = 0; cut(); }
      this.store_int(BigInt(rint(nr)));
    }
    store_int(nr) {
      let n = fix_datetime(Number(nr));
      if (n) {
        const p1 = Math.trunc(n / 1000000), p2 = n - p1 * 1000000;
        const t = newTime();
        t.year = Math.trunc(p1 / 10000); t.month = Math.trunc(p1 / 100) % 100; t.day = p1 % 100;
        t.hour = Math.trunc(p2 / 10000); t.minute = Math.trunc(p2 / 100) % 100; t.second = p2 % 100;
        this.v = my_gmt_sec(t) >>> 0;
      } else this.v = 0;
    }
    get_timestamp() { return this.v; }
    parts() {
      const l = THD.tz.localtime(this.v);
      return [l.year % 100, l.mon + 1, l.mday, l.hour, l.min, l.sec, l];
    }
    val_int() {
      if (this.v === 0) return 0n;
      const p = this.parts();
      let res = 0;
      for (let pos = 0, len = 0; len + 1 < this.field_length; len += 2, pos++) {
        const part = p[pos];
        if (pos === 0 && (this.field_length === 8 || this.field_length === 14)) { res = res * 10000 + part + (part < YY_PART_YEAR ? 2000 : 1900); len += 2; }
        else res = res * 100 + part;
      }
      return BigInt(res);
    }
    val_real() { return Number(this.val_int()); }
    val_str() {
      if (this.v === 0) return '0'.repeat(this.field_length);
      const p = this.parts();
      let s = '';
      for (let pos = 0; s.length < this.field_length; pos++) {
        const part = p[pos];
        if (pos === 0 && (this.field_length === 8 || this.field_length === 14)) s += part < YY_PART_YEAR ? '20' : '19';
        s += pad2(part);
      }
      return s;
    }
    get_date(t, fuzzy) {
      if (this.v === 0) { if (!fuzzy) return true; Object.assign(t, newTime()); return false; }
      Object.assign(t, tmToTime(THD.tz.localtime(this.v)));
      return false;
    }
    get_time(t) { return this.get_date(t, false); }
    sql_type() { return 'timestamp(' + this.field_length + ')'; }
    pack_length() { return 4; }
  }
  class Field_year extends Field {
    constructor(o) { super(o); this.flags |= F.UNSIGNED | F.ZEROFILL; this.unsigned_flag = this.zerofill = true; }
    type() { return T.YEAR; }
    result_type() { return INT_RESULT; }
    zero() { return 0; }
    store_str(s) {
      const nr = strtol(s).v;
      if (nr < 0 || (nr >= 100 && nr <= 1900) || nr > 2155) { this.v = 0; cut(); return; }
      if (THD.count_cuted_fields && !test_if_int(s)) cut();
      this.v = this.norm(nr, s.length !== 4);
    }
    norm(nr, notFour) {
      if (nr !== 0 || notFour) { if (nr < YY_PART_YEAR) nr += 100; else if (nr > 1900) nr -= 1900; }
      return nr & 255;
    }
    store_real(nr) { if (nr < 0 || nr >= 2155) this.store_int(-1n); else this.store_int(dbl2ll(nr)); }
    store_int(nr) {
      const n = Number(nr);
      if (n < 0 || (n >= 100 && n <= 1900) || n > 2155) { this.v = 0; cut(); return; }
      this.v = this.norm(n, this.field_length !== 4);
    }
    val_int() { let t = this.v; if (this.field_length !== 4) t %= 100; else if (t) t += 1900; return BigInt(t); }
    val_real() { return Number(this.val_int()); }
    val_str() { const n = Number(this.val_int()); return this.field_length === 2 ? pad2(n) : pad4(n); }
    sql_type() { return 'year(' + this.field_length + ')'; }
    pack_length() { return 1; }
  }
  // DATE (Field_newdate), stored as YYYYMMDD
  class Field_newdate extends Field {
    cmp_type() { return INT_RESULT; }
    type() { return T.DATE; }
    real_type() { return T.NEWDATE; }
    result_type() { return STRING_RESULT; }
    store_for_compare() { return true; }
    binary() { return true; }
    zero() { return 0; }
    decimals() { return NOT_FIXED_DEC; }
    store_str(s) {
      const t = newTime();
      this.v = str_to_TIME(s, t, true) === TS_NONE ? 0 : t.year * 10000 + t.month * 100 + t.day;
    }
    store_real(nr) { if (nr < 0 || nr > 99991231235959) this.store_int(-1n); else this.store_int(BigInt(rint(nr))); }
    store_int(nr) {
      let n = Number(nr);
      if (n >= 100000000 && n <= 99991231235959) n = Math.trunc(n / 1000000);
      if (n < 0 || n > 99991231) { this.v = 0; cut(); return; }
      if (n) { if (n < YY_PART_YEAR * 10000) n += 20000000; else if (n < 999999) n += 19000000; }
      const month = Math.trunc(n / 100) % 100, day = n % 100;
      if (month > 12 || day > 31) { this.v = 0; cut(); return; }
      this.v = n;
    }
    store_time(t, type) {
      if (type === TS_DATE || type === TS_FULL) this.v = t.year * 10000 + t.month * 100 + t.day;
      else { this.v = 0; cut(); }
    }
    val_int() { return BigInt(this.v); }
    val_real() { return this.v; }
    val_str() { const n = this.v; return pad4(Math.trunc(n / 10000)) + '-' + pad2(Math.trunc(n / 100) % 100) + '-' + pad2(n % 100); }
    get_date(t, fuzzy) {
      Object.assign(t, newTime());
      t.year = Math.trunc(this.v / 10000); t.month = Math.trunc(this.v / 100) % 100; t.day = this.v % 100; t.time_type = TS_DATE;
      return !fuzzy && (!t.month || !t.day);
    }
    get_time(t) { return this.get_date(t, false); }
    sql_type() { return 'date'; }
    pack_length() { return 3; }
  }
  class Field_time extends Field {
    cmp_type() { return INT_RESULT; }
    type() { return T.TIME; }
    result_type() { return STRING_RESULT; }
    store_for_compare() { return true; }
    zero() { return 0; }
    decimals() { return NOT_FIXED_DEC; }
    store_str(s) {
      const t = newTime();
      let tmp;
      if (str_to_time(s, t)) tmp = 0;
      else {
        if (t.month) t.day = 0;
        tmp = (t.day * 24 + t.hour) * 10000 + (t.minute * 100 + t.second);
        if (tmp > 8385959) { tmp = 8385959; cut(); }
      }
      if (t.neg) tmp = -tmp;
      this.store_int(BigInt(tmp));
    }
    store_real(nr) {
      let tmp;
      if (nr > 8385959) { tmp = 8385959; cut(); }
      else if (nr < -8385959) { tmp = -8385959; cut(); }
      else {
        tmp = Math.floor(Math.abs(nr));
        if (nr < 0) tmp = -tmp;
        if (tmp % 100 > 59 || Math.trunc(tmp / 100) % 100 > 59) { tmp = 0; cut(); }
      }
      this.v = tmp;
    }
    store_int(nr) {
      let tmp = Number(nr);
      if (tmp > 8385959) { tmp = 8385959; cut(); }
      else if (tmp < -8385959) { tmp = -8385959; cut(); }
      else if (tmp % 100 > 59 || Math.trunc(tmp / 100) % 100 > 59) { tmp = 0; cut(); }
      this.v = tmp;
    }
    val_int() { return BigInt(this.v); }
    val_real() { return this.v < 0 ? this.v + 16777216 : this.v; }
    val_str() {
      let tmp = this.v, sign = '';
      if (tmp < 0) { tmp = -tmp; sign = '-'; }
      return sign + pad2(Math.trunc(tmp / 10000)) + ':' + pad2(Math.trunc(tmp / 100) % 100) + ':' + pad2(tmp % 100);
    }
    get_time(t) {
      let tmp = this.v;
      Object.assign(t, newTime());
      if (tmp < 0) { t.neg = true; tmp = -tmp; }
      t.hour = Math.trunc(tmp / 10000); t.minute = Math.trunc(tmp / 100) % 100; t.second = tmp % 100;
      return false;
    }
    sql_type() { return 'time'; }
    pack_length() { return 3; }
  }
  class Field_datetime extends Field {
    cmp_type() { return INT_RESULT; }
    type() { return T.DATETIME; }
    result_type() { return STRING_RESULT; }
    store_for_compare() { return true; }
    zero() { return 0; }
    decimals() { return NOT_FIXED_DEC; }
    store_str(s) { this.v = str_to_datetime(s, true); }
    store_real(nr) { if (nr < 0 || nr > 99991231235959) { nr = 0; cut(); } this.store_int(BigInt(rint(nr))); }
    store_int(nr) {
      let n = Number(nr);
      if (n < 0 || n > 99991231235959) { n = 0; cut(); } else n = fix_datetime(n);
      this.v = n;
    }
    store_time(t, type) {
      if (type === TS_DATE || type === TS_FULL) this.v = (t.year * 10000 + t.month * 100 + t.day) * 1000000 + t.hour * 10000 + t.minute * 100 + t.second;
      else { this.v = 0; cut(); }
    }
    val_int() { return BigInt(this.v); }
    val_real() { return this.v; }
    val_str() {
      const p1 = Math.trunc(this.v / 1000000), p2 = this.v - p1 * 1000000;
      return pad4(Math.trunc(p1 / 10000) % 10000) + '-' + pad2(Math.trunc(p1 / 100) % 100) + '-' + pad2(p1 % 100) + ' ' +
        pad2(Math.trunc(p2 / 10000)) + ':' + pad2(Math.trunc(p2 / 100) % 100) + ':' + pad2(p2 % 100);
    }
    get_date(t, fuzzy) {
      const p1 = Math.trunc(this.v / 1000000), p2 = this.v - p1 * 1000000;
      Object.assign(t, newTime());
      t.time_type = TS_FULL;
      t.second = p2 % 100; t.minute = Math.trunc(p2 / 100) % 100; t.hour = Math.trunc(p2 / 10000);
      t.day = p1 % 100; t.month = Math.trunc(p1 / 100) % 100; t.year = Math.trunc(p1 / 10000);
      return !fuzzy && (!t.month || !t.day);
    }
    get_time(t) { return this.get_date(t, false); }
    sql_type() { return 'datetime'; }
    pack_length() { return 8; }
  }
  // CHAR and VARCHAR (both Field_string in 3.23)
  class Field_string extends Field {
    type() { return this.table && this.table.pack_record && this.field_length >= 4 ? T.VAR_STRING : T.STRING; }
    real_type() { return T.STRING; }
    result_type() { return STRING_RESULT; }
    binary() { return this.binary_flag; }
    decimals() { return NOT_FIXED_DEC; }
    zero() { return ''; }
    make_field() { const f = super.make_field(); f.decimals = 0; return f; }
    store_str(s) {
      if (s.length > this.field_length) {
        if (THD.count_cuted_fields) { for (let i = this.field_length; i < s.length; i++) if (!my_isspace(cc(s, i))) { cut(); break; } }
        s = s.slice(0, this.field_length);
      }
      this.v = s.replace(/ +$/, '');
    }
    store_real(nr) {
      const width = Math.min(this.field_length, DBL_DIG + 5);
      this.store_str(fmtG(nr, Math.max(width - 5, 0)));
    }
    store_int(nr) { this.store_str(nr.toString()); }
    val_real() { return atof(this.v); }
    val_int() { return strtoll(this.v).v; }
    val_str() { return this.v; }
    cmpv(a, b) { return padcmp(a, b, this.binary_flag); }
    sql_type() {
      return (this.field_length > 3 && this.table && this.table.pack_record ? 'varchar' : 'char') + '(' + this.field_length + ')' + (this.binary_flag ? ' binary' : '');
    }
  }
  class Field_blob extends Field {
    constructor(o, packlength) {
      super(o);
      this.packlength = packlength;
      this.field_length = packlength >= 3 ? 16777215 : packlength === 2 ? 65535 : 255;
      this.real_length = packlength === 4 ? 4294967295 : this.field_length;
      this.flags |= F.BLOB;
    }
    type() { return T.BLOB; }
    real_type() { return [0, T.TINY_BLOB, T.BLOB, T.MEDIUM_BLOB, T.LONG_BLOB][this.packlength]; }
    result_type() { return STRING_RESULT; }
    binary() { return this.binary_flag; }
    decimals() { return NOT_FIXED_DEC; }
    zero() { return ''; }
    make_field() { const f = super.make_field(); f.decimals = 0; return f; }
    store_str(s) {
      const max = this.packlength === 4 ? 4294967295 : this.packlength === 3 ? 16777215 : this.packlength === 2 ? 65535 : 255;
      if (s.length > max) { s = s.slice(0, max); cut(); }
      this.v = s;
    }
    store_real(nr) { this.store_str(setDouble(nr, 2)); }
    store_int(nr) { this.store_str(nr.toString()); }
    val_real() { return atof(this.v); }
    val_int() { return strtoll(this.v).v; }
    val_str() { return this.v; }
    cmpv(a, b) { return this.binary_flag ? stringcmp(a, b) : sortcmpLen(a, b); }
    sql_type() { return ['', 'tiny', '', 'medium', 'long'][this.packlength] + (this.binary_flag ? 'blob' : 'text'); }
    pack_length() { return this.packlength + 4; }
  }
  // find_enum(): case-insensitive, end space ignored
  function find_enum(typelib, x) {
    const s = x.replace(/[\t\n\v\f\r ]+$/, '');
    const up = caseUp(s);
    for (let i = 0; i < typelib.length; i++) if (caseUp(typelib[i]) === up) return i + 1;
    return 0;
  }
  class Field_enum extends Field {
    cmp_type() { return INT_RESULT; }
    optimize_range() { return false; }
    constructor(o, typelib) {
      super(o);
      this.typelib = typelib;
      this.flags |= F.ENUM;
      this.packlength = typelib.length < 256 ? 1 : 2;
    }
    type() { return T.STRING; }
    real_type() { return T.ENUM; }
    result_type() { return STRING_RESULT; }
    binary() { return false; }
    decimals() { return NOT_FIXED_DEC; }
    zero() { return 0; }
    make_field() { const f = super.make_field(); f.decimals = 0; return f; }
    store_str(s) {
      let tmp = find_enum(this.typelib, s);
      if (!tmp) {
        if (s.length < 6) {
          const m = s.match(/^\d+$/);
          tmp = m ? parseInt(s, 10) : 0;
          if (!m || tmp > this.typelib.length) { tmp = 0; cut(); }
        } else cut();
      }
      this.v = tmp;
    }
    store_real(nr) { this.store_int(dbl2ll(nr)); }
    store_int(nr) {
      const n = Number(BigInt.asUintN(32, nr));
      if (n > this.typelib.length || n === 0) { cut(); this.v = 0; } else this.v = n;
    }
    val_int() { return BigInt(this.v); }
    val_real() { return this.v; }
    val_str() { return !this.v || this.v > this.typelib.length ? '' : this.typelib[this.v - 1]; }
    sql_type() { return 'enum(' + this.typelib.map((x) => "'" + x.replace(/'/g, "''") + "'").join(',') + ')'; }
    pack_length() { return this.packlength; }
  }
  class Field_set extends Field_enum {
    constructor(o, typelib) {
      super(o, typelib);
      this.flags = (this.flags & ~F.ENUM) | F.SET;
      const n = typelib.length;
      this.packlength = n <= 8 ? 1 : n <= 16 ? 2 : n <= 24 ? 3 : n <= 32 ? 4 : 8;
    }
    real_type() { return T.SET; }
    zero() { return 0n; }
    mask() { return (1n << BigInt(this.typelib.length)) - 1n; }
    store_str(s) {
      // find_set()
      const x = s.replace(/[\t\n\v\f\r ]+$/, '');
      let found = 0n, error = false;
      if (x.length) {
        for (const part of x.split(',')) {
          const k = find_enum(this.typelib, part);
          if (!k) error = true; else found |= 1n << BigInt(k - 1);
        }
        if (error) cut();
      }
      if (!found && s.length && s.length < 22) {
        if (/^\d+$/.test(s)) {
          const n = BigInt(s);
          if (n <= this.mask()) { found = n; if (error) THD.cuted_fields--; }
        }
      }
      this.v = found;
    }
    store_int(nr) {
      let n = BigInt.asUintN(64, nr);
      if (n > this.mask()) { n &= this.mask(); cut(); }
      this.v = n;
    }
    val_int() { return BigInt.asIntN(64, this.v); }
    val_real() { return Number(this.v); }
    val_str() {
      const out = [];
      let tmp = this.v;
      for (let bit = 0; tmp && bit < this.typelib.length; bit++, tmp >>= 1n) if (tmp & 1n) out.push(this.typelib[bit]);
      return out.join(',');
    }
    sql_type() { return 'set(' + this.typelib.map((x) => "'" + x.replace(/'/g, "''") + "'").join(',') + ')'; }
    toStore(v) { return v === null ? null : v.toString(); }
    fromStore(v) { return v === null ? null : BigInt(v); }
  }
  class Field_null extends Field_string {
    type() { return T.NULL; }
    zero() { return null; }
    set_notnull() { }
    store_str() { } store_real() { } store_int() { }
    is_null() { return true; }
    val_str() { return null; }
    sql_type() { return 'char(0)'; }
  }
  // field_conv() (sql/field_conv.cc)
  function field_conv(to, from) {
    if (to.real_type() === from.real_type() && to.pack_length() === from.pack_length() &&
      to.real_type() !== T.ENUM && to.real_type() !== T.SET && to.dec === from.dec && to.field_length === from.field_length) {
      to.v = from.v;
      return;
    }
    if (to.type() === T.BLOB) { to.store_str(from.val_str()); return; }
    if ((from.result_type() === STRING_RESULT && (to.result_type() === STRING_RESULT ||
      (from.real_type() !== T.ENUM && from.real_type() !== T.SET))) || to.type() === T.DECIMAL) to.store_str(from.val_str());
    else if (from.result_type() === REAL_RESULT) to.store_real(from.val_real());
    else to.store_int(from.val_int());
  }

  // make_field() (sql/field.cc): a Field from a column definition
  // def: { type, length, dec, flags, typelib, name, packlength }
  function make_field(def) {
    const o = { name: def.name, length: def.length, flags: def.flags, dec: def.dec };
    switch (def.type) {
      case T.TINY: case T.SHORT: case T.INT24: case T.LONG: return new Field_int(o, def.type);
      case T.LONGLONG: return new Field_longlong(o);
      case T.FLOAT: return new Field_float(o, false);
      case T.DOUBLE: return new Field_float(o, true);
      case T.DECIMAL: return new Field_decimal(o);
      case T.TIMESTAMP: return new Field_timestamp(o);
      case T.YEAR: return new Field_year(o);
      case T.DATE: case T.NEWDATE: return new Field_newdate({ ...o, length: 10 });
      case T.TIME: return new Field_time({ ...o, length: 8 });
      case T.DATETIME: return new Field_datetime({ ...o, length: 19 });
      case T.STRING: case T.VAR_STRING: return new Field_string(o);
      case T.TINY_BLOB: return new Field_blob(o, 1);
      case T.BLOB: return new Field_blob(o, 2);
      case T.MEDIUM_BLOB: return new Field_blob(o, 3);
      case T.LONG_BLOB: return new Field_blob(o, 4);
      case T.ENUM: return new Field_enum(o, def.typelib);
      case T.SET: return new Field_set(o, def.typelib);
      case T.NULL: return new Field_null(o);
    }
    throw new Error('make_field ' + def.type);
  }

  // ---------------------------------------------------------------------------
  // Tables. A TableShare is a table's definition and rows (the .frm, .MYD and
  // .MYI of MyISAM); a TableInst is a table opened in a statement, with its
  // own record buffer, like MySQL's TABLE.
  // Rows keep MyISAM's positions: a full scan returns them by position, and a
  // new row reuses the most recently deleted position.
  // ---------------------------------------------------------------------------
  const HA_NOSAME = 1, HA_NULL_PART_KEY = 2, HA_FULLTEXT = 4;
  const MI_MIN_BLOCK_LENGTH = 20, MI_DYN_ALIGN_SIZE = 4;
  // _mi_find_writepos(): a new block for a packed row of length l
  const blockLength = (l) => {
    const b = l + 3 + (l >= 65520 - 3 ? 1 : 0);
    return b < MI_MIN_BLOCK_LENGTH ? MI_MIN_BLOCK_LENGTH : (b + MI_DYN_ALIGN_SIZE - 1) & ~(MI_DYN_ALIGN_SIZE - 1);
  };
  class TableShare {
    // def: { fields: [coldef], keys: [{ name, type, parts: [{ field, length }] }], options }
    constructor(db, name, def) {
      this.db = db;
      this.name = name;
      this.def = def;
      this.options = def.options || {};
      this.pack_record = !!this.options.pack_record;
      this.fields = def.fields.map((c, i) => {
        const f = make_field(c);
        f.idx = i;
        f.coldef = c;
        f.table = this;         // the share acts as the table of the default record
        return f;
      });
      this.record = new Array(this.fields.length).fill(null);   // default record (record[2])
      this.alias = name;
      this.null_row = false;
      this.keys = [];
      this.primary_key = -1;
      this.setupKeys(def.keys || []);
      this.auto_field = this.fields.findIndex((f) => f.auto_inc);
      this.timestamp_field = this.fields.findIndex((f) => f.type() === T.TIMESTAMP);
      if (this.timestamp_field >= 0) this.fields[this.timestamp_field].flags |= F.TIMESTAMP;
      this.slots = [];
      this.free = [];
      this.count = 0;
      this.auto_increment = def.auto_increment || 1;
      this.create_time = def.create_time || nowSeconds();
      this.update_time = def.update_time || this.create_time;
      this.indexes = null;
    }
    setupKeys(keys) {
      this.keys = keys.map((k, nr) => {
        const key = { name: k.name, type: k.type, parts: k.parts.map((p) => ({ field: p.field, length: p.length })), flags: 0, key_length: 0 };
        key.flags = k.type === 'MULTIPLE' ? 0 : k.type === 'FULLTEXT' ? HA_FULLTEXT : HA_NOSAME;
        // table.cc: a NULL byte for nullable parts, a length for blobs
        for (const p of key.parts) {
          const f = this.fields[p.field];
          let len = p.length || f.pack_length();
          if (f.nullable) { key.flags |= HA_NULL_PART_KEY; len += 1; }
          if (f.type() === T.BLOB) len += 2;
          key.key_length += len;
        }
        return key;
      });
      // table.cc: PRIMARY, else the first unique key without NULL parts
      this.primary_key = this.keys.findIndex((k) => k.name === 'PRIMARY');
      if (this.primary_key < 0) this.primary_key = this.keys.findIndex((k) => (k.flags & (HA_NOSAME | HA_NULL_PART_KEY)) === HA_NOSAME);
      for (const f of this.fields) { f.flags &= ~(F.PRI_KEY | F.UNIQUE_KEY | F.MULTIPLE_KEY | F.PART_KEY); f.part_of_key = 0; f.part_of_sortkey = 0; f.key_start = 0; }
      this.keys.forEach((key, nr) => {
        key.parts.forEach((p, i) => {
          const f = this.fields[p.field];
          if (i === 0) f.key_start |= 1 << nr;
          if (i === 0 && nr !== this.primary_key) f.flags |= (key.flags & HA_NOSAME) && f.pack_length() === key.key_length ? F.UNIQUE_KEY : F.MULTIPLE_KEY;
          const whole = !p.length || p.length >= f.pack_length();
          // (ISAM can't read strings from a key: HA_KEY_READ_WRONG_STR)
          if (whole && f.type() !== T.BLOB && (f.result_type() !== STRING_RESULT || this.options.engine !== 'ISAM')) f.part_of_key |= 1 << nr;
          if (whole && f.type() !== T.BLOB) f.part_of_sortkey |= 1 << nr;
          f.flags |= F.PART_KEY;
          if (nr === this.primary_key) f.flags |= F.PRI_KEY;
        });
      });
    }
    get rows() { return this.count; }
    // rows in position order: [{ pos, rec }]
    *scan() { for (let i = 0; i < this.slots.length; i++) if (this.slots[i]) yield { pos: i, rec: this.slots[i] }; }
    insertRow(rec) {
      const pos = this.free.length ? this.free.pop() : this.slots.length;
      this.version = (this.version || 0) + 1;
      this.slots[pos] = rec;
      // _mi_new(): the first key of an index allocates its root page
      if (!this.count && this.keys.length) this.not_sorted_pages = true;
      this.count++;
      this.indexAdd(pos, rec);
      this.placeBlock(pos, rec);
      this.noteAutoValue(rec);
      return pos;
    }
    deleteRow(pos) {
      this.version = (this.version || 0) + 1;
      this.indexRemove(pos, this.slots[pos]);
      this.slots[pos] = null;
      this.free.push(pos);
      this.count--;
      // _mi_dispose(): the last key frees the root page
      if (!this.count && this.keys.length) this.not_sorted_pages = true;
    }
    updateRow(pos, rec) {
      this.version = (this.version || 0) + 1;
      this.indexRemove(pos, this.slots[pos]);
      this.slots[pos] = rec;
      this.indexAdd(pos, rec);
      this.placeBlock(pos, rec);
      this.noteAutoValue(rec);
    }
    // update_auto_increment() (mi_key.c): MyISAM keeps the largest value
    // written, read from the record as an unsigned number of the column's
    // width (so -5 in an INT is 4294967291); the next value is one more
    noteAutoValue(rec) {
      if (this.auto_field < 0) return;
      const v = rec[this.auto_field];
      if (v === null) return;
      const bits = { [T.TINY]: 8, [T.YEAR]: 8, [T.SHORT]: 16, [T.INT24]: 24, [T.LONG]: 32 }[this.fields[this.auto_field].real_type()] || 64;
      const n = typeof v === 'bigint' ? v : typeof v === 'number' && Number.isInteger(v) ? BigInt(v) : dbl2ll(v);
      const u = BigInt.asUintN(bits, n);
      if (u + 1n > BigInt(this.auto_increment)) this.auto_increment = Number(u + 1n);
    }
    truncate() { this.version = (this.version || 0) + 1; this.slots = []; this.free = []; this.count = 0; this.indexes = null; this.blocks = null; }
    // unique key lookup: a string that is equal for values MySQL's key compares as equal
    keyString(key, rec) {
      let s = '';
      for (const p of key.parts) {
        const f = this.fields[p.field];
        const v = rec[p.field];
        if (v === null) return null;       // NULLs never collide
        s += keyNorm(f, v, p.length) + '\x00\x01';
      }
      return s;
    }
    buildIndexes() {
      this.indexes = this.keys.map((k) => ((k.flags & HA_NOSAME) ? new Map() : null));
      for (const { pos, rec } of this.scan()) this.indexAdd(pos, rec);
    }
    indexAdd(pos, rec) {
      if (!this.indexes) return;
      this.keys.forEach((k, nr) => {
        const m = this.indexes[nr];
        if (!m) return;
        const ks = this.keyString(k, rec);
        if (ks !== null && !m.has(ks)) m.set(ks, pos);
      });
    }
    indexRemove(pos, rec) {
      if (!this.indexes || !rec) return;
      this.keys.forEach((k, nr) => {
        const m = this.indexes[nr];
        if (!m) return;
        const ks = this.keyString(k, rec);
        if (ks !== null && m.get(ks) === pos) m.delete(ks);
      });
    }
    // the first unique key the record duplicates: { nr, pos }
    findDuplicate(rec, selfPos) {
      if (!this.indexes) this.buildIndexes();
      for (let nr = 0; nr < this.keys.length; nr++) {
        const m = this.indexes[nr];
        if (!m) continue;
        const ks = this.keyString(this.keys[nr], rec);
        if (ks === null) continue;
        const pos = m.get(ks);
        if (pos !== undefined && pos !== selfPos) return { nr, pos };
      }
      return null;
    }
    // key_unpack(): the value in "Duplicate entry '...' for key N"
    keyValue(nr, rec) {
      const inst = new TableInst(this, this.name);
      inst.record = rec;
      return this.keys[nr].parts.map((p) => {
        const f = inst.fields[p.field];
        if (f.is_null()) return 'NULL';
        let s = f.val_str();
        if (p.length && f.result_type() === STRING_RESULT) s = s.slice(0, p.length);
        return s;
      }).join('-');
    }
    // the record: NULL bits (and a delete bit for fixed rows), then the fields
    reclength() {
      const nulls = this.fields.filter((f) => f.nullable).length + (this.pack_record ? 0 : 1);
      return ((nulls + 7) >> 3) + this.fields.reduce((s, f) => s + f.pack_length(), 0);
    }
    // the size of the data file (.MYD): fixed rows, or the blocks of
    // packed rows (deleted blocks stay in the file)
    dataLength() {
      if (!this.pack_record) return this.slots.length * this.reclength();
      this.syncBlocks();
      let n = 0;
      for (let i = 0; i < this.slots.length; i++) n += this.blocks[i] || 0;
      return n;
    }
    dataFree() {
      if (!this.pack_record) return this.free.length * this.reclength();
      this.syncBlocks();
      return this.free.reduce((n, pos) => n + (this.blocks[pos] || 0), 0);
    }
    syncBlocks() {
      if (!this.blocks) this.blocks = [];
      for (let i = 0; i < this.slots.length; i++) if (this.blocks[i] === undefined) this.blocks[i] = this.slots[i] ? blockLength(this.rowLength(this.slots[i])) : MI_MIN_BLOCK_LENGTH;
    }
    // a row is written (or rewritten) at pos: reuse its block, growing it if needed
    placeBlock(pos, rec) {
      if (!this.pack_record) return;
      this.syncBlocks();
      const need = blockLength(this.rowLength(rec));
      if (!(this.blocks[pos] >= need)) this.blocks[pos] = need;
    }
    // ha_myisam create(): how _mi_rec_pack() stores each column
    packInfo() {
      if (this._pack) return this._pack;
      const info = [];
      let packed = 0;
      this.fields.forEach((f, i) => {
        const len = f.pack_length();
        let type;
        if (f.flags & F.BLOB) type = 'blob';
        else if (![T.DECIMAL, T.TIMESTAMP, T.STRING, T.ENUM].includes(f.real_type())) type = 'zero';
        else if (len <= 3 || f.zerofill) type = 'normal';
        else type = f.real_type() === T.STRING ? 'end' : 'pre';
        if (type !== 'normal') packed++;
        info.push({ type, f, i, len });
      });
      if ((packed & 7) === 1) {
        for (let k = info.length - 1; k >= 0; k--) if (info[k].type === 'zero' && info[k].len === 1) { info[k].type = 'normal'; packed--; break; }
      }
      const nullBytes = (this.fields.filter((f) => f.nullable).length + 7) >> 3;
      return (this._pack = { info, bits: (packed + 7) >> 3, nullBytes });
    }
    // _mi_rec_pack(): the packed length of a row
    rowLength(rec) {
      const { info, bits, nullBytes } = this.packInfo();
      let l = nullBytes + bits;
      for (const { type, f, i, len } of info) {
        const v = rec[i];
        if (type === 'normal') l += len;
        else if (type === 'blob') { if (v !== null && v.length) l += f.packlength + v.length; }
        else if (type === 'zero') { if (!(v === null || v === 0n || (v === 0 && !Object.is(v, -0)))) l += len; }
        else {
          // NULL strings are spaces; a NULL DECIMAL is "0" (Field::reset())
          const n = v === null ? (type === 'pre' ? 1 : 0) : type === 'end' ? v.length : v.replace(/^ +/, '').length;
          const packedLen = n + 1 + (len > 255 && n > 127 ? 1 : 0);
          l += packedLen < len ? packedLen : len;
        }
      }
      return l;
    }
    scan_time() {
      if (this.options.engine === 'HEAP') return (this.count + this.free.length) / 20 + 10;
      return this.dataLength() / 4096 + 1;
    }
    // a write: mi_lock_database() marks the table changed and not analyzed
    touch() {
      this.update_time = nowSeconds();
      this.state_changed = this.not_analyzed = this.not_optimized_keys = true;
    }
    // OPTIMIZE/REPAIR rewrite the data file without the deleted rows
    compact() {
      const rows = [...this.scan()].map((r) => r.rec);
      this.slots = rows;
      this.free = [];
      this.count = rows.length;
      this.indexes = null;
      this.blocks = null;
      this.version = (this.version || 0) + 1;
    }
    // caches that last until the next write
    cache(name) {
      if (!this._cache || this._cache.version !== this.version) this._cache = { version: this.version };
      return this._cache[name] || (this._cache[name] = new Map());
    }
  }
  // normalized key part value for unique checks
  function keyNorm(f, v, len) {
    switch (f.result_type()) {
      case STRING_RESULT: {
        if (f.real_type() === T.ENUM) return String(v);
        if (f.real_type() === T.SET) return v.toString();
        let s = String(v);
        if (f.flags & F.BLOB) { if (len) s = s.slice(0, len); }
        else if (len && len < f.field_length) s = s.slice(0, len);
        if (!(f.flags & F.BLOB)) s = s.replace(/ +$/, '');
        if (f.binary()) return s;
        let o = '';
        for (let i = 0; i < s.length; i++) o += String.fromCharCode(SORT_ORDER[cc(s, i)]);
        return o;
      }
      case REAL_RESULT:
        if (f.type() === T.DECIMAL) return String(atof(v));
        return String(v);
      default: return String(v);
    }
  }
  // a table opened by a statement (TABLE)
  class TableInst {
    constructor(share, alias) {
      this.share = share;
      this.alias = alias || share.name;
      this.pack_record = share.pack_record;
      this.fields = share.fields.map((f) => { const g = f.clone(this); return g; });
      this.record = share.record.slice();
      this.null_row = false;
      this.maybe_null = false;
      this.map = 0;
      this.const_table = false;
      this.pos = -1;
    }
    field(name) { return this.fields.find((f) => strcaseeq(f.field_name, name)); }
    restoreDefaults() { this.record = this.share.record.slice(); }
  }

  // ---------------------------------------------------------------------------
  // Persistence: each database is a SQLite file holding one table per MySQL
  // table ("t:<name>": pos, c0, c1, ...) and the definitions in "__mysql".
  // Databases of the old translating emulator ("__simphp_meta") are converted.
  // ---------------------------------------------------------------------------
  function encodeValue(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'bigint') return 'B' + v.toString();
    if (typeof v === 'string') return strToBytes(v);
    return v;
  }
  function decodeValue(v) {
    if (v instanceof Uint8Array) return bytesToStr(v);
    if (typeof v === 'string' && v[0] === 'B') return BigInt(v.slice(1));
    return v;
  }
  function shareToJSON(sh) {
    return JSON.stringify({ fields: sh.def.fields, keys: sh.def.keys, options: sh.options, auto_increment: String(sh.auto_increment),
      create_time: sh.create_time, update_time: sh.update_time, check_time: sh.check_time || 0,
      blocks: sh.pack_record && sh.blocks ? sh.blocks : undefined,
      state: [sh.state_changed, sh.not_analyzed, sh.not_optimized_keys, sh.not_sorted_pages].map(Number), defaults: sh.record.map((v) => { const e = encodeValue(v); return e instanceof Uint8Array ? { s: bytesToStr(e) } : e; }), free: sh.free, nslots: sh.slots.length });
  }
  function shareFromJSON(db, name, json) {
    const d = JSON.parse(json);
    const sh = new TableShare(db, name, { fields: d.fields, keys: d.keys, options: d.options, create_time: d.create_time, update_time: d.update_time });
    sh.auto_increment = Number(d.auto_increment);
    sh.record = d.defaults.map((v) => (v && typeof v === 'object' ? v.s : decodeValue(v)));
    sh.free = d.free || [];
    sh.check_time = d.check_time || 0;
    if (d.blocks) sh.blocks = d.blocks;
    if (d.state) [sh.state_changed, sh.not_analyzed, sh.not_optimized_keys, sh.not_sorted_pages] = d.state.map(Boolean);
    sh.slots = new Array(d.nslots || 0).fill(null);
    return sh;
  }

  // ---------------------------------------------------------------------------
  // The join optimizer (make_join_statistics, test_quick_select, find_best)
  // and executor (sub_select, with the join cache's row order)
  // ---------------------------------------------------------------------------
  const TIME_FOR_COMPARE = 5, MATCHING_ROWS_IN_OTHER_TABLE = 10, JOIN_BUFF_SIZE = 131072;
  function fieldRefs(items) {
    const refs = new Set();
    for (const it of items) if (it) it.walk((x) => { if (x.type() === 'FIELD_ITEM' && x.field) refs.add(x.field); });
    return refs;
  }
  function planJoin(q, conds) {
    const tables = q.tables;
    const tabs = tables.map((t) => ({
      t, share: t.share, on: t.ref.on || null, dependent: 0, keyuse: [], type: null, row: undefined,
      records: t.share.rows, found_records: 0, read_time: 0, worst_seeks: 0, quick: null,
    }));
    // dependencies of outer joins
    let outer_join = 0;
    tabs.forEach((s, i) => {
      if (s.on) {
        s.dependent = s.on.used_tables() & ~s.t.map;
        if (s.t.ref.outer === 'left' && i > 0) s.dependent |= tabs[i - 1].dependent | tabs[i - 1].t.map;
        if (s.t.ref.outer === 'right' && i + 1 < tabs.length) s.dependent |= tabs[i + 1].t.map;
        if (s.t.ref.outer) { outer_join |= s.t.map; s.t.maybe_null = true; }
      } else if (s.t.ref.straight && i > 0) s.dependent = tabs[i - 1].t.map | tabs[i - 1].dependent;
    });
    // tables to read: outer join tables after the ones they depend on
    let stat = tabs.slice();
    if (outer_join) {
      let used = 0;
      for (let i = 0; i < stat.length - 1; i++) {
        if (stat[i].dependent & ~used) {
          let j = i + 1;
          while (j < stat.length && stat[j].dependent & ~used) j++;
          if (j === stat.length) throw myError(ER.WRONG_OUTER_JOIN);
          const s = stat.splice(j, 1)[0];
          stat.splice(i, 0, s);
        }
        used |= stat[i].t.map;
      }
    }
    // key uses: field = expression (update_ref_and_keys())
    for (const s of tabs) { s.keys = 0; s.const_keys = 0; s.key_dependent = 0; s.checked_keys = 0; s.not_exists_optimize = false; }
    const whereAll = conds.length ? conds.reduce((x, y) => new Item_cond_and(x, y)) : null;
    const keyuse = updateRefAndKeys(tabs, whereAll, ~outer_join);
    for (const s of tabs) s.keyuse = keyuse.filter((u) => u.s === s);
    for (const u of keyuse) {
      u.s.keys |= 1 << u.key;
      // key parts compared with constants (skipped when an ORDER BY uses the key)
      if (!u.used_tables) { u.s.const_key_parts = u.s.const_key_parts || {}; u.s.const_key_parts[u.key] = (u.s.const_key_parts[u.key] || 0) | (1 << u.keypart); }
    }
    // const tables
    let constMap = 0, constCount = 0;
    const constRows = [];
    const setConst = (s, type) => { s.type = type; constMap |= s.t.map; stat.splice(stat.indexOf(s), 1); stat.splice(constCount++, 0, s); };
    for (const s of stat.slice()) {
      if (!s.dependent && s.records <= 1) setConst(s, 'system');
    }
    let changed;
    do {
      changed = false;
      for (const s of stat.slice(constCount)) {
        if (s.dependent) {
          if (s.dependent & ~constMap) continue;
          if (s.records <= 1) { setConst(s, 'system'); changed = true; continue; }
        }
        for (let nr = 0; nr < s.share.keys.length; nr++) {
          const k = s.share.keys[nr];
          if (!(k.flags & HA_NOSAME)) continue;
          const uses = s.keyuse.filter((u) => u.key === nr && u.val.type() !== 'NULL_ITEM');
          const eq = new Set(uses.map((u) => u.keypart));
          const cst = new Set(uses.filter((u) => !(u.used_tables & ~constMap)).map((u) => u.keypart));
          if (eq.size === k.parts.length && cst.size === eq.size) {
            s.constKey = { key: nr, uses: uses.filter((u) => !(u.used_tables & ~constMap)) };
            setConst(s, 'const');
            changed = true;
            break;
          }
        }
      }
    } while (changed);
    const plan = { tabs, constMap, order: [], impossible: false, full_join: false, positions: [] };
    // read the const tables (join_read_const_tables)
    const combo = new Array(tables.length).fill(undefined);
    for (const s of stat.slice(0, constCount)) {
      let row = null;
      if (s.type === 'system') {
        for (const r of s.share.scan()) { row = r; break; }
      } else {
        for (const t of tables) { const r = combo[t.tablenr]; if (r) { t.record = r.rec; t.null_row = false; } }
        row = lookupKey(s, s.constKey.key, s.constKey.uses, true);
      }
      if (row && s.on) {
        setRowIn(tables, combo);
        s.t.record = row.rec; s.t.null_row = false;
        if (!s.on.val_int()) row = null;
      }
      if (!row) {
        // (EXPLAIN goes on, and says so)
        s.info = s.type === 'system' ? 'const row not found' : 'unique row not found';
        s.records_read = 0;
        if (!(outer_join & s.t.map) && !q.sel.describe) { plan.impossible = true; return plan; }
      }
      combo[s.t.tablenr] = row;
      s.t.const_table = true;
    }
    plan.constCombo = combo;
    plan.constTabs = stat.slice(0, constCount);
    setRowIn(tables, combo);
    // conditions on const tables only
    for (const c of conds) {
      const ut = c.used_tables();
      if (ut && !(ut & ~constMap) && !(ut & RAND_TABLE_BIT) && !c.val_int()) { plan.impossible = true; return plan; }
    }
    // used_keys: keys that hold every column the query reads from a table
    const refs = fieldRefs([...q.all, q.sel.where, q.having, ...q.order.map((o) => o.item), ...q.group.map((o) => o.item), ...tabs.map((s) => s.on)]);
    for (const s of tabs) {
      let used = (1 << s.share.keys.length) - 1;
      for (const f of refs) if (f.table === s.t) used &= f.part_of_key;
      s.used_keys = used;
    }
    // statistics and range estimates (make_join_statistics(): the tables in
    // FROM order; the select condition is made for the first one that needs
    // it, with that table's ON condition, and then reused)
    const rest = stat.slice(constCount);
    let selCond;
    for (const s of tabs) {
      if (s.type === 'system' || s.type === 'const') continue;
      s.found_records = s.records;
      s.read_time = Math.floor(s.share.scan_time());
      s.worst_seeks = Math.max(2, s.read_time * 2);
      if (!s.const_keys) continue;
      if (selCond === undefined) selCond = andConds(whereAll, s.on);
      const r = testQuickSelect(s, selCond, s.const_keys, constMap, Infinity);
      s.quick_rows = r.quick_rows; s.quick_key_parts = r.quick_key_parts;
      if (r.quick) { s.quick = r.quick; s.found_records = r.quick.records; s.read_time = Math.floor(r.quick.read_time); }
      else if (r.impossible) { s.found_records = 0; s.read_time = 0; s.impossible_range = true; }
    }
    // find_best()
    const best = { read: Infinity, positions: null };
    const positions = [];
    const findBest = (restMap, idx, record_count, read_time, order) => {
      if (!restMap) {
        read_time += record_count / TIME_FOR_COMPARE;
        if (read_time < best.read) { best.read = read_time; best.positions = positions.slice(0, idx - constCount); }
        return;
      }
      if (read_time + record_count / TIME_FOR_COMPARE >= best.read) return;
      let best_record_count = Infinity, best_read_time = Infinity;
      for (let pi = 0; pi < order.length; pi++) {
        const s = order[pi];
        if (!(restMap & s.t.map) || (restMap & s.dependent)) continue;
        const acc = accessCost(s, restMap, constMap, record_count, idx - constCount, positions, tables);
        positions[idx - constCount] = { s, key: acc.key, keyuses: acc.keyuses, records: acc.records };
        const crc = record_count * acc.records, crt = read_time + acc.best;
        if (best_record_count > crc || best_read_time > crt) {
          if (best_record_count >= crc && best_read_time >= crt && (!(s.key_dependent & restMap) || acc.records < 2)) {
            best_record_count = crc; best_read_time = crt;
          }
          findBest(restMap & ~s.t.map, idx + 1, crc, crt, order.filter((x) => x !== s));
        }
        if (q.sel.options.straight_join) break;
      }
    };
    let restMap = 0;
    for (const s of rest) restMap |= s.t.map;
    if (rest.length) findBest(restMap, constCount, 1, 0, rest);
    plan.order = (best.positions || []).map((p) => p.s.t);
    plan.positions = best.positions || [];
    // access methods (get_best_combination, make_join_readinfo)
    plan.positions.forEach((p, i) => {
      const s = p.s;
      if (p.key !== null) {
        const k = s.share.keys[p.key];
        s.type = (k.flags & (HA_NOSAME | HA_NULL_PART_KEY)) === HA_NOSAME && p.keyuses.length === k.parts.length ? 'eq_ref' : 'ref';
        s.refKey = p.key; s.refUses = p.keyuses;
      } else {
        s.type = 'all';
        if (i > 0) { plan.full_join = true; if (!s.on) s.cache = true; }
      }
    });
    // make_join_select()
    let used = constMap | RAND_TABLE_BIT;
    plan.positions.forEach((p, i) => {
      const s = p.s;
      used |= s.t.map;
      // a range on more of the key than the ref uses
      if (s.type === 'ref' && s.quick && s.quick.key === s.refKey && refKeyLength(s) < s.quick.max_used_key_length) {
        s.type = 'all'; s.refKey = -1; p.records = s.quick.records; p.useQuickRange = true;
      }
      const tmp = condForTable(whereAll, used, s.t.map, plan);
      if (tmp || s.quick) {
        const selCond = tmp ? (Array.isArray(tmp) ? (tmp.length > 1 ? tmp.reduce((x, y) => new Item_cond_and(x, y)) : tmp[0]) : tmp) : null;
        if (s.type === 'eq_ref' || (s.type === 'ref' && s.quick && s.quick.key !== s.refKey)) s.quick = null;
        if (i === 0 && (s.type === 'eq_ref' || s.type === 'ref')) {
          if (s.const_keys && s.impossible_range) plan.impossible = true;
        } else if (s.type === 'all' && !p.useQuickRange) {
          if (s.const_keys && s.impossible_range) plan.impossible = true;
          // check again whether an index helps: with the earlier tables' values
          // (a range for each row), or for a LIMIT
          let needed_reg = 0;
          if (((s.keys & ~s.const_keys) && i > 0) || (s.const_keys && i === 0 && THD.select_limit < p.records)) {
            const prev = used & ~s.t.map;
            const r = testQuickSelect(s, andConds(selCond, s.on), s.keys, prev, THD.select_limit, constMap);
            if (r.impossible) plan.impossible = true;
            s.quick = r.quick;
            needed_reg = r.needed_reg;
          }
          if (needed_reg & ~s.checked_keys) {
            s.keys = needed_reg;
            s.use_quick = 2;              // "range checked for each record"
            s.rangeCond = selCond;
            s.prevUsed = used & ~s.t.map;
            s.cache = false;
          }
        }
      } else s.quick = null;
      // make_join_readinfo(): a covering index is read instead of the rows
      if (s.type === 'all' && !s.quick && s.used_keys) s.index = shortestKey(s.share, s.used_keys);
    });
    return plan;
  }
  // add_key_fields(): the conditions an index can serve
  const isEqFunc = (c) => c instanceof Item_func_eq || c instanceof Item_func_equal;
  function selectOptimize(c) {
    if (c instanceof Item_func_ne || c instanceof Item_func_strcmp || c instanceof Item_func_nullif) return 'NONE';
    if (c instanceof Item_func_like) {
      const p = c.args[1];
      if (p.type() === 'STRING_ITEM' && p.str_value[0] !== '%' && (c.args[0].result_type() !== STRING_RESULT || p.str_value[0] !== '_')) return 'OP';
      return 'NONE';
    }
    if (c instanceof Item_bool_func2) return 'OP';
    if (c instanceof Item_func_between) return 'KEY';
    if (c instanceof Item_func_in) return c.args.every((a) => a.const_item()) ? 'KEY' : 'NONE';
    if (c instanceof Item_func_isnull || c instanceof Item_func_isnotnull) return 'NULL';
    return 'NONE';
  }
  function updateRefAndKeys(tabs, cond, normal_tables) {
    const kf = [];
    const st = { and_level: 0 };
    const tabOf = (f) => tabs.find((x) => x.t === f.table);
    const addKeyField = (field, eq_func, value, usable_tables) => {
      const s = tabOf(field);
      if (!s) return;
      let exists_optimize = false;
      const nullValue = value && value.type() === 'NULL_ITEM';
      if (!(field.flags & F.PART_KEY)) {
        // don't remove "column IS NULL" on a LEFT JOIN table
        if (!eq_func || !nullValue || !s.t.maybe_null || field.nullable) return;
        exists_optimize = true;
      } else {
        const used_tables = value ? value.used_tables() : 0;
        if (value && (used_tables & (s.t.map | RAND_TABLE_BIT))) return;
        if (!(usable_tables & s.t.map)) {
          if (!eq_func || !nullValue || !s.t.maybe_null || field.nullable) return;
          exists_optimize = true;
        } else {
          s.keys |= field.key_start;
          if (!value) { s.const_keys |= field.key_start; return; }      // BETWEEN or IN
          s.key_dependent |= used_tables;
          if (value.const_item()) s.const_keys |= field.key_start;
          // a string index can't serve a comparison with a number
          if (!eq_func || (field.result_type() === STRING_RESULT && value.result_type() !== STRING_RESULT &&
            field.cmp_type() !== value.result_type())) return;
        }
      }
      kf.push({ field, s, eq_func, val: value, level: st.and_level, const_level: st.and_level, exists_optimize });
    };
    const addKeyFields = (c, usable) => {
      if (c instanceof Item_cond) {
        const org = kf.length;
        if (c instanceof Item_cond_and) {
          for (const a of c.args) addKeyFields(a, usable);
          for (let i = org; i < kf.length; i++) {
            if (kf[i].const_level === kf[i].level) kf[i].const_level = kf[i].level = st.and_level;
            else kf[i].const_level = st.and_level;
          }
        } else {
          st.and_level++;
          addKeyFields(c.args[0], usable);
          for (let i = 1; i < c.args.length; i++) {
            const start = kf.length;
            st.and_level++;
            addKeyFields(c.args[i], usable);
            kf.length = mergeKeyFields(kf, org, start, kf.length, ++st.and_level);
          }
        }
        return;
      }
      if (!(c instanceof Item_func)) return;
      switch (selectOptimize(c)) {
        case 'KEY': {
          const k = c instanceof Item_func_in ? c.item : c.args[0];
          if (k.type() === 'FIELD_ITEM') addKeyField(k.field, false, null, usable);
          break;
        }
        case 'OP': {
          const eq = isEqFunc(c);
          if (c.args[0].type() === 'FIELD_ITEM') addKeyField(c.args[0].field, eq, c.args[1], usable);
          if (c.args[1].type() === 'FIELD_ITEM' && !(c instanceof Item_func_like)) addKeyField(c.args[1].field, eq, c.args[0], usable);
          break;
        }
        case 'NULL':
          if (c.args[0].type() === 'FIELD_ITEM') addKeyField(c.args[0].field, c instanceof Item_func_isnull, new Item_null(), usable);
          break;
      }
    };
    if (cond) addKeyFields(cond, normal_tables);
    for (const s of tabs) if (s.on) addKeyFields(s.on, s.t.map);
    // add_key_part()
    let uses = [];
    for (const k of kf) {
      if (k.eq_func && !k.exists_optimize) {
        k.s.share.keys.forEach((key, nr) => {
          if (key.flags & HA_FULLTEXT) return;
          key.parts.forEach((p, part) => {
            if (p.field === k.field.idx) uses.push({ s: k.s, key: nr, keypart: part, val: k.val, used_tables: k.val.used_tables() });
          });
        });
      }
      if (k.val.type() === 'NULL_ITEM' && !k.field.real_maybe_null()) k.s.not_exists_optimize = true;
    }
    // sort_keyuse(), then drop key parts without the ones before them
    uses = uses.map((u, i) => ({ u, i })).sort((a, b) => a.u.s.t.tablenr - b.u.s.t.tablenr || a.u.key - b.u.key ||
      a.u.keypart - b.u.keypart || (a.u.used_tables ? 1 : 0) - (b.u.used_tables ? 1 : 0) || a.i - b.i).map((x) => x.u);
    const out = [];
    let prev = null, found_eq_constant = false;
    for (const use of uses) {
      if (prev && use.key === prev.key && use.s === prev.s) {
        if (prev.keypart + 1 < use.keypart || (prev.keypart === use.keypart && found_eq_constant)) continue;
      } else if (use.keypart !== 0) continue;
      out.push(use);
      prev = use;
      found_eq_constant = !use.used_tables;
      use.s.checked_keys |= 1 << use.key;
    }
    return out;
  }
  // merge_key_fields(): what both sides of an OR can use
  function mergeKeyFields(arr, start, newFields, end, and_level) {
    if (start === newFields) return start;
    if (newFields === end) return start;
    let first_free = newFields;
    for (let nf = newFields; nf !== end; nf++) {
      for (let old = start; old !== first_free; old++) {
        if (arr[old].field !== arr[nf].field) continue;
        if (arr[nf].val.used_tables()) {
          if (arr[old].val.eq(arr[nf].val)) {
            arr[old].level = arr[old].const_level = and_level;
            arr[old].exists_optimize = arr[old].exists_optimize && arr[nf].exists_optimize;
          }
        } else if (arr[old].val.eq(arr[nf].val) && arr[old].eq_func && arr[nf].eq_func) {
          arr[old].level = arr[old].const_level = and_level;
          arr[old].exists_optimize = arr[old].exists_optimize && arr[nf].exists_optimize;
        } else {
          if (old === --first_free) break;
          arr[old] = arr[first_free];
          old--;
        }
      }
    }
    for (let old = start; old !== first_free;) {
      if (arr[old].level !== and_level && arr[old].const_level !== and_level) {
        if (old === --first_free) break;
        arr[old] = arr[first_free];
        continue;
      }
      old++;
    }
    return first_free;
  }
  const andConds = (a, b) => (a && b ? new Item_cond_and(a, b) : a || b || null);
  function refKeyLength(s) {
    const k = s.share.keys[s.refKey];
    let len = 0;
    for (let part = 0; part < k.parts.length && s.refUses.some((u) => u.keypart === part); part++) {
      const p = k.parts[part], f = s.share.fields[p.field];
      len += (p.length || f.pack_length()) + (f.nullable ? 1 : 0) + (f.type() === T.BLOB ? 2 : 0);
    }
    return len;
  }
  function setRowIn(tables, combo) {
    for (const t of tables) {
      const r = combo[t.tablenr];
      if (r === undefined) continue;
      if (r === null) t.null_row = true;
      else { t.record = r.rec; t.null_row = false; t.pos = r.pos; }
    }
  }
  function shortestKey(share, keys) {
    let best = -1, min = Infinity;
    share.keys.forEach((k, nr) => { if ((keys & (1 << nr)) && k.key_length < min) { min = k.key_length; best = nr; } });
    return best;
  }
  // the cost of reading table s after the tables not in restMap (find_best's inner part)
  function accessCost(s, restMap, constMap, record_count, idx, positions, tables) {
    let best = Infinity, records = Infinity, best_key = null, best_uses = null, best_time = Infinity;
    if (s.keyuse.length) {
      let rec = Math.floor(s.records / MATCHING_ROWS_IN_OTHER_TABLE);
      const byKey = new Map();
      for (const u of s.keyuse) { if (!byKey.has(u.key)) byKey.set(u.key, []); byKey.get(u.key).push(u); }
      // (TABLE::max_key_length: the longest key_length + key_parts, from the
      // .frm lengths, before NULL bytes are added)
      const max_key_length = Math.max(...s.share.keys.map((k) => k.parts.reduce((n, p) => n + (p.length || s.share.fields[p.field].pack_length()), 0) + k.parts.length));
      for (const [key, uses] of byKey) {
        const k = s.share.keys[key];
        let found_part = 0, found_ref = 0;
        const usable = [];
        for (const u of uses) {
          if (!(restMap & u.used_tables)) { found_part |= 1 << u.keypart; found_ref |= u.used_tables; usable.push(u); }
          const map = u.used_tables & ~constMap;
          if (map && !(map & (map - 1))) {
            const other = tables.find((t) => t.map === map);
            if (other && rec > other.share.rows && rec > 100) rec = Math.max(other.share.rows, 100);
          }
        }
        if (!found_part) continue;
        if (rec === 0) rec = 1;
        let tmp, recs, max_key_part = 0;
        const allParts = (1 << k.parts.length) - 1;
        if (found_part === allParts) {
          max_key_part = 1e9;
          if ((k.flags & (HA_NOSAME | HA_NULL_PART_KEY)) === HA_NOSAME) {
            tmp = prevRecordReads(positions, idx, found_ref);
            recs = 1;
          } else {
            if (!found_ref) recs = s.quick_rows && s.quick_rows[key] !== undefined ? s.quick_rows[key] : s.records / rec;
            else {
              recs = s.records / rec * (1 + (max_key_length - k.key_length) / max_key_length);
              if (recs < 2) recs = 2;
            }
            if (s.used_keys & (1 << key)) { const kpb = Math.floor(1024 / 2 / k.key_length) + 1; tmp = record_count * (recs + kpb - 1) / kpb; }
            else tmp = record_count * Math.min(recs, s.worst_seeks);
          }
        } else if (found_part & 1) {
          max_key_part = 0;
          while (found_part & (1 << max_key_part)) max_key_part++;
          if (s.quick_rows && s.quick_rows[key] !== undefined && s.quick_key_parts[key] <= max_key_part) tmp = recs = s.quick_rows[key];
          else {
            let rpk = s.records / rec + 1;
            if (!s.records) tmp = 0;
            else if (rpk / s.records >= 0.01) tmp = rpk;
            else {
              const a = s.records * 0.01;
              tmp = Math.max(1, (max_key_part * (rpk - a) + a * k.parts.length - rpk) / (k.parts.length - 1));
            }
            recs = Math.floor(tmp);
          }
          if (s.used_keys & (1 << key)) { const kpb = Math.floor(1024 / 2 / k.key_length) + 1; tmp = record_count * (tmp + kpb - 1) / kpb; }
          else tmp = record_count * Math.min(tmp, s.worst_seeks);
        } else tmp = best_time;
        if (tmp < best_time - recs / TIME_FOR_COMPARE) {
          best_time = tmp + recs / TIME_FOR_COMPARE;
          best = tmp; records = recs; best_key = key; best_uses = usable;
        }
      }
    }
    if (records >= s.found_records || best > s.read_time) {
      let tmp;
      if (s.on) tmp = s.found_records;
      else tmp = s.read_time * (1 + Math.floor(20 * record_count / JOIN_BUFF_SIZE));
      if (best === Infinity || tmp + record_count / TIME_FOR_COMPARE * s.found_records < best + record_count / TIME_FOR_COMPARE * records) {
        best = tmp; records = s.found_records; best_key = null; best_uses = null;
      }
    }
    return { best, records, key: best_key, keyuses: best_uses };
  }
  function prevRecordReads(positions, idx, found_ref) {
    let found = 1;
    for (let i = 0; i < idx; i++) {
      const p = positions[i];
      if (p && (found_ref & p.s.t.map)) found *= p.records;
    }
    return found;
  }
  // range conditions on the first part of a key (opt_range.cc, simplified):
  // the rows in range, in key order, when the range is cheaper than a scan
  // rows in the order of a key (the key value, then the row position)
  // all rows in the order of a key (cached until the table changes)
  function indexOrder(share, t, key) {
    const c = share.cache('order');
    let r = c.get(key);
    if (!r) { r = sortByKey(share, t, key, [...share.scan()]); c.set(key, r); }
    return r;
  }
  function sortByKey(share, t, key, rows) {
    const k = share.keys[key];
    const fields = k.parts.map((p) => t.fields[p.field]);
    return rows.slice().sort((a, b) => {
      for (const f of fields) {
        const x = a.rec[f.idx], y = b.rec[f.idx];
        if (x === null || y === null) { if (x !== y) return x === null ? -1 : 1; continue; }
        const c = valCmp(f, x, y);
        if (c) return c;
      }
      return a.pos - b.pos;
    });
  }
  // rows of table s whose key equals the values of the key uses
  function lookupKey(s, key, uses, first) {
    const k = s.share.keys[key];
    const t = s.t;
    const probe = new TableInst(s.share, t.alias);
    const want = [];
    for (let part = 0; part < k.parts.length; part++) {
      const u = uses.find((x) => x.keypart === part);
      if (!u) break;
      const f = probe.fields[k.parts[part].field];
      THD.no_errors = true;
      try {
        f.set_notnull();
        // (a NULL goes into a nullable key part and finds the NULL keys)
        if (u.val.save_in_field(f)) { THD.no_errors = false; return first ? null : []; }
      } finally { THD.no_errors = false; }
      const v = probe.record[f.idx];
      want.push({ idx: f.idx, norm: v === null ? null : keyNorm(f, v, k.parts[part].length) });
    }
    // the rows by key prefix, in key order (cached until the table changes)
    const c = s.share.cache('lookup');
    const ck = key + ':' + want.length;
    let map = c.get(ck);
    if (!map) {
      map = new Map();
      for (const r of indexOrder(s.share, t, key)) {
        let h = '';
        for (let i = 0; i < want.length; i++) {
          const v = r.rec[want[i].idx];
          h += (v === null ? '\x02N' : '\x01' + keyNorm(t.fields[want[i].idx], v, k.parts[i].length)) + '\x00';
        }
        let list = map.get(h);
        if (!list) map.set(h, (list = []));
        list.push(r);
      }
      c.set(ck, map);
    }
    let h = '';
    for (const w of want) h += (w.norm === null ? '\x02N' : '\x01' + w.norm) + '\x00';
    const out = map.get(h) || [];
    return first ? out[0] || null : out;
  }
  // only_eq_ref_tables(): each table is found by a unique key from columns
  // that are earlier in the order (so it doesn't change the order)
  function onlyEqRefTables(plan, order, map) {
    for (const s of plan.tabs) if ((map & s.t.map) && !eqRefTable(plan, order, s)) return false;
    return true;
  }
  function eqRefTable(plan, order, s) {
    if (s.type === 'const' || s.type === 'system') return true;
    if (s.type !== 'eq_ref') return false;
    let found = 0;
    const used = new Set();
    for (const u of s.refUses) {
      const ref = u.val;
      if (ref.const_item()) continue;
      const o = order.find((x) => ref.eq(x.item));
      if (o) { found++; used.add(o); continue; }
      if (!onlyEqRefTables(plan, order, ref.used_tables())) return false;
    }
    for (const o of order) {
      if (!found) break;
      if (used.has(o)) { found--; continue; }
      if (o.item.used_tables() & s.t.map) return false;
    }
    return true;
  }
  // test_if_skip_sort_order() for GROUP BY on the first table
  function skipSortOrder(plan, first, list, select_limit = Infinity) {
    if (!first) return false;
    const s = plan.tabs.find((x) => x.t === first);
    let usable = -1 >>> 0;
    for (const o of list) {
      if (o.item.type() !== 'FIELD_ITEM') return false;
      usable &= o.item.field.part_of_sortkey;
    }
    // test_if_order_by_key(): key parts compared with constants are skipped
    const orderByKey = (nr) => {
      const k = s.share.keys[nr];
      let const_parts = (s.const_key_parts && s.const_key_parts[nr]) || 0;
      let rev = 0, part = 0;
      for (let i = 0; i < list.length; i++, const_parts >>= 1) {
        while (const_parts & 1) { part++; const_parts >>= 1; }
        if (part >= k.parts.length || k.parts[part].field !== list[i].item.field.idx) return 0;
        const flag = list[i].asc ? 1 : -1;
        if (rev && flag !== rev) return 0;
        rev = flag;
        part++;
      }
      return rev;
    };
    const ref_key = s.type === 'ref' || s.type === 'eq_ref' ? s.refKey : s.quick ? s.quick.key : -1;
    if (ref_key >= 0) return !!((usable & (1 << ref_key)) && orderByKey(ref_key) === 1);
    // without a LIMIT below the row count only a covering index is worth it
    let keys = select_limit >= s.share.rows ? usable & s.used_keys : usable;
    for (let nr = 0; nr < s.share.keys.length; nr++) {
      if (keys & (1 << nr)) {
        const flag = orderByKey(nr);
        if (flag) { s.type = 'all'; s.index = nr; s.indexReverse = flag < 0; return true; }
      }
    }
    return false;
  }

  // execute the join: the result rows (combos) in MySQL's order
  function executeJoin(q, plan) {
    const tables = q.tables;
    let combos = [plan.constCombo.slice()];
    const conds = splitAnd(q.sel.where);
    let avail = plan.constMap;
    const done = new Set();
    // conditions whose tables are all read and not yet checked
    const ready = () => {
      const list = [];
      for (const c of conds) {
        if (done.has(c)) continue;
        const ut = c.used_tables() & ~RAND_TABLE_BIT;
        if (!(ut & ~avail)) { list.push(c); done.add(c); }
      }
      return list;
    };
    const ok = (list) => list.every((c) => c.val_int() !== 0n);
    ready();                       // const conditions were checked by planJoin
    plan.positions.forEach((p, i) => {
      const s = p.s, t = s.t;
      avail |= t.map;
      const isLast = i === plan.positions.length - 1;
      const levelConds = ready();
      if (isLast) for (const c of conds) if (!done.has(c)) { levelConds.push(c); done.add(c); }
      const rowsOf = (combo) => {
        if (s.sortedRows) return s.sortedRows;
        if (s.use_quick === 2) {
          // the range optimizer again, with this row's values
          setRowIn(tables, combo);
          const r = testQuickSelect(s, s.rangeCond, s.keys, s.prevUsed, Infinity, s.prevUsed);
          if (r.impossible) return [];
          return r.quick ? r.quick.rows : [...s.share.scan()];
        }
        if (s.type === 'eq_ref' || s.type === 'ref') {
          setRowIn(tables, combo);
          return lookupKey(s, s.refKey, s.refUses, false);
        }
        if (s.quick) return s.quick.rows;
        if (s.index !== undefined && s.index >= 0) {
          const r = indexOrder(s.share, t, s.index).slice();
          return s.indexReverse ? r.reverse() : r;
        }
        return [...s.share.scan()];
      };
      const next = [];
      if (s.cache) {
        const rows = rowsOf(null);
        for (const r of rows) {
          for (const c of combos) {
            const n = c.slice(); n[t.tablenr] = r;
            setRowIn(tables, n);
            if (ok(levelConds)) next.push(n);
          }
        }
      } else {
        const outer = !!(t.ref.outer && s.on);
        for (const c of combos) {
          const rows = rowsOf(c);
          let matched = false;
          for (const r of rows) {
            const n = c.slice(); n[t.tablenr] = r;
            setRowIn(tables, n);
            if (s.on && !s.on.val_int()) continue;
            matched = true;
            if (ok(levelConds)) next.push(n);
          }
          if (outer && !matched) {
            const n = c.slice(); n[t.tablenr] = null;
            setRowIn(tables, n);
            t.null_row = true;
            if (ok(levelConds)) next.push(n);
          }
        }
      }
      combos = next;
    });
    if (!plan.positions.length) {
      setRowIn(tables, combos[0]);
      if (!ok(ready().concat(conds.filter((c) => !done.has(c))))) combos = [];
    }
    return combos;
  }

  // ---------------------------------------------------------------------------
  // The range optimizer (sql/opt_range.cc): a condition becomes, per key, a
  // set of intervals on its first part, each with the intervals of the next
  // part (SEL_ARG); MyISAM estimates the rows in each (mi_records_in_range());
  // the cheapest key is read range by range, in key order (QUICK_SELECT)
  // ---------------------------------------------------------------------------
  const IMPOSSIBLE = { impossible: true };
  // a key that depends on a table not read yet (SEL_ARG::MAYBE_KEY)
  const MAYBE = { maybe: true };
  const withMaybe = (t) => (t === IMPOSSIBLE || t === MAYBE || t.maybe ? t : Object.assign({}, t, { maybe: true }));
  // an interval: min/max are stored key values (null is SQL NULL, the
  // smallest); noMin/noMax for open ends; minNear/maxNear exclude the end
  const iv = (o) => Object.assign({ min: undefined, max: undefined, noMin: false, noMax: false, minNear: false, maxNear: false, next: null }, o);

  // a key part's order: NULL first, then the field's comparison (on the
  // part's prefix)
  function partCmp(f, len, a, b) {
    if (a === null || b === null) return a === b ? 0 : a === null ? -1 : 1;
    if (len && typeof a === 'string' && typeof b === 'string') { a = a.slice(0, len); b = b.slice(0, len); }
    return valCmp(f, a, b);
  }
  // SEL_ARG trees: { part, f, len, ivs: [intervals in order] } or IMPOSSIBLE
  function keyAnd(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (a === IMPOSSIBLE || b === IMPOSSIBLE) return IMPOSSIBLE;
    if (a === MAYBE) return withMaybe(b);
    if (b === MAYBE) return withMaybe(a);
    if (a.maybe || b.maybe) {
      const r = keyAnd(Object.assign({}, a, { maybe: false }), Object.assign({}, b, { maybe: false }));
      return r === IMPOSSIBLE ? r : withMaybe(r);
    }
    if (a.part > b.part) [a, b] = [b, a];
    if (a.part < b.part) {
      const ivs = [];
      for (const x of a.ivs) {
        const next = keyAnd(x.next, b);
        if (next !== IMPOSSIBLE) ivs.push(Object.assign({}, x, { next }));
      }
      return ivs.length ? Object.assign({}, a, { ivs }) : IMPOSSIBLE;
    }
    const out = [];
    for (const x of a.ivs) {
      for (const y of b.ivs) {
        const r = intersect(a, x, y);
        if (!r) continue;
        r.next = keyAnd(x.next, y.next);
        if (r.next !== IMPOSSIBLE) out.push(r);
      }
    }
    return out.length ? Object.assign({}, a, { ivs: out.sort((p, q) => lowCmp(a, p, q)) }) : IMPOSSIBLE;
  }
  // compare interval starts / ends
  function lowCmp(k, p, q) {
    if (p.noMin || q.noMin) return p.noMin === q.noMin ? 0 : p.noMin ? -1 : 1;
    const c = partCmp(k.f, k.len, p.min, q.min);
    return c || (p.minNear === q.minNear ? 0 : p.minNear ? 1 : -1);
  }
  function highCmp(k, p, q) {
    if (p.noMax || q.noMax) return p.noMax === q.noMax ? 0 : p.noMax ? 1 : -1;
    const c = partCmp(k.f, k.len, p.max, q.max);
    return c || (p.maxNear === q.maxNear ? 0 : p.maxNear ? -1 : 1);
  }
  function intersect(k, x, y) {
    const lo = lowCmp(k, x, y) >= 0 ? x : y, hi = highCmp(k, x, y) <= 0 ? x : y;
    const r = iv({ min: lo.min, noMin: lo.noMin, minNear: lo.minNear, max: hi.max, noMax: hi.noMax, maxNear: hi.maxNear });
    return emptyInterval(k, r) ? null : r;
  }
  function emptyInterval(k, r) {
    if (r.noMin || r.noMax) return false;
    const c = partCmp(k.f, k.len, r.min, r.max);
    return c > 0 || (c === 0 && (r.minNear || r.maxNear));
  }
  function sameTree(a, b) {
    if (a === b) return true;
    if (!a || !b || a === IMPOSSIBLE || b === IMPOSSIBLE || a.part !== b.part || a.ivs.length !== b.ivs.length) return false;
    return a.ivs.every((x, i) => {
      const y = b.ivs[i];
      return lowCmp(a, x, y) === 0 && highCmp(a, x, y) === 0 && sameTree(x.next, y.next);
    });
  }
  // key_or(): the union, split where the next parts differ
  function keyOr(a, b) {
    if (!a || !b) return null;
    if (a === IMPOSSIBLE) return b;
    if (b === IMPOSSIBLE) return a;
    if (a === MAYBE || b === MAYBE) return MAYBE;
    if (a.part !== b.part) return null;
    // the elementary pieces between the interval ends
    const pts = [];
    for (const x of [...a.ivs, ...b.ivs]) { if (!x.noMin) pts.push(x.min); if (!x.noMax) pts.push(x.max); }
    pts.sort((p, q) => partCmp(a.f, a.len, p, q));
    const uniq = pts.filter((p, i) => i === 0 || partCmp(a.f, a.len, p, pts[i - 1]) !== 0);
    const atoms = [];
    atoms.push({ lo: null, hi: uniq.length ? uniq[0] : null, point: false, loInf: true, hiInf: !uniq.length });
    uniq.forEach((p, i) => {
      atoms.push({ point: true, v: p });
      atoms.push({ lo: p, hi: i + 1 < uniq.length ? uniq[i + 1] : null, point: false, loInf: false, hiInf: i + 1 >= uniq.length });
    });
    const covers = (x, at) => {
      if (at.point) {
        const lo = x.noMin || partCmp(a.f, a.len, at.v, x.min) > 0 || (partCmp(a.f, a.len, at.v, x.min) === 0 && !x.minNear);
        const hi = x.noMax || partCmp(a.f, a.len, at.v, x.max) < 0 || (partCmp(a.f, a.len, at.v, x.max) === 0 && !x.maxNear);
        return lo && hi;
      }
      const lo = x.noMin || (!at.loInf && partCmp(a.f, a.len, x.min, at.lo) <= 0);
      const hi = x.noMax || (!at.hiInf && partCmp(a.f, a.len, x.max, at.hi) >= 0);
      return lo && hi;
    };
    const pieces = [];
    for (const at of atoms) {
      const xa = a.ivs.find((x) => covers(x, at)), xb = b.ivs.find((x) => covers(x, at));
      if (!xa && !xb) { pieces.push(null); continue; }
      const next = xa && xb ? keyOr(xa.next, xb.next) : (xa || xb).next;
      pieces.push({ at, next });
    }
    // join neighbouring pieces with the same next part
    const ivs = [];
    let cur = null;
    for (const p of pieces) {
      if (!p) { cur = null; continue; }
      if (cur && sameTree(cur.next, p.next)) {
        if (p.at.point) { cur.max = p.at.v; cur.maxNear = false; cur.noMax = false; }
        else if (p.at.hiInf) { cur.noMax = true; cur.max = undefined; }
        else { cur.max = p.at.hi; cur.maxNear = true; }
        continue;
      }
      if (p.at.point) cur = iv({ min: p.at.v, max: p.at.v, next: p.next });
      else cur = iv({ min: p.at.lo, noMin: p.at.loInf, minNear: !p.at.loInf, max: p.at.hi, noMax: p.at.hiInf, maxNear: !p.at.hiInf, next: p.next });
      ivs.push(cur);
    }
    return ivs.length ? Object.assign({}, a, { ivs }) : IMPOSSIBLE;
  }
  // SEL_TREE: null is "can't use", ALWAYS, IMPOSSIBLE, or { keys: Map(nr -> SEL_ARG) }
  const ALWAYS = { always: true };
  // SEL_TREE::MAYBE: a condition that doesn't use the table (true or false)
  const TREE_MAYBE = { maybeTree: true };
  function treeAnd(t1, t2) {
    if (!t1) return t2;
    if (!t2) return t1;
    if (t1 === IMPOSSIBLE || t2 === ALWAYS) return t1;
    if (t2 === IMPOSSIBLE || t1 === ALWAYS) return t2;
    if (t1 === TREE_MAYBE) return t2;
    if (t2 === TREE_MAYBE) return t1;
    const keys = new Map(t1.keys);
    for (const [nr, k] of t2.keys) {
      const r = keyAnd(keys.get(nr) || null, k);
      if (r === IMPOSSIBLE) return IMPOSSIBLE;
      keys.set(nr, r);
    }
    return { keys };
  }
  function treeOr(t1, t2) {
    if (!t1 || !t2) return null;
    if (t1 === IMPOSSIBLE || t2 === ALWAYS) return t2;
    if (t2 === IMPOSSIBLE || t1 === ALWAYS) return t1;
    if (t1 === TREE_MAYBE) return t1;
    if (t2 === TREE_MAYBE) return t2;
    const keys = new Map();
    for (const [nr, k] of t1.keys) {
      if (!t2.keys.has(nr)) continue;
      const r = keyOr(k, t2.keys.get(nr));
      if (r) keys.set(nr, r);
    }
    return keys.size ? { keys } : null;
  }

  class RangeParam {
    constructor(s, keys, prev_tables, read_tables) {
      this.s = s; this.t = s.t; this.share = s.share; this.keys = keys; this.prev_tables = prev_tables; this.read_tables = read_tables;
    }
    // get_mm_tree()
    tree(cond) {
      if (cond instanceof Item_cond_and) {
        let tree = null;
        for (const a of cond.args) {
          tree = treeAnd(tree, this.tree(a));
          if (tree === IMPOSSIBLE) break;
        }
        return tree;
      }
      if (cond instanceof Item_cond_or) {
        let tree = this.tree(cond.args[0]);
        if (!tree) return null;
        for (let i = 1; i < cond.args.length; i++) {
          const t2 = this.tree(cond.args[i]);
          if (!t2) return null;
          tree = treeOr(tree, t2);
          if (!tree || tree === ALWAYS) break;
        }
        return tree;
      }
      if (cond.const_item()) return cond.val_int() ? ALWAYS : IMPOSSIBLE;
      const ut = cond.used_tables();
      if (ut & ~(this.prev_tables | this.read_tables | this.t.map)) return null;
      if (!(cond instanceof Item_func)) return ut & this.t.map ? null : TREE_MAYBE;
      if (!(ut & this.t.map)) return TREE_MAYBE;
      if (selectOptimize(cond) === 'NONE') return null;
      if (cond instanceof Item_func_between) {
        if (cond.args[0].type() !== 'FIELD_ITEM') return null;
        const f = cond.args[0].field;
        return treeAnd(this.parts(f, 'GE', cond.args[1]), this.parts(f, 'LE', cond.args[2]));
      }
      if (cond instanceof Item_func_in) {
        if (cond.item.type() !== 'FIELD_ITEM') return null;
        const f = cond.item.field;
        let tree = this.parts(f, 'EQ', cond.args[0]);
        if (!tree) return null;
        for (let i = 1; i < cond.args.length; i++) tree = treeOr(tree, this.parts(f, 'EQ', cond.args[i]));
        return tree;
      }
      const type = cond instanceof Item_func_isnull ? 'ISNULL' : cond instanceof Item_func_isnotnull ? 'ISNOTNULL' :
        cond instanceof Item_func_like ? 'LIKE' : cond instanceof Item_func_equal ? 'EQUAL' : cond instanceof Item_func_eq ? 'EQ' :
        cond instanceof Item_func_lt ? 'LT' : cond instanceof Item_func_le ? 'LE' : cond instanceof Item_func_gt ? 'GT' :
        cond instanceof Item_func_ge ? 'GE' : null;
      if (!type) return null;
      let tree = null;
      if (cond.args[0].type() === 'FIELD_ITEM') tree = this.parts(cond.args[0].field, type, cond.args.length > 1 ? cond.args[1] : null, cond);
      // "const op field": the reversed comparison (have_rev_func())
      const REV = { EQ: 'EQ', EQUAL: 'EQUAL', LT: 'GT', LE: 'GE', GT: 'LT', GE: 'LE' };
      if (!tree && REV[type] && cond.args[1].type() === 'FIELD_ITEM') return this.parts(cond.args[1].field, REV[type], cond.args[0], cond);
      return tree;
    }
    // get_mm_parts(): the field's intervals in each key that has it
    parts(field, type, value, cond) {
      if (field.table !== this.t) return null;
      if (value && (value.used_tables() & ~(this.prev_tables | this.read_tables))) return null;
      // a value from a table not read yet: the key may be usable later
      const maybe = value && (value.used_tables() & ~this.read_tables);
      let tree = null;
      for (const nr of this.keys) {
        const k = this.share.keys[nr];
        k.parts.forEach((p, part) => {
          if (p.field !== field.idx) return;
          if (!tree) tree = { keys: new Map() };
          if (tree === IMPOSSIBLE) return;
          if (maybe) { tree.keys.set(nr, keyAnd(tree.keys.get(nr) || null, MAYBE)); return; }
          const leaf = this.leaf(field, p, part, type, value, cond);
          if (!leaf) return;
          if (leaf === IMPOSSIBLE) { tree = IMPOSSIBLE; return; }
          tree.keys.set(nr, keyAnd(tree.keys.get(nr) || null, leaf));
        });
        if (tree === IMPOSSIBLE) return tree;
      }
      return tree && tree.keys.size ? tree : tree === IMPOSSIBLE ? tree : null;
    }
    // get_mm_leaf()
    leaf(field, p, part, type, value, cond) {
      const f = this.share.fields[field.idx];
      const mk = (ivs) => ({ part, f, len: p.length || 0, ivs });
      const maybe_null = f.nullable;
      if (type === 'LIKE') {
        if (!f.optimize_range()) return null;
        const res = value.val_str();
        if (res === null) return IMPOSSIBLE;
        if (f.cmp_type() !== STRING_RESULT) return null;
        const len = p.length || f.field_length;
        const esc = cond.escape || '\\';
        let min = '', max = '';
        for (let i = 0; i < res.length && min.length < len; i++) {
          const c = res[i];
          if (c === esc && i + 1 < res.length) { i++; min += res[i]; max += res[i]; continue; }
          if (c === '_') { min += '\0'; max += '\xff'; continue; }
          if (c === '%') { max += '\xff'.repeat(len - max.length); return mk([iv({ min, max })]); }
          min += c; max += c;
        }
        min = min.replace(/\0+$/, (m) => ' '.repeat(m.length));
        return mk([iv({ min, max })]);
      }
      if (!value) {
        // IS NULL / IS NOT NULL
        if (this.t.maybe_null) return null;
        if (!maybe_null) return type === 'ISNULL' ? IMPOSSIBLE : null;
        if (type === 'ISNULL') return mk([iv({ min: null, max: null })]);
        return mk([iv({ min: null, minNear: true, noMax: true })]);
      }
      if (!f.optimize_range() && type !== 'EQ' && type !== 'EQUAL') return null;
      if (f.result_type() === STRING_RESULT && value.result_type() !== STRING_RESULT && f.cmp_type() !== value.result_type()) return null;
      // the value as the column stores it
      const probe = new TableInst(this.share, this.t.alias);
      const pf = probe.fields[field.idx];
      const saveNe = THD.no_errors, saveCount = THD.count_cuted_fields;
      THD.no_errors = true;
      THD.count_cuted_fields = false;
      let err;
      try { pf.set_notnull(); err = value.save_in_field(pf); } finally { THD.no_errors = saveNe; THD.count_cuted_fields = saveCount; }
      if (err) {
        if (type === 'EQUAL') return mk([iv({ min: null, max: null })]);
        return IMPOSSIBLE;
      }
      const v = probe.record[field.idx];
      switch (type) {
        case 'EQ': case 'EQUAL': return mk([iv({ min: v, max: v })]);
        case 'LT': case 'LE': {
          const r = iv({ max: v, maxNear: type === 'LT' && fieldIsEqualToItem(pf, value) });
          if (!maybe_null) r.noMin = true; else { r.min = null; r.minNear = true; }
          return mk([r]);
        }
        case 'GT': case 'GE':
          return mk([iv({ min: v, minNear: type === 'GT' && fieldIsEqualToItem(pf, value), noMax: true })]);
      }
      return null;
    }
  }
  // field_is_equal_to_item(): did storing the value keep it exact?
  function fieldIsEqualToItem(field, item) {
    const rt = item_cmp_type(field.result_type(), item.result_type());
    if (rt === STRING_RESULT) {
      const r = item.val_str();
      if (item.null_value) return true;
      return stringcmp(field.val_str(), r) === 0;
    }
    if (rt === INT_RESULT) return true;
    const d = item.val();
    if (item.null_value) return true;
    return d === field.val_real();
  }

  // mi_records_in_range() on one index page: the index is the rows in key
  // order (NULLs first); a search finds the first entry not before the key
  // (SEARCH_FIND, SEARCH_SMALLER) or after it (SEARCH_BIGGER); its position
  // is (entries before + 1) / (entries + 1), or (entries + 0.5) / (entries + 1)
  // past the end
  function recordsInRange(share, nr, index, min, minAfter, max, maxBefore) {
    const k = share.keys[nr];
    const n = index.length, records = share.rows;
    const prefixCmp = (rec, key) => {
      for (let i = 0; i < key.length; i++) {
        const p = k.parts[i];
        const c = partCmp(share.fields[p.field], p.length || 0, rec[p.field], key[i]);
        if (c) return c;
      }
      return 0;
    };
    const pos = (key, after) => {
      if (!n) return Math.floor(0.5 * records + 0.5);
      let i = 0;
      while (i < n && (after ? prefixCmp(index[i].rec, key) <= 0 : prefixCmp(index[i].rec, key) < 0)) i++;
      const offset = i < n ? 1.0 : 0.5;
      return Math.floor((i + offset) / (n + 1) * records + 0.5);
    };
    const start = min ? pos(min, minAfter) : 0;
    const end = max ? pos(max, !maxBefore) : records + 1;
    return end < start ? 0 : end === start ? 1 : end - start;
  }
  // check_quick_keys(): the estimated rows of a key's intervals
  function checkQuickKeys(share, nr, index, tree, minKey, minFlag, maxKey, maxFlag, st) {
    const k = share.keys[nr];
    let records = 0;
    for (const x of tree.ivs) {
      st.max_key_part = Math.max(st.max_key_part, tree.part);
      // SEL_ARG::store(): the ends go into the key unless an earlier part ended it
      const tmpMin = minKey.slice(), tmpMax = maxKey.slice();
      if (!x.noMin && !(minFlag & (NO_MIN_RANGE | NEAR_MIN))) tmpMin.push(x.min);
      if (!x.noMax && !(maxFlag & (NO_MAX_RANGE | NEAR_MAX))) tmpMax.push(x.max);
      const xMinFlag = (x.noMin ? NO_MIN_RANGE : 0) | (x.minNear ? NEAR_MIN : 0);
      const xMaxFlag = (x.noMax ? NO_MAX_RANGE : 0) | (x.maxNear ? NEAR_MAX : 0);
      let tmp, tmpMinFlag, tmpMaxFlag;
      if (x.next && x.next !== IMPOSSIBLE && x.next.part === tree.part + 1) {
        const point = tmpMin.length === tmpMax.length && tmpMin.every((v, i) => partCmp(share.fields[k.parts[i].field], k.parts[i].length || 0, v, tmpMax[i]) === 0);
        if (point && !xMinFlag && !xMaxFlag) {
          records += checkQuickKeys(share, nr, index, x.next, tmpMin, minFlag | xMinFlag, tmpMax, maxFlag | xMaxFlag, st);
          continue;
        }
        tmpMinFlag = xMinFlag; tmpMaxFlag = xMaxFlag;
        if (!tmpMinFlag) tmpMinFlag = storeEnd(x.next, tmpMin, true);
        if (!tmpMaxFlag) tmpMaxFlag = storeEnd(x.next, tmpMax, false);
      } else {
        tmpMinFlag = minFlag | xMinFlag;
        tmpMaxFlag = maxFlag | xMaxFlag;
      }
      if (!tmpMinFlag && !tmpMaxFlag && tree.part + 1 === k.parts.length && (k.flags & HA_NOSAME) && tmpMin.length === tmpMax.length &&
        tmpMin.every((v, i) => partCmp(share.fields[k.parts[i].field], k.parts[i].length || 0, v, tmpMax[i]) === 0)) tmp = 1;
      else tmp = recordsInRange(share, nr, index, tmpMin.length ? tmpMin : null, !!(tmpMinFlag & NEAR_MIN), tmpMax.length ? tmpMax : null, !!(tmpMaxFlag & NEAR_MAX));
      records += tmp;
    }
    return records;
  }
  const NEAR_MIN = 1, NEAR_MAX = 2, NO_MIN_RANGE = 4, NO_MAX_RANGE = 8;
  // store_min_key()/store_max_key(): extend the key with the first (last)
  // interval of the following parts
  function storeEnd(tree, key, isMin) {
    let t = tree;
    for (;;) {
      const x = isMin ? t.ivs[0] : t.ivs[t.ivs.length - 1];
      if (isMin ? x.noMin : x.noMax) return isMin ? NO_MIN_RANGE : NO_MAX_RANGE;
      key.push(isMin ? x.min : x.max);
      const flag = isMin ? (x.minNear ? NEAR_MIN : 0) : (x.maxNear ? NEAR_MAX : 0);
      if (flag) return flag;
      if (!x.next || x.next === IMPOSSIBLE || x.next.part !== t.part + 1) return 0;
      t = x.next;
    }
  }
  // is the row's key inside the tree's intervals?
  function inTree(share, tree, rec) {
    const v = rec[tree.f.idx];
    for (const x of tree.ivs) {
      const lo = x.noMin || partCmp(tree.f, tree.len, v, x.min) > 0 || (partCmp(tree.f, tree.len, v, x.min) === 0 && !x.minNear);
      const hi = x.noMax || partCmp(tree.f, tree.len, v, x.max) < 0 || (partCmp(tree.f, tree.len, v, x.max) === 0 && !x.maxNear);
      if (lo && hi && (!x.next || inTree(share, x.next, rec))) return true;
    }
    return false;
  }

  // SQL_SELECT::test_quick_select() for table s with the keys keys_to_use:
  // { quick: { key, rows, records, read_time } | null, impossible, records }
  function testQuickSelect(s, cond, keys_to_use, prev_tables, limit, read_tables = prev_tables) {
    const share = s.share;
    const res = { quick: null, impossible: false, records: share.rows, quick_rows: {}, quick_key_parts: {}, needed_reg: 0 };
    if (!cond || !limit || !keys_to_use) return res;
    let records = share.rows || 1;
    const scan_time = records / TIME_FOR_COMPARE + 1;
    let read_time = share.scan_time() + scan_time + 1;
    if (limit < records) read_time = records + scan_time + 1;
    else if (read_time <= 2.0) return res;
    const keys = [];
    share.keys.forEach((k, nr) => { if ((keys_to_use & (1 << nr)) && !(k.flags & HA_FULLTEXT)) keys.push(nr); });
    const tree = new RangeParam(s, keys, prev_tables, read_tables).tree(cond);
    let best = null;
    if (tree === IMPOSSIBLE) { records = 0; read_time = Infinity; }
    else if (tree && tree.keys) {
      for (const nr of keys) {
        const k = tree.keys.get(nr);
        if (!k) continue;
        if (k === MAYBE || k.maybe) res.needed_reg |= 1 << nr;
        if (k === MAYBE) continue;
        let found;
        if (k === IMPOSSIBLE) found = 0;
        else if (k.part !== 0) continue;
        else {
          const index = indexOrder(share, s.t, nr);
          const st = { max_key_part: 0 };
          found = checkQuickKeys(share, nr, index, k, [], 0, [], 0, st);
          res.quick_rows[nr] = found;
          res.quick_key_parts[nr] = st.max_key_part + 1;
        }
        let frt;
        if (found > 2 && (s.used_keys & (1 << nr))) {
          const kpb = Math.floor(1024 / 2 / (share.keys[nr].key_length + 4)) + 1;
          frt = (found + kpb - 1) / kpb;
        } else frt = found + found / TIME_FOR_COMPARE;
        if (read_time > frt) { read_time = frt; records = found; best = { nr, k }; }
      }
      if (best && records) {
        // get_quick_select(): the rows of the ranges, in key order
        const rows = indexOrder(share, s.t, best.nr).filter((r) => best.k !== IMPOSSIBLE && inTree(share, best.k, r.rec));
        res.quick = { key: best.nr, rows, records, read_time, max_used_key_length: usedKeyLength(share, best.nr, res.quick_key_parts[best.nr]) };
      }
    }
    res.records = records;
    res.impossible = !records;
    return res;
  }
  function usedKeyLength(share, nr, parts) {
    const k = share.keys[nr];
    let len = 0;
    for (let i = 0; i < parts && i < k.parts.length; i++) {
      const p = k.parts[i], f = share.fields[p.field];
      len += (p.length || f.pack_length()) + (f.nullable ? 1 : 0) + (f.type() === T.BLOB ? 2 : 0);
    }
    return len;
  }

  // ---------------------------------------------------------------------------
  // SELECT (sql/sql_select.cc mysql_select())
  // ---------------------------------------------------------------------------
  // find_field_in_tables() (sql/sql_base.cc)
  function find_field_in_tables(ctx, item) {
    const db = item.db_name, table_name = item.table_name, name = item.field_name;
    const tables = ctx.tables;
    let found = null;
    if (table_name) {
      let found_table = false;
      for (const t of tables) {
        if (t.alias === table_name && (!db || t.db === db)) {
          found_table = true;
          const f = t.field(name);
          if (f) {
            if (db || !ctx.where) return f;
            if (found) throw myError(ER.NON_UNIQ, item.full_name(), ctx.where);
            found = f;
          }
        }
      }
      if (found) return found;
      if (!found_table) throw myError(ER.UNKNOWN_TABLE, db ? db + '.' + table_name : table_name, ctx.where);
      throw myError(ER.BAD_FIELD, item.full_name(), ctx.where);
    }
    for (const t of tables) {
      const f = t.field(name) || (tables.length === 1 && strcaseeq(name, '_rowid') && t.share.primary_key >= 0 &&
        t.share.keys[t.share.primary_key].parts.length === 1 ? t.fields[t.share.keys[t.share.primary_key].parts[0].field] : null);
      if (f) {
        if (found) {
          if (!ctx.where) break;
          throw myError(ER.NON_UNIQ, name, ctx.where);
        }
        found = f;
      }
    }
    if (found) return found;
    throw myError(ER.BAD_FIELD, item.full_name(), ctx.where);
  }
  // find_item_in_list(): HAVING references and ORDER BY/GROUP BY names
  function find_item_in_list(ctx, find, items, quiet) {
    let found = null;
    const isIdent = find.type() === 'FIELD_ITEM' || find.type() === 'REF_ITEM';
    const field_name = isIdent ? find.field_name : null, table_name = isIdent ? find.table_name : null;
    for (const item of items) {
      if (field_name && item.type() === 'FIELD_ITEM') {
        if (strcaseeq(item.name, field_name)) {
          if (!table_name) {
            if (found) {
              if (found.eq(item)) continue;
              if (!quiet) throw myError(ER.NON_UNIQ, find.full_name(), ctx.where);
              return null;
            }
            found = item;
          } else if (item.table_name === table_name) { found = item; break; }
        }
      } else if (!table_name && (item.eq(find) || (find.name !== null && item.name !== null && strcaseeq(item.name, find.name)))) {
        found = item;
        break;
      }
    }
    if (!found && !quiet) throw myError(ER.BAD_FIELD, find.full_name(), ctx.where);
    return found;
  }

  // A value computed for the result: what an Item sends, stored the way
  // MySQL's temporary table field would store it when one is used
  class Item_cell extends Item {
    constructor(src, rt, value, isNull, field) {
      super();
      this.src = src; this.rt = rt; this.value = value; this.null_value = isNull; this.field = field;
      this.name = src.name; this.max_length = src.max_length; this.decimals = src.decimals; this.binary = src.binary;
      this.maybe_null = src.maybe_null;
    }
    type() { return 'CELL_ITEM'; }
    result_type() { return this.rt; }
    val_str() { if (this.null_value) return null; if (this.field) return this.field.val_str(); return this.rt === STRING_RESULT ? this.value : this.rt === INT_RESULT ? this.value.toString() : setDouble(this.value, this.decimals); }
    val() { if (this.null_value) return 0; if (this.field) return this.field.val_real(); return this.rt === STRING_RESULT ? atof(this.value) : Number(this.value); }
    val_int() { if (this.null_value) return 0n; if (this.field) return this.field.val_int(); return this.rt === STRING_RESULT ? strtoll(this.value).v : this.rt === INT_RESULT ? this.value : dbl2ll(this.value); }
    get_date(t, fuzzy) { if (this.null_value) return true; if (this.field) return this.field.get_date(t, fuzzy); return super.get_date(t, fuzzy); }
    save_in_field(to) {
      if (this.null_value) return set_field_to_null(to);
      if (this.field) { to.set_notnull(); field_conv(to, this.field); return false; }
      to.set_notnull();
      if (this.rt === STRING_RESULT || (this.rt === REAL_RESULT && to.result_type() === STRING_RESULT)) to.store_str(this.val_str());
      else if (this.rt === REAL_RESULT) to.store_real(this.value);
      else to.store_int(this.value);
      return false;
    }
  }
  // snapshot of an item's value for the current row
  function cellOf(item, tmpField) {
    if (tmpField) {
      const t = tmpField.table;
      t.record[tmpField.idx] = tmpField.zero();
      item.save_in_field(tmpField);
      const f = tmpField.clone(t);
      const rec = [t.record[tmpField.idx]];
      f.table = { record: rec, null_row: false, alias: t.alias, pack_record: false };
      f.idx = 0;
      const isNull = rec[0] === null;
      return new Item_cell(item, tmpField.result_type(), null, isNull, f);
    }
    if (item.type() === 'FIELD_ITEM') {
      const src = item.field;
      if (src.is_null()) return new Item_cell(item, src.result_type(), null, true, null);
      const f = src.clone(src.table);
      const rec = [src.v];
      f.table = { record: rec, null_row: false, alias: src.table.alias, pack_record: src.table.pack_record, maybe_null: src.table.maybe_null, share: src.table.share };
      f.idx = 0;
      return new Item_cell(item, src.result_type(), null, false, f);
    }
    const rt = item.result_type();
    const v = rt === STRING_RESULT ? item.val_str() : rt === INT_RESULT ? item.val_int() : item.val();
    return new Item_cell(item, rt, v, !!item.null_value, null);
  }

  // create_tmp_field() for the result of an item (temporary tables)
  function tmpFieldFor(item, tmpTable, group) {
    const maybe_null = !!item.maybe_null;
    const flags = maybe_null ? 0 : F.NOT_NULL;
    let f;
    if (item.type() === 'SUM_FUNC_ITEM') {
      const fn = item.func_name();
      if (fn === 'avg' || fn === 'std') f = make_field({ name: item.name, type: T.DOUBLE, length: item.max_length, flags, dec: item.decimals });
      else f = tmpFieldByType(item, flags);
      f.sumResult = fn;
    } else if (item.type() === 'FIELD_ITEM') {
      const org = item.field;
      f = org.clone(null);
      f.flags &= (F.NOT_NULL | F.BLOB | F.UNSIGNED | F.ZEROFILL | F.BINARY | F.ENUM | F.SET);
      if (org.maybe_null()) { f.flags &= ~F.NOT_NULL; f.nullable = true; }
      f.orgTable = org.table;
    } else f = tmpFieldByType(item, flags);
    f.table = tmpTable;
    f.idx = tmpTable.nfields++;
    return f;
  }
  function tmpFieldByType(item, flags) {
    const rt = item.result_type();
    if (rt === REAL_RESULT) return make_field({ name: item.name, type: T.DOUBLE, length: item.max_length, flags, dec: item.decimals });
    if (rt === INT_RESULT) return make_field({ name: item.name, type: T.LONGLONG, length: item.max_length, flags });
    if (item.max_length > 255) return make_field({ name: item.name, type: T.MEDIUM_BLOB, length: item.max_length, flags: flags | (item.binary ? F.BINARY : 0) });
    return make_field({ name: item.name, type: T.STRING, length: item.max_length, flags: flags | (item.binary ? F.BINARY : 0) });
  }
  function newTmpTable(conn) {
    const name = '#sql' + conn.srv.pid.toString(16) + '_' + conn.threadId.toString(16) + '_' + (conn.tmp_table++).toString(16);
    return { alias: name, record: [], null_row: false, pack_record: false, maybe_null: false, nfields: 0 };
  }

  // open the tables of a statement (open_tables): [{ db, name, alias }];
  // under LOCK TABLES only the locked tables can be used
  function openTables(conn, refs, write) {
    for (let i = 0; i < refs.length; i++) {
      const r = refs[i];
      r.db = r.db || conn.db;
      if (!r.db) throw myError(ER.NO_DB);
      for (let j = 0; j < i; j++) if (refs[j].alias === r.alias && refs[j].db === r.db) throw myError(ER.NONUNIQ_TABLE, r.alias);
    }
    return refs.map((r, i) => {
      const share = conn.getTable(r.db, r.name);
      if (conn.locks && !(share && share.tmp_table)) {
        const l = conn.locks.find((x) => x.db === r.db && x.alias === r.alias);
        if (!l) throw myError(ER.TABLE_NOT_LOCKED, r.alias);
        if (write && l.mode !== 'write') throw myError(ER.TABLE_NOT_LOCKED_FOR_WRITE, r.alias);
      }
      if (!share) throw myError(ER.NO_SUCH_TABLE, r.db, r.name);
      const t = new TableInst(share, r.alias);
      t.db = r.db;
      t.ref = r;
      t.maybe_null = !!r.outer;      // setup_tables(): outer join tables can be NULL
      t.map = 1 << i;
      t.tablenr = i;
      return t;
    });
  }

  class Select {
    constructor(conn, sel) { this.conn = conn; this.sel = sel; }
    // setup_tables/setup_fields/setup_conds/setup_order/setup_group
    prepare() {
      const sel = this.sel, conn = this.conn;
      this.tables = sel.tables.length ? openTables(conn, sel.tables) : [];
      const ctx = this.ctx = { tables: this.tables, where: 'field list', allow_sum_func: true, items: null, conn };
      // expand * and table.*
      const items = [];
      for (const it of sel.items) {
        if (it.type() === 'FIELD_ITEM' && it.field_name === '*') {
          if (!this.tables.length) throw myError(1096);
          let any = false;
          for (const t of this.tables) {
            if (it.table_name && (t.alias !== it.table_name || (it.db_name && t.db !== it.db_name))) continue;
            any = true;
            for (const f of t.fields) { const fi = new Item_field(null, null, f.field_name); fi.set_field(f); items.push(fi); }
          }
          if (!any) throw myError(ER.BAD_TABLE, it.table_name);
          continue;
        }
        it.fix_fields(ctx);
        items.push(it);
      }
      this.items = items;
      ctx.items = items;
      this.all = items.slice();       // all_fields: hidden order/group items get prepended
      // WHERE and ON
      ctx.where = 'where clause';
      ctx.allow_sum_func = false;
      if (sel.where) sel.where.fix_fields(ctx);
      for (const t of this.tables) if (t.ref.on) { t.ref.on.fix_fields(ctx); }
      for (const t of this.tables) if (t.ref.natural) t.ref.on = this.naturalCond(t);
      ctx.allow_sum_func = true;
      // ORDER BY, GROUP BY
      ctx.where = 'order clause';
      this.order = sel.order.map((o) => ({ item: this.findOrder(o.item), asc: o.asc }));
      ctx.where = 'group statement';
      this.hidden_group_fields = false;
      const before = this.all.length;
      this.group = sel.group.map((o) => {
        const it = this.findOrder(o.item);
        if (it.with_sum_func) throw myError(ER.WRONG_GROUP_FIELD, it.full_name());
        return { item: it, asc: o.asc };
      });
      if (this.all.length !== before) this.hidden_group_fields = true;
      if (sel.having) {
        ctx.where = 'having clause';
        ctx.allow_sum_func = true;
        sel.having.fix_fields(ctx);
      }
      this.having = sel.having;
      // group functions mixed with columns and no GROUP BY
      if (!this.group.length) {
        let flag = 0;
        for (const it of items) {
          if (it.with_sum_func) flag |= 1;
          else if (!(flag & 2) && !it.const_item()) flag |= 2;
        }
        if (flag === 3) throw myError(ER.MIX_OF_GROUP_FUNC_AND_FIELDS);
      }
      // all sum functions of the query
      this.sums = [];
      const addSums = (it) => it.walk((x) => { if (x.type() === 'SUM_FUNC_ITEM' && !this.sums.includes(x)) this.sums.push(x); });
      this.all.forEach(addSums);
      this.order.forEach((o) => addSums(o.item));
      if (this.having) addSums(this.having);
    }
    naturalCond(t) {
      const other = this.tables.find((x) => x.ref === t.ref.natural);
      let cond = null;
      for (const f of t.fields) {
        const g = other.field(f.field_name);
        if (!g) continue;
        const a = new Item_field(null, null, f.field_name); a.set_field(g);
        const b = new Item_field(null, null, f.field_name); b.set_field(f);
        const eq = new Item_func_eq(a, b);
        eq.fix_fields(this.ctx);
        cond = cond ? new Item_cond_and(cond, eq) : eq;
      }
      if (cond && cond.type() === 'COND_ITEM') cond.fix_fields(this.ctx);
      return cond;
    }
    // find_order_in_list()
    findOrder(item) {
      if (item.type() === 'INT_ITEM') {
        const n = Number(item.value);
        if (n < 1 || n > this.items.length) throw myError(ER.BAD_FIELD, item.full_name(), this.ctx.where);
        return this.items[n - 1];
      }
      const where = this.ctx.where;
      const found = find_item_in_list(this.ctx, item, this.items, true);
      if (found) return found;
      this.ctx.where = where;
      item.fix_fields(this.ctx);
      this.all.unshift(item);
      return item;
    }

    // ---------------------------------------------------------------- run
    run() {
      const conn = this.conn, sel = this.sel;
      const tables = this.tables;
      const limit = sel.limit === null ? Infinity : sel.limit, offset = sel.offset || 0;
      THD.select_limit = limit === Infinity ? Infinity : limit + offset;
      let distinct = !!sel.options.distinct;
      let group = this.group.slice(), order = this.order.slice();
      const hasSum = this.sums.length > 0;
      // conditions: constant ones are decided now (optimize_cond)
      const conds = splitAnd(sel.where);
      let impossible = false;
      for (const c of conds) if (c.const_item() && !(c.used_tables() & RAND_TABLE_BIT)) { if (!c.val_int()) impossible = true; }
      const describe = !!sel.describe;
      if (impossible || limit === 0) return describe ? describeInfo('Impossible WHERE') : this.zeroRows(hasSum && !group.length);
      // opt_sum_query(): COUNT(*), MIN() and MAX() from table sizes and indexes
      if (tables.length && hasSum && !sel.group.length) {
        const r = this.optSumQuery(conds.filter((c) => !(c.const_item() && !(c.used_tables() & RAND_TABLE_BIT))));
        if (r < 0) return describe ? describeInfo('No matching min/max row') : this.zeroRows(true);
        if (r > 0) {
          if (describe) return describeInfo('Select tables optimized away');
          const row = this.items.map((it) => cellOf(it, null));
          if (this.having && !this.having.val_int()) return { fields: this.fieldsOf(null), rows: [] };
          return { fields: this.fieldsOf(null), rows: [row] };
        }
      }
      if (!tables.length) {
        if (describe) return describeInfo('No tables used');
        const row = this.items.map((it) => cellOf(it, null));
        if (this.having && !this.having.val_int()) return { fields: this.fieldsOf(null), rows: [] };
        return { fields: this.fieldsOf(null), rows: [row] };
      }
      const plan = this.plan = planJoin(this, conds);
      if (plan.impossible) return describe ? describeInfo('Impossible WHERE noticed after reading const tables') : this.zeroRows(hasSum && !group.length);
      const nonConst = plan.order;
      // remove_const() for ORDER BY and GROUP BY
      const constMap = plan.constMap;
      const first = nonConst.length ? nonConst[0] : null;
      const removeConst = (list) => {
        let simple = first ? !first.ref.on : true;
        const out = [];
        for (const o of list) {
          const ut = o.item.used_tables();
          if (o.item.with_sum_func) simple = false;
          else if (!(ut & ~constMap)) continue;
          else if (ut & RAND_TABLE_BIT) simple = false;
          else {
            if (constExpressionInWhere(sel.where, o.item)) continue;
            const ref = ut & ~constMap & ~(first ? first.map : 0);
            if (ref) {
              if (onlyEqRefTables(plan, list, ref)) continue;
              simple = false;
            }
          }
          out.push(o);
        }
        if (!out.length) simple = true;
        return { list: out, simple };
      };
      let r = removeConst(order);
      order = r.list;
      let simple_order = r.simple;
      let no_order = false;
      if (group.length || hasSum) { if (!this.hidden_group_fields) distinct = false; }
      else if (distinct && nonConst.length === 1 && (order.length || limit === Infinity)) {
        group = this.items.filter((it) => !it.const_item()).map((it) => ({ item: it, asc: true }));
        distinct = false;
        no_order = !order.length;
        this.distinctGroup = true;
      }
      r = removeConst(group);
      const hadGroup = group.length > 0 || this.distinctGroup;
      group = r.list;
      let simple_group = r.simple;
      if (!group.length && hadGroup) { order = []; simple_order = true; }
      if (isSubpart(group, order) || (!group.length && hasSum)) order = [];
      if (plan.full_join) { if (group.length) simple_group = false; if (order.length) simple_order = false; }
      let need_tmp = nonConst.length > 0 && (distinct || !simple_order || !simple_group || (group.length > 0 && order.length > 0));
      if (((group.length && nonConst.length && (!simple_group || !skipSortOrder(plan, first, group))) || distinct)) {
        need_tmp = true; simple_order = simple_group = false;
      }
      const grouped = group.length > 0 || hadGroup || hasSum;
      if (describe) {
        // mysql_select() with SELECT_DESCRIBE: is a sort still needed?
        let ord = order, ordIsGroup = false;
        if (!ord.length && !no_order) { ord = group; ordIsGroup = true; }
        if (ord.length && (!nonConst.length || (simple_order &&
          skipSortOrder(plan, first, ord, group.length || limit === Infinity ? Infinity : limit + offset)))) ord = [];
        return this.describe(plan, need_tmp, ord.length > 0 && (!need_tmp || !ordIsGroup || simple_group), distinct);
      }
      // create_sort_index() without a temporary table: the first table is read
      // in the order (by an index, or filesort), and the select list is
      // evaluated for each row sent (end_send), up to the LIMIT
      const lateEval = !need_tmp && !grouped && !distinct;
      if (lateEval && order.length && first) {
        const s = plan.tabs.find((x) => x.t === first);
        const select_limit = this.having || nonConst.length > 1 || limit === Infinity ? Infinity : limit + offset;
        if (!skipSortOrder(plan, first, order, select_limit)) s.sortedRows = this.filesortFirst(plan, s, order);
        order = [];
      }
      // metadata mode
      this.tmpMode = null;
      if (need_tmp) this.tmpMode = group.length || (hadGroup && this.distinctGroup) ? 'group' : 'refs';
      if (need_tmp && !group.length && hasSum && !hadGroup) this.tmpMode = null;
      if (this.tmpMode) this.makeTmpFields(this.tmpMode === 'group');

      // join, then group, having, distinct, order, limit
      const combos = executeJoin(this, plan);
      if (lateEval) {
        const rows = [];
        let skip = offset;
        for (const c of combos) {
          if (rows.length >= limit) break;
          this.setRow(c);
          if (this.having && !this.having.val_int()) continue;
          if (skip) { skip--; continue; }
          rows.push(this.makeRow().cells);
        }
        return { fields: this.fieldsOf(null), rows };
      }
      let outRows;
      if (grouped) outRows = this.doGroup(combos, group, no_order || this.distinctGroup && !this.order.length ? null : group, hasSum);
      else outRows = combos.map((c) => { this.setRow(c); return this.having && !this.having.val_int() ? null : this.makeRow(); }).filter(Boolean);
      if (grouped && !no_order && !order.length && group.length) order = group;
      if (distinct) outRows = this.removeDuplicates(outRows);
      if (order.length) outRows = this.sortRows(outRows, order);
      if (offset || limit !== Infinity) outRows = outRows.slice(offset, limit === Infinity ? undefined : offset + limit);
      return { fields: this.fieldsOf(this.tmpMode), rows: outRows.map((r) => r.cells) };
    }
    // opt_sum_query(): 1 when every column is a constant now, -1 when an
    // index says there is no row, 0 when the tables must be read
    optSumQuery(conds) {
      // (each COUNT/MIN/MAX it can do becomes a constant as it goes, and stays
      // one even when the query still has to read the tables)
      let const_result = 1, removed = 0;
      const cond = conds.length ? conds.reduce((x, y) => new Item_cond_and(x, y)) : null;
      for (const item of this.all) {
        if (item.type() === 'SUM_FUNC_ITEM') {
          const fn = item.func_name();
          if (fn === 'count') {
            if (!cond && !item.args[0].maybe_null && !this.tables.some((t) => t.ref.on || t.ref.natural)) {
              item.count = this.tables.reduce((n, t) => n * t.share.rows, 1);
              item.constSum = true;
            } else const_result = 0;
          } else if (fn === 'min' || fn === 'max') {
            const expr = item.args[0];
            if (expr.type() === 'FIELD_ITEM') {
              const r = findRangeKey(expr.field, cond);
              if (!r) { const_result = 0; continue; }
              const t = expr.field.table;
              // the first (MIN) or last (MAX) key: NULLs come first in a MyISAM index
              const rows = sortByKey(t.share, t, r.key, [...t.share.scan()].filter((x) => r.match(x.rec)));
              if (!rows.length) return -1;
              const row = fn === 'min' ? rows[0] : rows[rows.length - 1];
              removed |= t.map;
              t.record = row.rec; t.null_row = false;
            } else if (!expr.const_item()) { const_result = 0; continue; }
            item.reset();
            item.constSum = true;
          } else const_result = 0;
        } else if (const_result && !item.const_item()) const_result = 0;
      }
      if (cond && (cond.used_tables() & ~removed)) const_result = 0;
      return const_result;
    }
    // select_describe(): the plan, one row per table
    describe(plan, need_tmp, need_order, distinct) {
      const fields = [strCol('table', NAME_LEN), strCol('type', 10), strCol('possible_keys', NAME_LEN * MAX_KEY, true),
        strCol('key', NAME_LEN, true), intCol('key_len', 3, true), strCol('ref', NAME_LEN * 16, true),
        { table: '', name: 'rows', length: 10, type: T.DOUBLE, flags: F.NOT_NULL, decimals: 0 }, strCol('Extra', 255)];
      const where = this.sel.where;
      const selUsed = this.items.reduce((m, it) => m | it.used_tables(), 0) & ~RAND_TABLE_BIT;
      const rows = [];
      let used_tables = 0;
      let avail = plan.constMap | RAND_TABLE_BIT;
      const keyNames = (s, bits) => s.share.keys.filter((k, nr) => bits & (1 << nr)).map((k) => k.name).join(',') || null;
      const storeLength = (s, key, part) => {
        const k = s.share.keys[key], p = k.parts[part], f = s.share.fields[p.field];
        return (p.length || f.pack_length()) + (f.nullable ? 1 : 0) + (f.type() === T.BLOB ? 2 : 0);
      };
      const entries = [...plan.constTabs.map((s) => ({ s, records: s.records_read === 0 ? 0 : 1, isConst: true })),
        ...plan.positions.map((p) => ({ s: p.s, records: p.records }))];
      entries.forEach(({ s, records, isConst }, i) => {
        let type = s.type;
        if (type === 'all') type = s.quick ? 'range' : s.index !== undefined && s.index >= 0 ? 'index' : 'ALL';
        const refKey = s.type === 'const' && s.constKey ? s.constKey.key : s.type === 'eq_ref' || s.type === 'ref' ? s.refKey : -1;
        const refUses = s.type === 'const' && s.constKey ? s.constKey.uses : s.refUses;
        let key = null, key_len = null, ref = null, key_read = false;
        if (refKey >= 0) {
          let parts = 0, len = 0;
          const names = [];
          while (true) {
            const u = refUses.find((x) => x.keypart === parts);
            if (!u) break;
            len += storeLength(s, refKey, parts);
            names.push(!(u.used_tables & ~plan.constMap) ? 'const' : u.val.type() === 'FIELD_ITEM' ? u.val.full_name() : 'func');
            parts++;
          }
          key = s.share.keys[refKey].name; key_len = String(len); ref = names.join(',');
          key_read = !isConst && !!(s.used_keys & (1 << refKey));
        } else if (type === 'index') {
          key = s.share.keys[s.index].name; key_len = String(s.share.keys[s.index].key_length);
          key_read = !!(s.used_keys & (1 << s.index));
        } else if (type === 'range') {
          key = s.share.keys[s.quick.key].name; key_len = String(s.quick.max_used_key_length);
          key_read = !!(s.used_keys & (1 << s.quick.key));
        }
        if (!isConst) avail |= s.t.map;
        const extra = [];
        if (s.info) extra.push(s.info);
        else if (s.use_quick === 2) extra.push('range checked for each record (index map: ' + s.keys + ')');
        else if (!isConst && (condForTable(where, avail, s.t.map, plan) || s.quick)) extra.push('where used');
        if (key_read) extra.push('Using index');
        if (s.not_exists_optimize && s.on) extra.push('Not exists');
        if (need_tmp) { need_tmp = false; extra.push('Using temporary'); }
        if (need_order) { need_order = false; extra.push('Using filesort'); }
        if (distinct && (used_tables & selUsed) === selUsed) extra.push('Distinct');
        rows.push([s.t.alias, type, keyNames(s, s.keys), key, key_len, ref, fmtF(records, 0), extra.join('; ')]);
        used_tables |= s.t.map;
      });
      return { fields, rows };
    }
    // filesort() of the first table: its rows by the sort keys, then by position
    filesortFirst(plan, s, order) {
      let rows;
      setRowIn(this.tables, plan.constCombo);
      if (s.type === 'eq_ref' || s.type === 'ref') rows = lookupKey(s, s.refKey, s.refUses, false);
      else if (s.quick) rows = s.quick.rows;
      else rows = [...s.share.scan()];
      const keyed = rows.map((r) => {
        const n = plan.constCombo.slice();
        n[s.t.tablenr] = r;
        setRowIn(this.tables, n);
        return { r, keys: order.map((o) => cellOf(o.item, null)) };
      });
      keyed.sort((a, b) => {
        for (let k = 0; k < order.length; k++) {
          const c = sortCompare(a.keys[k], b.keys[k], order[k].asc);
          if (c) return c;
        }
        return a.r.pos - b.r.pos;
      });
      return keyed.map((x) => x.r);
    }
    // return_zero_rows(): no rows, or one row of the group functions
    zeroRows(sendRow) {
      const rows = [];
      if (sendRow) {
        for (const t of this.tables) t.null_row = true;
        // (the sum functions are as fix_fields() left them: COUNT 0, others NULL)
        if (!this.having || this.having.val_int()) rows.push(this.items.map((it) => cellOf(it, null)));
        for (const t of this.tables) t.null_row = false;
      }
      return { fields: this.fieldsOf(null), rows };
    }
    setRow(combo) {
      setRowIn(this.tables, combo);
    }
    makeTmpFields(group) {
      const tmp = this.tmpTable = newTmpTable(this.conn);
      this.tmpFields = new Map();
      for (const it of this.all) {
        if (this.tmpFields.has(it)) continue;
        if (it.with_sum_func && it.type() !== 'SUM_FUNC_ITEM') continue;
        if (it.const_item() && it.type() !== 'SUM_FUNC_ITEM') continue;
        if (it.type() === 'SUM_FUNC_ITEM' && !group) continue;
        this.tmpFields.set(it, tmpFieldFor(it, tmp, group));
      }
      this.tmpGroup = group;
    }
    makeRow() {
      const cells = this.items.map((it) => cellOf(it, this.tmpFields ? this.tmpFields.get(it) : null));
      const sortCells = this.order.map((o) => {
        const k = this.items.indexOf(o.item);
        if (k >= 0) return cells[k];
        return cellOf(o.item, this.tmpFields ? this.tmpFields.get(o.item) : null);
      });
      const groupCells = this.group.map((o) => {
        const k = this.items.indexOf(o.item);
        if (k >= 0) return cells[k];
        return cellOf(o.item, this.tmpFields ? this.tmpFields.get(o.item) : null);
      });
      return { cells, sortCells, groupCells, seq: this.seq = (this.seq || 0) + 1 };
    }
    doGroup(combos, group, sortGroup, hasSum) {
      // rows of each group in the order they come from the join
      const groups = [];
      if (!group.length) {
        if (combos.length || !hasSum) groups.push({ rows: combos });
        else return this.zeroRows(true).rows.map((cells) => ({ cells, sortCells: [], groupCells: [], seq: 0 }));
      } else {
        const index = new Map();
        for (const c of combos) {
          this.setRow(c);
          const key = group.map((o) => groupKeyOf(o.item, this.tmpFields && this.tmpFields.get(o.item))).join('\x00\x01');
          let g = index.get(key);
          if (!g) { g = { rows: [] }; index.set(key, g); groups.push(g); }
          g.rows.push(c);
        }
      }
      const out = [];
      for (const g of groups) {
        const rows = g.rows;
        if (rows.length) this.setRow(rows[0]);
        // (constants from opt_sum_query() keep their value: make_sum_func_list())
        const sums = this.sums.filter((s) => !s.constSum);
        for (const s of sums) s.reset();
        for (let i = 1; i < rows.length; i++) { this.setRow(rows[i]); for (const s of sums) s.add(); }
        if (rows.length) this.setRow(rows[0]);
        if (this.having && !this.having.val_int()) continue;
        out.push(this.makeRow());
      }
      return out;
    }
    removeDuplicates(rows) {
      const seen = new Set(), out = [];
      for (const r of rows) {
        const key = r.cells.map((c, i) => cellKey(c, this.items[i])).join('\x00\x01');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(r);
      }
      return out;
    }
    // filesort(): keys, then the row position
    sortRows(rows, order) {
      const idx = order.map((o) => this.order.findIndex((x) => x.item === o.item));
      const gidx = order.map((o) => this.group.findIndex((x) => x.item === o.item));
      const keyOf = (r, k) => (idx[k] >= 0 ? r.sortCells[idx[k]] : r.groupCells[gidx[k]]);
      return rows.slice().sort((a, b) => {
        for (let k = 0; k < order.length; k++) {
          const c = sortCompare(keyOf(a, k), keyOf(b, k), order[k].asc);
          if (c) return c;
        }
        return a.seq - b.seq;
      });
    }
    fieldsOf(mode) {
      return this.items.map((it) => {
        let f;
        const tf = mode && this.tmpFields ? this.tmpFields.get(it) : null;
        if (tf && !(it.type() === 'SUM_FUNC_ITEM' && (tf.sumResult === 'avg' || tf.sumResult === 'std'))) {
          f = tf.make_field();
          if (it.type() === 'FIELD_ITEM') f.table = it.field.table.alias;
          f.name = it.name;
        } else if (tf && it.type() === 'SUM_FUNC_ITEM') {
          f = it.init_make_field(T.DOUBLE);
        } else f = it.make_field();
        return f;
      });
    }
  }
  // the value a GROUP BY groups on (the tmp table key)
  function groupKeyOf(item, tmpField) {
    const c = cellOf(item, tmpField);
    return cellKey(c, item);
  }
  function cellKey(c, item) {
    if (c.null_value) return '\x02N';
    const f = c.field;
    if (f) {
      if (f.result_type() === STRING_RESULT && !(f.real_type() === T.ENUM || f.real_type() === T.SET)) {
        let s = f.val_str();
        if (!(f.flags & F.BLOB)) s = s.replace(/ +$/, '');
        if (f.binary()) return 'S' + s;
        let o = 'S';
        for (let i = 0; i < s.length; i++) o += String.fromCharCode(SORT_ORDER[cc(s, i)]);
        return o;
      }
      return 'V' + f.val_str();
    }
    if (c.rt === STRING_RESULT) {
      const s = c.value.replace(/ +$/, '');
      if (item.binary) return 'S' + s;
      let o = 'S';
      for (let i = 0; i < s.length; i++) o += String.fromCharCode(SORT_ORDER[cc(s, i)]);
      return o;
    }
    return 'V' + String(c.value);
  }
  // make_sortkey() semantics: NULL first; for columns NULL sorts last when
  // descending, for expressions first either way
  function sortCompare(a, b, asc) {
    const isField = a.src.type() === 'FIELD_ITEM' || !!(a.field && a.field.orgTable) || !!(b.field && b.field.orgTable);
    const ind = (c) => (c.null_value ? (isField && !asc ? 2 : 0) : 1);
    const ia = ind(a), ib = ind(b);
    if (ia !== ib) return ia - ib;
    if (ia !== 1) return 0;
    let c;
    if (a.field) c = fieldSortCmp(a.field, b.field);
    else if (a.rt === STRING_RESULT) {
      const len = Math.min(a.src.max_length || 1024, 1024);
      let x = a.value.slice(0, len), y = b.value.slice(0, len);
      if (a.src.binary) c = stringcmp(x.padEnd(len, '\0'), y.padEnd(len, '\0'));
      else {
        x = x.padEnd(len, '\0'); y = y.padEnd(len, '\0');
        c = 0;
        for (let i = 0; i < len && !c; i++) c = SORT_ORDER[cc(x, i)] - SORT_ORDER[cc(y, i)];
      }
    } else c = a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
    return asc ? c : -c;
  }
  function fieldSortCmp(f, g) { return valCmp(f, f.v, g.v); }
  // compare two stored values of a field the way filesort and keys order them
  function valCmp(f, a, b) {
    if (f.result_type() === STRING_RESULT && !(f.real_type() === T.ENUM || f.real_type() === T.SET) && typeof a === 'string') {
      if (f.flags & F.BLOB) {
        const len = 1024;
        const x = a.slice(0, len).padEnd(len, '\0'), y = b.slice(0, len).padEnd(len, '\0');
        if (f.binary()) return stringcmp(x, y);
        for (let i = 0; i < len; i++) { const d = SORT_ORDER[cc(x, i)] - SORT_ORDER[cc(y, i)]; if (d) return d; }
        return 0;
      }
      return padcmp(a.slice(0, f.field_length), b.slice(0, f.field_length), f.binary());
    }
    return f.cmpv(a, b);
  }
  // describe_info(): EXPLAIN when no table is read
  const describeInfo = (info) => ({ fields: [strCol('Comment', 80)], rows: [[info]] });
  // make_cond_for_table(): the part of the WHERE that can be checked when
  // the tables are read and that uses used_table (without what the ref key
  // lookup already guarantees: test_if_ref())
  function condForTable(cond, tables, used_table, plan) {
    if (!cond) return null;
    if (used_table && !(cond.used_tables() & used_table)) return null;
    if (cond instanceof Item_cond_and) {
      const parts = cond.args.map((a) => condForTable(a, tables, used_table, plan)).filter(Boolean);
      return parts.length ? parts : null;
    }
    if (cond instanceof Item_cond_or) {
      for (const a of cond.args) if (!condForTable(a, tables, 0, plan)) return null;
      return cond;
    }
    if (cond.used_tables() & ~tables) return null;
    if (cond instanceof Item_func_eq) {
      const [l, r] = cond.args;
      if (l.type() === 'FIELD_ITEM' && testIfRef(plan, l.field, r)) return null;
      if (r.type() === 'FIELD_ITEM' && testIfRef(plan, r.field, l)) return null;
    }
    return cond;
  }
  // test_if_ref(): the condition "field = value" is what the key lookup reads
  function testIfRef(plan, field, value) {
    const s = plan.tabs.find((x) => x.t === field.table);
    if (!s) return false;
    const key = s.type === 'const' && s.constKey ? s.constKey.key : s.type === 'eq_ref' || s.type === 'ref' ? s.refKey : -1;
    if (key < 0) return false;
    const uses = s.type === 'const' ? s.constKey.uses : s.refUses;
    const k = s.share.keys[key];
    let ref_item = null;
    for (let part = 0; part < k.parts.length; part++) {
      const u = uses.find((x) => x.keypart === part);
      if (!u) break;
      if (k.parts[part].field === field.idx && !k.parts[part].length) { ref_item = u.val; break; }
    }
    if (!ref_item || !ref_item.eq(value)) return false;
    if (value.type() === 'FIELD_ITEM') {
      const g = value.field;
      return g.real_type() === field.real_type() && g.binary() === field.binary() && g.pack_length() === field.pack_length();
    }
    if (value.const_item() && field.binary() && (field.type() !== T.FLOAT || field.decimals() === 0)) {
      // store_val_in_field(): exact when nothing was cut
      const probe = new TableInst(s.share, s.t.alias);
      const f = probe.fields[field.idx];
      const saved = THD.cuted_fields, sc = THD.count_cuted_fields;
      THD.count_cuted_fields = true; THD.cuted_fields = 0;
      try { value.save_in_field(f); return THD.cuted_fields === 0; } finally { THD.cuted_fields = saved; THD.count_cuted_fields = sc; }
    }
    return false;
  }
  // find_range_key() (opt_sum.cc): an index that gives MIN()/MAX() of field
  function findRangeKey(field, cond) {
    if (!(field.flags & F.PART_KEY)) return null;
    const t = field.table, share = t.share;
    if (share.options.engine === 'HEAP') return null;
    if (field.key_start && (!cond || !(cond.used_tables() & t.map))) {
      let key = 0;
      while (!(field.key_start & (1 << key))) key++;
      return { key, match: () => true };
    }
    if (!cond) return null;
    // WHERE is exactly "key part = constant" for the parts before field
    const eqs = [];
    const walk = (c) => {
      if (c instanceof Item_cond_and) return c.args.every(walk);
      if (!(c.used_tables() & t.map)) return true;
      if ((c instanceof Item_func_eq || c instanceof Item_func_equal) && c.used_tables() === t.map) {
        const [l, r] = c.args;
        if (l.type() === 'FIELD_ITEM' && (l.field.flags & F.PART_KEY) && r.const_item()) { eqs.push({ f: l.field, v: r }); return true; }
        if (r.type() === 'FIELD_ITEM' && (r.field.flags & F.PART_KEY) && l.const_item()) { eqs.push({ f: r.field, v: l }); return true; }
      }
      return false;
    };
    if (!walk(cond) || !eqs.length || eqs.length > 16) return null;
    for (let nr = 0; nr < share.keys.length; nr++) {
      const k = share.keys[nr];
      if (eqs.length >= k.parts.length) continue;
      const vals = [];
      let ok = true;
      for (let part = 0; part < eqs.length; part++) {
        const e = eqs.find((x) => x.f.idx === k.parts[part].field);
        if (!e) { ok = false; break; }
        const probe = new TableInst(share, t.alias);
        const f = probe.fields[e.f.idx];
        f.set_notnull();
        e.v.save_in_field(f);
        vals.push({ idx: e.f.idx, v: probe.record[e.f.idx], f });
      }
      if (ok && k.parts[eqs.length].field === field.idx) {
        return { key: nr, match: (rec) => vals.every((x) => (x.v === null ? rec[x.idx] === null : rec[x.idx] !== null && valCmp(x.f, rec[x.idx], x.v) === 0)) };
      }
    }
    return null;
  }
  // const_expression_in_where(): the item is compared equal to a constant
  function constExpressionInWhere(cond, item) {
    if (!cond) return false;
    if (cond instanceof Item_cond_and) return cond.args.some((c) => constExpressionInWhere(c, item));
    if (cond instanceof Item_cond_or) return cond.args.every((c) => constExpressionInWhere(c, item));
    if (cond instanceof Item_func_eq || cond instanceof Item_func_equal) {
      const [a, b] = cond.args;
      if (a.eq(item) && b.const_item()) return true;
      if (b.eq(item) && a.const_item()) return true;
    }
    return false;
  }
  function splitAnd(cond) {
    if (!cond) return [];
    if (cond instanceof Item_cond_and) return cond.args.slice();
    return [cond];
  }
  function isSubpart(a, b) {
    if (!b.length) return true;
    if (a.length < b.length) return false;
    for (let i = 0; i < b.length; i++) if (!a[i].item.eq(b[i].item) || a[i].asc !== b[i].asc) return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // INSERT, REPLACE, UPDATE, DELETE (sql_insert.cc, sql_update.cc,
  // sql_delete.cc, handler.cc)
  // ---------------------------------------------------------------------------
  const INFO = (code, ...a) => cfmt(ERRMSG[code - 1000], a);
  // resolve the column list of INSERT/UPDATE against the one table
  function setupTargetFields(ctx, fields) {
    const seen = new Set();
    return fields.map((it) => {
      it.fix_fields(ctx);
      const f = it.field;
      if (seen.has(f)) throw myError(ER.FIELD_SPECIFIED_TWICE, f.field_name);
      seen.add(f);
      return f;
    });
  }
  // handler::update_auto_increment() and write_row()
  function writeRow(conn, t, info) {
    const share = t.share;
    if (share.auto_field >= 0 && t.next_number) {
      const f = t.fields[share.auto_field];
      if (f.is_null() || f.val_int() === 0n) {
        let nr;
        if (conn.next_insert_id) { nr = conn.next_insert_id; conn.next_insert_id = 0n; }
        else nr = BigInt(share.auto_increment);
        conn.last_insert_id = nr; conn.insert_id_used = true;
        f.set_notnull();
        f.store_int(nr);
        t.auto_changed = true;
      } else t.auto_changed = false;
    }
    if (t.set_timestamp && share.timestamp_field >= 0) t.fields[share.timestamp_field].set_time();
    const dup = share.findDuplicate(t.record, -1);
    if (dup) return dup;
    t.pos = share.insertRow(t.record.slice());
    share.touch();
    return null;
  }
  function dupError(t, dup) {
    return myError(ER.DUP_ENTRY, t.share.keyValue(dup.nr, t.record), dup.nr + 1);
  }
  // write_record(): INSERT, INSERT IGNORE, REPLACE
  function writeRecord(conn, t, info, mode) {
    info.records++;
    const share = t.share;
    if (mode === 'replace') {
      for (;;) {
        const dup = writeRow(conn, t, info);
        if (!dup) break;
        if (share.auto_field >= 0 && dup.nr === share.keys.findIndex((k) => k.parts[0].field === share.auto_field) && t.auto_changed) throw dupError(t, dup);
        const lastUniq = !share.keys.slice(dup.nr + 1).some((k) => k.flags & HA_NOSAME);
        if (lastUniq) {
          if (t.set_timestamp && share.timestamp_field >= 0) t.fields[share.timestamp_field].set_time();
          const other = share.findDuplicate(t.record, dup.pos);
          if (other) throw dupError(t, other);
          share.updateRow(dup.pos, t.record.slice());
          t.pos = dup.pos;
          share.touch();
          info.deleted++;
          break;
        }
        share.deleteRow(dup.pos);
        info.deleted++;
      }
      info.copied++;
      return;
    }
    const dup = writeRow(conn, t, info);
    if (dup) {
      if (mode !== 'ignore') throw dupError(t, dup);
      return;
    }
    info.copied++;
  }
  // fill_record(): values into fields, left to right
  function fillRecord(fields, values) {
    for (let i = 0; i < fields.length; i++) {
      if (values[i].save_in_field(fields[i])) return true;
    }
    return false;
  }

  function execInsert(conn, st) {
    const replace = st.cmd === 'replace';
    const mode = replace ? 'replace' : st.ignore ? 'ignore' : 'error';
    const ref = { db: st.table.db, name: st.table.table, alias: st.table.table };
    if (st.select) return execInsertSelect(conn, st, ref, mode);
    const [t] = openTables(conn, [ref], true);
    const ctx = { tables: [t], where: 'field list', allow_sum_func: false, conn };
    const allFields = !st.fields.length;
    let fields;
    const value_count = st.values[0].length;
    if (allFields && value_count !== 0) {
      if (value_count !== t.fields.length) throw myError(ER.WRONG_VALUE_COUNT_ON_ROW, 1);
      fields = t.fields;
    } else {
      if (st.fields.length !== value_count) throw myError(ER.WRONG_VALUE_COUNT_ON_ROW, 1);
      fields = setupTargetFields(ctx, st.fields);
    }
    t.set_timestamp = !fields.some((f) => f.idx === t.share.timestamp_field) && !(allFields && value_count);
    // values: expressions that may use columns (of the row being built)
    st.values.forEach((row, n) => {
      if (row.length !== value_count) throw myError(ER.WRONG_VALUE_COUNT_ON_ROW, n + 1);
      for (const v of row) v.fix_fields(ctx);
    });
    const info = { records: 0, deleted: 0, copied: 0 };
    THD.count_cuted_fields = st.values.length > 1;
    THD.cuted_fields = 0;
    t.next_number = true;
    let id = 0n, error = null;
    const multi = st.values.length !== 1;
    for (const row of st.values) {
      t.restoreDefaults();
      if (fillRecord(fields, row)) {
        if (multi) { info.records++; continue; }
        throw myError(ER.BAD_NULL, fields[row.findIndex(() => true)].field_name);
      }
      try { writeRecord(conn, t, info, mode); } catch (e) { error = e; break; }
      if (!id && conn.insert_id_used) id = conn.last_insert_id;
    }
    if (info.copied || info.deleted) conn.dirty(t.share);
    THD.count_cuted_fields = false;
    if (id && multi) { conn.last_insert_id = id; conn.insert_id_used = true; }
    else if (t.share.auto_field >= 0) id = t.fields[t.share.auto_field].is_null() ? 0n : BigInt.asUintN(64, t.fields[t.share.auto_field].val_int());
    if (error) throw error;
    if (!multi) return { affected: info.copied + info.deleted, insertId: id };
    const buff = mode === 'ignore' ? INFO(ER.INSERT_INFO, info.records, info.records - info.copied, THD.cuted_fields)
      : INFO(ER.INSERT_INFO, info.records, info.deleted, THD.cuted_fields);
    return { affected: info.copied + info.deleted, insertId: 0n, info: buff };
  }
  function execInsertSelect(conn, st, ref, mode) {
    const sel = st.select;
    // the target table is part of the statement's table list (duplicate alias check)
    const refs = [ref, ...sel.tables];
    for (let i = 0; i < refs.length; i++) {
      refs[i].db = refs[i].db || conn.db;
      if (!refs[i].db) throw myError(ER.NO_DB);
      for (let j = 0; j < i; j++) if (refs[j].alias === refs[i].alias && refs[j].db === refs[i].db) throw myError(ER.NONUNIQ_TABLE, refs[i].alias);
    }
    const [t] = openTables(conn, [ref], true);
    const ctx = { tables: [t], where: 'field list', allow_sum_func: false, conn };
    const q = new Select(conn, sel);
    q.prepare();
    const fields = st.fields.length ? setupTargetFields(ctx, st.fields) : t.fields;
    if (fields.length !== q.items.length) throw myError(ER.WRONG_VALUE_COUNT_ON_ROW, 1);
    t.set_timestamp = !st.fields.length ? false : !fields.some((f) => f.idx === t.share.timestamp_field);
    if (!st.fields.length) t.set_timestamp = false;
    const res = q.run();
    const info = { records: 0, deleted: 0, copied: 0 };
    THD.count_cuted_fields = true;
    THD.cuted_fields = 0;
    t.next_number = true;
    let last_insert_id = 0n;
    try {
      for (const row of res.rows) {
        t.restoreDefaults();
        fillRecord(fields, row);
        writeRecord(conn, t, info, mode);
        if (t.share.auto_field >= 0 && !last_insert_id && conn.insert_id_used) last_insert_id = conn.last_insert_id;
      }
    } finally {
      if (info.copied || info.deleted) conn.dirty(t.share);
      THD.count_cuted_fields = false;
    }
    if (last_insert_id) { conn.last_insert_id = last_insert_id; conn.insert_id_used = true; }
    const buff = INFO(ER.INSERT_INFO, info.records, mode === 'ignore' ? info.records - info.copied : info.deleted, THD.cuted_fields);
    return { affected: info.copied + info.deleted, insertId: last_insert_id, info: buff };
  }

  // the rows of one table a WHERE selects, in the order MySQL reads them
  // (SQL_SELECT::check_quick(): a range on any key, else a table scan)
  function selectRows(conn, t, where, limit = Infinity) {
    const conds = splitAnd(where);
    for (const c of conds) if (c.const_item() && !(c.used_tables() & RAND_TABLE_BIT) && !c.val_int()) return [];
    const s = { t, share: t.share, on: null, keyuse: [], records: t.share.rows, used_keys: 0 };
    const r = where ? testQuickSelect(s, where, (1 << t.share.keys.length) - 1, 0, limit) : null;
    const rows = r && r.quick ? r.quick.rows : [...t.share.scan()];
    const out = [];
    for (const r of rows) {
      t.record = r.rec; t.null_row = false; t.pos = r.pos;
      if (!where || where.val_int()) out.push(r);
    }
    return out;
  }

  function execUpdate(conn, st) {
    const [t] = openTables(conn, [{ db: st.table.db, name: st.table.table, alias: st.table.table }], true);
    const ctx = { tables: [t], where: 'where clause', allow_sum_func: false, conn };
    if (st.where) st.where.fix_fields(ctx);
    ctx.where = 'field list';
    const fields = setupTargetFields(ctx, st.fields);
    for (const v of st.values) v.fix_fields(ctx);
    t.set_timestamp = !fields.some((f) => f.idx === t.share.timestamp_field);
    const limit = st.limit === null ? Infinity : Number(st.limit);
    if (limit === 0) return { affected: 0n };
    THD.count_cuted_fields = true;
    THD.cuted_fields = 0;
    const rows = selectRows(conn, t, st.where, limit);
    let found = 0, updated = 0, error = null;
    const share = t.share;
    for (const r of rows) {
      const cur = share.slots[r.pos];
      if (!cur) continue;
      t.record = cur.slice(); t.null_row = false; t.pos = r.pos;
      found++;
      fillRecord(fields, st.values);
      const changed = t.record.some((v, i) => !sameValue(v, cur[i]));
      if (changed) {
        if (t.set_timestamp && share.timestamp_field >= 0) t.fields[share.timestamp_field].set_time();
        const dup = share.findDuplicate(t.record, r.pos);
        if (dup) {
          if (!st.ignore) { error = dupError(t, dup); break; }
        } else {
          share.updateRow(r.pos, t.record.slice());
          share.touch();
          updated++;
        }
      }
      if (!--st.limitLeft && false) break;
      if (found >= limit) break;
    }
    THD.count_cuted_fields = false;
    if (updated) conn.dirty(share);
    if (error) throw error;
    return { affected: updated, insertId: conn.insert_id_used ? conn.last_insert_id : 0n,
      info: INFO(ER.UPDATE_INFO, found, updated, THD.cuted_fields) };
  }
  const sameValue = (a, b) => a === b || (typeof a === 'number' && typeof b === 'number' && Object.is(a, b));

  function execDelete(conn, st) {
    const [t] = openTables(conn, [{ db: st.table.db, name: st.table.table, alias: st.table.table }], true);
    if (!st.where && st.limit === null) {
      // generate_table(): recreate the table
      t.share.truncate();
      t.share.auto_increment = 1;
      t.share.touch();
      conn.dirty(t.share);
      return { affected: 0 };
    }
    const ctx = { tables: [t], where: 'where clause', allow_sum_func: false, conn };
    if (st.where) st.where.fix_fields(ctx);
    const limit = st.limit === null ? Infinity : Number(st.limit);
    let deleted = 0;
    if (limit) {
      for (const r of selectRows(conn, t, st.where, limit)) {
        if (!t.share.slots[r.pos]) continue;
        t.share.deleteRow(r.pos);
        deleted++;
        if (deleted >= limit) break;
      }
    }
    if (deleted) { t.share.touch(); conn.dirty(t.share); }
    return { affected: deleted };
  }

  // ---------------------------------------------------------------------------
  // CREATE, ALTER, DROP, RENAME (sql_parse.cc add_field_to_list(),
  // sql_table.cc mysql_create_table()/mysql_alter_table()/mysql_rm_table(),
  // sql_rename.cc, sql_db.cc)
  // ---------------------------------------------------------------------------
  const NAME_LEN = 64, MAX_KEY = 32, MAX_REF_PARTS = 16, MI_MAX_KEY_LENGTH = 500;
  const KEEP_FLAGS = F.NOT_NULL | F.UNSIGNED | F.ZEROFILL | F.BINARY | F.AUTO_INCREMENT | F.BLOB;
  const BLOB_PACK = { [T.TINY_BLOB]: 1, [T.BLOB]: 2, [T.MEDIUM_BLOB]: 3, [T.LONG_BLOB]: 4 };
  const ENGINES = { MYISAM: 'MyISAM', HEAP: 'HEAP', ISAM: 'ISAM', MRG_MYISAM: 'MRG_MyISAM' };
  // what the handlers can't do (handler::option_flag(), max_keys())
  const ENGINE_LIMITS = {
    MyISAM: { maxKeys: 32 },
    HEAP: { maxKeys: 32, noBlobs: true, noAuto: true, noNullKey: true, noFulltext: true },
    ISAM: { maxKeys: 16, noBlobKey: true, noNullKey: true, noFulltext: true },
    MRG_MyISAM: { maxKeys: 32, noFulltext: true },
  };

  function calc_pack_length(type, length) {
    switch (type) {
      case T.STRING: case T.VAR_STRING: case T.DECIMAL: return length;
      case T.YEAR: case T.TINY: return 1;
      case T.SHORT: return 2;
      case T.INT24: case T.NEWDATE: case T.TIME: return 3;
      case T.TIMESTAMP: case T.DATE: case T.LONG: case T.FLOAT: return 4;
      case T.DOUBLE: case T.LONGLONG: case T.DATETIME: return 8;
      case T.NULL: return 0;
      default: return BLOB_PACK[type] ? BLOB_PACK[type] + 8 : 0;
    }
  }
  // the "packed" key types, which can't have a key prefix (f_is_packed())
  const isPackedType = (type) => !(type === T.STRING || type === T.VAR_STRING || type === T.DECIMAL || BLOB_PACK[type]);

  // find_set(): the value and whether a part was unknown
  function find_set(typelib, x) {
    let end = x.length;
    while (end > 0 && my_isspace(cc(x, end - 1))) end--;
    let found = 0n, error = false;
    if (end) {
      for (const part of x.slice(0, end).split(',')) {
        const k = find_enum(typelib, part);
        if (!k) error = true; else found |= 1n << BigInt(k - 1);
      }
    }
    return { found, error };
  }

  // add_field_to_list(): a column definition from the parser as a create_field
  function addField(spec) {
    const name = spec.name;
    if (name.length > NAME_LEN) throw myError(ER.TOO_LONG_IDENT, name);
    const flags = spec.flags;
    let def = spec.def === undefined ? null : spec.def;
    if (def && def.type() === 'NULL_ITEM') {
      if ((flags & (F.NOT_NULL | F.AUTO_INCREMENT)) === F.NOT_NULL) throw myError(ER.INVALID_DEFAULT, name);
      def = null;
    }
    const cf = { name, type: spec.type, flags, def: flags & F.AUTO_INCREMENT ? null : def, dec: 0, length: 0,
      typelib: null, pack_length: 0, change: null, after: null, field: null };
    cf.dec = spec.decimals !== null ? Math.min(Math.max(atol(spec.decimals), 0), NOT_FIXED_DEC - 1) : 0;
    let hasLen = spec.length !== null;
    if (hasLen) { cf.length = atol(spec.length) >>> 0; if (!cf.length) hasLen = false; }
    const sign_len = flags & F.UNSIGNED ? 0 : 1;
    if (cf.length && cf.dec && cf.length < cf.dec + 2 && cf.dec !== NOT_FIXED_DEC) cf.length = cf.dec + 2;
    let allowed = 0;
    const interval = spec.interval;
    switch (spec.type) {
      case T.TINY: if (!hasLen) cf.length = 3 + sign_len; allowed = F.AUTO_INCREMENT; break;
      case T.SHORT: if (!hasLen) cf.length = 5 + sign_len; allowed = F.AUTO_INCREMENT; break;
      case T.INT24: if (!hasLen) cf.length = 8 + sign_len; allowed = F.AUTO_INCREMENT; break;
      case T.LONG: if (!hasLen) cf.length = 10 + sign_len; allowed = F.AUTO_INCREMENT; break;
      case T.LONGLONG: if (!hasLen) cf.length = 20; allowed = F.AUTO_INCREMENT; break;
      case T.STRING: case T.VAR_STRING: case T.NULL: break;
      case T.DECIMAL:
        if (!hasLen) cf.length = 10;
        cf.length += sign_len;
        if (cf.dec) cf.length++;
        break;
      case T.BLOB: case T.TINY_BLOB: case T.LONG_BLOB: case T.MEDIUM_BLOB:
        if (def) {
          const s = def.val_str();
          if (s !== null && s.length) throw myError(ER.BLOB_CANT_HAVE_DEFAULT, name);
          cf.def = null;
        }
        cf.flags |= F.BLOB;
        break;
      case T.YEAR:
        if (!hasLen || cf.length !== 2) cf.length = 4;
        cf.flags |= F.ZEROFILL | F.UNSIGNED;
        break;
      case T.FLOAT:
        allowed = F.AUTO_INCREMENT;
        if (hasLen && spec.decimals === null) {
          if (cf.length > 53) throw myError(ER.WRONG_FIELD_SPEC, name);
          if (cf.length > 24) { cf.type = T.DOUBLE; cf.length = DBL_DIG + 7; } else cf.length = 6 + 6;
          cf.dec = NOT_FIXED_DEC;
          break;
        }
        if (!hasLen) { cf.length = 6 + 6; cf.dec = NOT_FIXED_DEC; }
        break;
      case T.DOUBLE:
        allowed = F.AUTO_INCREMENT;
        if (!hasLen) { cf.length = DBL_DIG + 7; cf.dec = NOT_FIXED_DEC; }
        break;
      case T.TIMESTAMP:
        if (!hasLen) cf.length = 14;
        else cf.length = Math.min(((cf.length + 1) >>> 1) * 2, 14);
        cf.flags |= F.ZEROFILL | F.UNSIGNED | F.NOT_NULL;
        break;
      case T.DATE: cf.type = T.NEWDATE; cf.length = 10; break;
      case T.NEWDATE: cf.length = 10; break;
      case T.TIME: cf.length = 10; break;
      case T.DATETIME: cf.length = 19; break;
      case T.SET: {
        if (interval.length > 64) throw myError(ER.TOO_BIG_SET, name);
        cf.pack_length = (interval.length + 7) >> 3;
        if (cf.pack_length > 4) cf.pack_length = 8;
        cf.typelib = interval;
        cf.length = Math.min(interval.reduce((n, s) => n + s.length + 1, 0) - 1, MAX_FIELD_WIDTH - 1);
        if (def) {
          const s = def.val_str();
          if (find_set(interval, s === null ? '' : s).error) throw myError(ER.INVALID_DEFAULT, name);
        }
        break;
      }
      case T.ENUM: {
        cf.typelib = interval;
        cf.pack_length = interval.length < 256 ? 1 : 2;
        cf.length = Math.min(Math.max(...interval.map((s) => s.length)), MAX_FIELD_WIDTH - 1);
        if (def) {
          const s = def.val_str();
          if (!find_enum(interval, s === null ? '' : s)) throw myError(ER.INVALID_DEFAULT, name);
        }
        break;
      }
    }
    if (cf.length >= MAX_FIELD_WIDTH || (!cf.length && !(cf.flags & F.BLOB) && spec.type !== T.STRING)) {
      throw myError(ER.TOO_BIG_FIELDLENGTH, name, MAX_FIELD_WIDTH - 1);
    }
    if (~allowed & flags & F.AUTO_INCREMENT) throw myError(ER.WRONG_FIELD_SPEC, name);
    if (!cf.pack_length) cf.pack_length = calc_pack_length(cf.type === T.VAR_STRING ? T.STRING : cf.type, cf.length);
    return cf;
  }

  // create_field(Field *old_field, Field *orig_field): an existing column
  function fieldToCreate(f, orig) {
    const cf = { name: f.field_name, type: f.real_type(), flags: f.flags & (KEEP_FLAGS | F.ENUM | F.SET), dec: f.decimals(),
      length: f.field_length, typelib: f.typelib || null, pack_length: f.pack_length(), change: f.field_name, after: null,
      field: f, def: null };
    if (!f.auto_inc) cf.flags &= ~F.AUTO_INCREMENT;
    if (cf.type === T.STRING) {
      cf.type = f.type();
      cf.dec = 0;
    }
    if (BLOB_PACK[cf.type]) cf.length = 0;
    if (cf.type === T.NEWDATE || cf.type === T.TIME) cf.length = 10;
    if (orig && !(cf.flags & F.BLOB) && f.type() !== T.TIMESTAMP) {
      // the value in the default record (record[2])
      const share = orig.table.share || orig.table;
      const v = share.record[orig.idx];
      if (v !== null) {
        const g = orig.clone({ record: [v], null_row: false, alias: '', pack_record: share.pack_record });
        g.idx = 0;
        cf.def = new Item_string(g.val_str());
      }
    }
    return cf;
  }

  // mysql_create_table(): the checks, the key order and the table definition
  function prepareTable(cfs, keySpecs, options) {
    if (!cfs.length) throw myError(ER.TABLE_MUST_HAVE_COLUMNS);
    let pack = options.row_format === 'DYNAMIC';
    cfs.forEach((cf, i) => {
      if ((cf.flags & F.BLOB) || (cf.type === T.VAR_STRING && options.row_format !== 'FIXED')) pack = true;
      for (let j = 0; j < i; j++) if (strcaseeq(cfs[j].name, cf.name)) throw myError(ER.DUP_FIELDNAME, cf.name);
    });
    const engine = ENGINES[options.type] || 'MyISAM', limits = ENGINE_LIMITS[engine];
    let auto_increment = cfs.filter((cf) => cf.flags & F.AUTO_INCREMENT).length;
    if (auto_increment > 1) throw myError(ER.WRONG_AUTO_KEY);
    if (auto_increment && limits.noAuto) throw myError(ER.TABLE_CANT_HANDLE_AUTO_INCREMENT);
    if (limits.noBlobs && cfs.some((cf) => cf.flags & F.BLOB)) throw myError(ER.TABLE_CANT_HANDLE_BLOB);
    if (keySpecs.length > limits.maxKeys) throw myError(ER.TOO_MANY_KEYS, limits.maxKeys);
    // PRIMARY KEY first, then UNIQUE keys (each one in front), other keys last
    let primary = null;
    const inOrder = [];
    for (const key of keySpecs) {
      if (key.cols.length > MAX_REF_PARTS) throw myError(ER.TOO_MANY_KEY_PARTS, MAX_REF_PARTS);
      if (key.name && key.name.length > NAME_LEN) throw myError(ER.TOO_LONG_IDENT, key.name);
      if (key.type === 'PRIMARY') {
        if (primary) throw myError(ER.MULTIPLE_PRI_KEY);
        primary = key;
      } else if (key.type === 'UNIQUE') inOrder.unshift(key);
      else inOrder.push(key);
    }
    if (primary) inOrder.unshift(primary);
    const keys = [];
    for (const key of inOrder) {
      const out = { name: null, type: key.type, parts: [] };
      let key_length = 0;
      if (key.type === 'FULLTEXT' && limits.noFulltext) throw myError(ER.TABLE_CANT_HANDLE_FULLTEXT);
      key.cols.forEach((col, column_nr) => {
        const field = cfs.findIndex((cf) => strcaseeq(cf.name, col.name));
        if (field < 0) throw myError(ER.KEY_COLUMN_DOES_NOT_EXIST, col.name);
        const cf = cfs[field];
        let colLen = col.length || 0;
        if (cf.flags & F.BLOB) {
          if (limits.noBlobKey) throw myError(ER.BLOB_USED_AS_KEY, col.name);
          if (!colLen) {
            if (key.type === 'FULLTEXT') colLen = 1;
            else throw myError(ER.BLOB_KEY_WITHOUT_LENGTH, col.name);
          }
        }
        if (!(cf.flags & F.NOT_NULL)) {
          if (key.type === 'PRIMARY') throw myError(ER.PRIMARY_CANT_HAVE_NULL);
          if (limits.noNullKey) throw myError(ER.NULL_COLUMN_IN_INDEX, col.name);
        }
        if (cf.flags & F.AUTO_INCREMENT) auto_increment--;
        let length = cf.pack_length;
        if (colLen) {
          if (cf.flags & F.BLOB) {
            if ((length = colLen) > MI_MAX_KEY_LENGTH) throw myError(ER.WRONG_SUB_KEY);
          } else if (colLen > length || (isPackedType(cf.type) && colLen !== length)) throw myError(ER.WRONG_SUB_KEY);
          length = colLen;
        } else if (length === 0) throw myError(ER.WRONG_KEY_COLUMN, col.name);
        key_length += length;
        out.parts.push({ field, length: colLen && !(cf.flags & F.BLOB) && colLen === cf.pack_length ? 0 : colLen });
        if (column_nr === 0) {
          let name;
          if (key.type === 'PRIMARY') name = 'PRIMARY';
          else if (!(name = key.name)) {
            name = cf.name;
            for (let i = 2; keys.some((k) => strcaseeq(k.name, name)); i++) name = cf.name.slice(0, NAME_LEN - 4) + '_' + i;
          }
          if (keys.some((k) => strcaseeq(k.name, name))) throw myError(ER.DUP_KEYNAME, name);
          out.name = name;
        }
      });
      if (key_length > MI_MAX_KEY_LENGTH && key.type !== 'FULLTEXT') throw myError(ER.TOO_LONG_KEY, MI_MAX_KEY_LENGTH);
      keys.push(out);
    }
    if (auto_increment > 0) throw myError(ER.WRONG_AUTO_KEY);
    const fields = cfs.map((cf) => ({ name: cf.name, type: cf.type, length: cf.length, dec: cf.dec, flags: cf.flags & (KEEP_FLAGS | F.ENUM | F.SET),
      typelib: cf.typelib }));
    for (const f of fields) {
      if (f.type === T.ENUM) f.flags |= F.ENUM;
      if (f.type === T.SET) f.flags |= F.SET;
    }
    const opts = Object.assign({}, options, { pack_record: pack, engine });
    delete opts.type;
    return { fields, keys, options: opts };
  }

  // make_empty_rec(): the default record
  function makeShare(db, name, def, cfs) {
    def.create_time = def.update_time = nowSeconds();
    const sh = new TableShare(db, name, def);
    const saved = THD.count_cuted_fields;
    THD.count_cuted_fields = false;
    try {
      sh.record = new Array(sh.fields.length).fill(null);
      sh.fields.forEach((f, i) => {
        const cf = cfs[i];
        if (cf.def && (f.real_type() !== T.YEAR || cf.def.val_int() !== 0n)) cf.def.save_in_field(f);
        else if (f.real_type() === T.ENUM && !f.nullable) { f.set_notnull(); f.store_int(1n); }
        else if (!f.nullable || f.type() === T.TIMESTAMP) f.reset();
      });
    } finally { THD.count_cuted_fields = saved; }
    if (def.options.auto_increment) sh.auto_increment = Number(def.options.auto_increment);
    return sh;
  }

  function checkTableName(name) {
    if (!name.length || name.length > NAME_LEN || /[\/\\]/.test(name) || / $/.test(name)) throw myError(ER.WRONG_TABLE_NAME, name);
  }
  function checkDbName(name) {
    if (!name.length || name.length > NAME_LEN || /[\/\\.]/.test(name) || / $/.test(name)) throw myError(ER.WRONG_DB_NAME, name);
  }
  const frmPath = (db, name, ext) => './' + db + '/' + name + (ext || '.frm');
  // EE_CANTCREATEFILE (mysys)
  const cantCreateFile = (path) => new SqlError(1, "Can't create/write to file '" + path + "' (Errcode: 2)");

  // the create_fields and keys of CREATE TABLE
  function createSpecs(st) {
    const cfs = st.fields.map((f) => addField(f));
    return { cfs, keys: st.keys.map((k) => ({ type: k.type, name: k.name, cols: k.cols })) };
  }

  function execCreateTable(conn, st) {
    const db = st.table.db || conn.db;
    if (!db) throw myError(ER.NO_DB);
    const name = st.table.table;
    checkTableName(name);
    const srv = conn.srv;
    let { cfs, keys } = createSpecs(st);
    if (st.select) return execCreateSelect(conn, st, db, name, cfs, keys);
    const def = prepareTable(cfs, keys, st.options);
    if (st.temporary) {
      if (conn.tmpTables.has(db + '\0' + name)) {
        if (st.ifNotExists) return { affected: 0 };
        throw myError(ER.TABLE_EXISTS, name);
      }
      const sh = makeShare(db, name, def, cfs);
      sh.tmp_table = true;
      conn.tmpTables.set(db + '\0' + name, sh);
      return { affected: 0 };
    }
    if (srv.getTable(db, name)) {
      if (st.ifNotExists) return { affected: 0 };
      throw myError(ER.TABLE_EXISTS, name);
    }
    if (!srv.dbs.has(db)) throw cantCreateFile(frmPath(db, name));
    srv.addTable(makeShare(db, name, def, cfs));
    return { affected: 0 };
  }

  // CREATE TABLE ... SELECT (select_create, create_table_from_items())
  function execCreateSelect(conn, st, db, name, cfs, keys) {
    const sel = st.select;
    for (const t of sel.tables) {
      if ((t.db || conn.db) === db && t.name === name) throw myError(ER.INSERT_TABLE_USED, name);
    }
    const q = new Select(conn, sel);
    q.prepare();
    const tmp = { alias: '', record: [], null_row: false, pack_record: false, maybe_null: false, nfields: 0 };
    const all = cfs.slice();
    for (const item of q.items) {
      if (item.name.length > NAME_LEN || / $/.test(item.name) || !item.name.length) throw myError(ER.WRONG_COLUMN_NAME, item.name);
      const f = tmpFieldFor(item, tmp, false);
      f.field_name = item.name;
      f.auto_inc = false;
      all.push(fieldToCreate(f, item.type() === 'FIELD_ITEM' ? item.field : null));
      all[all.length - 1].change = null;
    }
    const def = prepareTable(all, keys, st.options);
    const srv = conn.srv;
    if (st.temporary ? conn.tmpTables.has(db + '\0' + name) : srv.getTable(db, name)) {
      if (st.ifNotExists) return { affected: 0 };
      throw myError(ER.TABLE_EXISTS, name);
    }
    if (!st.temporary && !srv.dbs.has(db)) throw cantCreateFile(frmPath(db, name));
    const res = q.run();
    const sh = makeShare(db, name, def, all);
    const t = new TableInst(sh, name);
    t.db = db;
    const fields = t.fields.slice(cfs.length);
    const info = { records: 0, deleted: 0, copied: 0 };
    const mode = st.duplicates;
    THD.count_cuted_fields = true;
    THD.cuted_fields = 0;
    t.next_number = true;
    t.set_timestamp = true;
    let last_insert_id = 0n;
    try {
      for (const row of res.rows) {
        t.restoreDefaults();
        fillRecord(fields, row);
        writeRecord(conn, t, info, mode);
        if (sh.auto_field >= 0 && !last_insert_id && conn.insert_id_used) last_insert_id = conn.last_insert_id;
      }
    } finally { THD.count_cuted_fields = false; }
    if (st.temporary) { sh.tmp_table = true; conn.tmpTables.set(db + '\0' + name, sh); }
    else srv.addTable(sh);
    if (last_insert_id) { conn.last_insert_id = last_insert_id; conn.insert_id_used = true; }
    const buff = INFO(ER.INSERT_INFO, info.records, mode === 'ignore' ? info.records - info.copied : info.deleted, THD.cuted_fields);
    return { affected: info.copied + info.deleted, insertId: last_insert_id, info: buff };
  }

  // mysql_alter_table()
  function execAlter(conn, st) {
    const ref = { db: st.table.db, name: st.table.table, alias: st.table.table };
    const [table] = openTables(conn, [ref], true);
    const db = table.db, share = table.share, table_name = share.name;
    const srv = conn.srv;
    let new_db = db, new_name = table_name;
    const fields = [], keys = [], drops = [], alters = [];
    let drop_primary = false, order = null;
    const options = {};
    for (const s of st.specs) {
      switch (s.op) {
        case 'add_field': {
          const cf = addField(s.field);
          if (s.place) cf.after = s.place.first ? true : s.place.after;
          fields.push(cf);
          break;
        }
        case 'change': {
          const cf = addField(s.field);
          cf.change = s.old;
          if (s.place) cf.after = s.place.first ? true : s.place.after;
          fields.push(cf);
          if (s.field.flags & F.PRI_KEY) keys.push({ type: 'PRIMARY', name: null, cols: [{ name: cf.name, length: null }] });
          if (s.field.flags & (F.UNIQUE | F.UNIQUE_KEY)) keys.push({ type: 'UNIQUE', name: null, cols: [{ name: cf.name, length: null }] });
          break;
        }
        case 'add_key': keys.push(s.key); break;
        case 'drop_field': drops.push({ type: 'COLUMN', name: s.name }); break;
        case 'drop_key': drops.push({ type: 'KEY', name: s.name }); break;
        case 'drop_primary': drop_primary = true; break;
        case 'alter_default': alters.push({ name: s.name, def: s.def }); break;
        case 'rename': new_db = s.to.db || conn.db; new_name = s.to.table; break;
        case 'order': order = s.list; break;
        case 'options': Object.assign(options, s.options); break;
      }
    }
    if (new_name !== table_name || new_db !== db) {
      checkTableName(new_name);
      if (new_name === table_name) new_name = table_name;
      else if (srv.getTable(new_db, new_name)) throw myError(ER.TABLE_EXISTS, new_name);
    }
    const engine = options.type ? ENGINES[options.type] || 'MyISAM' : share.options.engine;
    // a simple RENAME
    if (new_name !== table_name && !fields.length && !keys.length && !drops.length && !alters.length && !drop_primary &&
      engine === share.options.engine && !options.max_rows && !options.auto_increment && !share.tmp_table) {
      if (srv.getTable(new_db, new_name)) throw myError(ER.TABLE_EXISTS, new_name);
      renameShare(srv, share, new_db, new_name);
      return { affected: 0 };
    }
    // the columns of the new table
    const create = [];
    let use_timestamp = false;
    const aiReset = { value: false };
    for (const field of table.fields) {
      const di = drops.findIndex((d) => d.type === 'COLUMN' && strcaseeq(field.field_name, d.name));
      if (di >= 0) {
        if (field.auto_inc) aiReset.value = true;
        drops.splice(di, 1);
        continue;
      }
      const ci = fields.findIndex((d) => d.change && strcaseeq(field.field_name, d.change));
      if (ci >= 0) {
        const def = fields[ci];
        def.field = field;
        if (def.type === T.TIMESTAMP) use_timestamp = true;
        create.push(def);
        fields.splice(ci, 1);
      } else {
        const def = fieldToCreate(field, share.fields[field.idx]);
        if (def.type === T.TIMESTAMP) use_timestamp = true;
        create.push(def);
        const ai = alters.findIndex((a) => strcaseeq(field.field_name, a.name));
        if (ai >= 0) {
          if (def.type === T.BLOB || BLOB_PACK[def.type]) throw myError(ER.BLOB_CANT_HAVE_DEFAULT, def.change);
          def.def = alters[ai].def && alters[ai].def.type() !== 'NULL_ITEM' ? alters[ai].def : null;
          alters.splice(ai, 1);
        }
      }
    }
    for (const def of fields) {
      if (def.change) throw myError(ER.BAD_FIELD, def.change, table_name);
      if (!def.after) create.push(def);
      else if (def.after === true) create.unshift(def);
      else {
        const k = create.findIndex((c) => strcaseeq(def.after, c.name));
        if (k < 0) throw myError(ER.BAD_FIELD, def.after, table_name);
        create.splice(k + 1, 0, def);
      }
    }
    if (alters.length) throw myError(ER.BAD_FIELD, alters[0].name, table_name);
    if (!create.length) throw myError(ER.CANT_REMOVE_ALL_FIELDS);
    // the keys that remain
    const keyList = [];
    share.keys.forEach((key) => {
      if (drop_primary && (key.flags & HA_NOSAME)) { drop_primary = false; return; }
      const di = drops.findIndex((d) => d.type === 'KEY' && strcaseeq(key.name, d.name));
      if (di >= 0) { drops.splice(di, 1); return; }
      const cols = [];
      for (const p of key.parts) {
        const kf = share.fields[p.field];
        const cfield = create.find((c) => (c.change ? strcaseeq(kf.field_name, c.change) : strcaseeq(kf.field_name, c.name)));
        if (!cfield) continue;
        let len = p.length || 0;
        if (cfield.field && !(cfield.field.flags & F.BLOB) &&
          (cfield.field.pack_length() === len || cfield.length !== cfield.pack_length || cfield.pack_length <= len)) len = 0;
        cols.push({ name: cfield.name, length: len || null });
      }
      if (cols.length) {
        keyList.push({ type: key.flags & HA_NOSAME ? (strcaseeq(key.name, 'PRIMARY') ? 'PRIMARY' : 'UNIQUE') : key.flags & HA_FULLTEXT ? 'FULLTEXT' : 'MULTIPLE',
          name: key.name, cols });
      }
    });
    for (const k of keys) keyList.push(k);
    if (drops.length) throw myError(ER.CANT_DROP_FIELD_OR_KEY, drops[0].name);
    const newOptions = Object.assign({}, share.options, options);
    delete newOptions.pack_record;
    delete newOptions.engine;
    newOptions.type = options.type || Object.keys(ENGINES).find((k) => ENGINES[k] === share.options.engine);
    if (!options.row_format) newOptions.row_format = share.options.row_format;
    const def = prepareTable(create, keyList, newOptions);
    const sh = makeShare(new_db, new_name, def, create);
    sh.create_time = nowSeconds();
    // copy_data_between_tables()
    const to = new TableInst(sh, new_name);
    to.db = new_db;
    const copies = [];
    create.forEach((c, i) => { if (c.field) copies.push([to.fields[i], c.field]); });
    let rows = [...share.scan()];
    if (order) {
      const ctx = { tables: [table], where: 'order clause', allow_sum_func: false, conn };
      const ord = order.map((o) => { o.item.fix_fields(ctx); return o; });
      rows = rows.map((r, seq) => {
        table.record = r.rec;
        return { r, seq, keys: ord.map((o) => cellOf(o.item, null)) };
      }).sort((a, b) => {
        for (let k = 0; k < ord.length; k++) { const c = sortCompare(a.keys[k], b.keys[k], ord[k].asc); if (c) return c; }
        return a.seq - b.seq;
      }).map((x) => x.r);
    }
    THD.count_cuted_fields = true;
    THD.cuted_fields = 0;
    let copied = 0, deleted = 0;
    to.next_number = true;
    to.set_timestamp = !use_timestamp;
    if (!aiReset.value && sh.auto_field >= 0 && share.auto_field >= 0) sh.auto_increment = share.auto_increment;
    try {
      for (const r of rows) {
        table.record = r.rec;
        to.restoreDefaults();
        if (sh.auto_field >= 0) to.fields[sh.auto_field].reset();
        for (const [tf, ff] of copies) {
          if (ff.is_null()) set_field_to_null(tf);
          else { tf.set_notnull(); field_conv(tf, ff); }
        }
        const dup = writeRow(conn, to, null);
        if (dup) {
          if (st.ignore) { deleted++; continue; }
          throw dupError(to, dup);
        }
        copied++;
      }
    } finally { THD.count_cuted_fields = false; }
    conn.insert_id_used = false;
    if (share.tmp_table) {
      sh.tmp_table = true;
      conn.tmpTables.delete(db + '\0' + table_name);
      conn.tmpTables.set(new_db + '\0' + new_name, sh);
    } else {
      if ((new_name !== table_name || new_db !== db) && srv.getTable(new_db, new_name)) throw myError(ER.TABLE_EXISTS, new_name);
      srv.dropTable(db, table_name);
      srv.addTable(sh);
    }
    return { affected: copied + deleted, insertId: 0n, info: INFO(ER.INSERT_INFO, copied + deleted, deleted, THD.cuted_fields) };
  }
  function renameShare(srv, share, db, name) {
    srv.dropTable(share.db, share.name);
    share.db = db;
    share.name = name;
    share.alias = name;
    srv.addTable(share);
  }

  // CREATE INDEX / DROP INDEX are ALTER TABLE
  function execCreateIndex(conn, st) {
    return execAlter(conn, { table: st.table, ignore: false, specs: [{ op: 'add_key', key: st.key }] });
  }
  function execDropIndex(conn, st) {
    return execAlter(conn, { table: st.table, ignore: false, specs: [{ op: 'drop_key', name: st.name }] });
  }

  // mysql_rename_tables(): all or nothing
  function execRename(conn, st) {
    const srv = conn.srv;
    const done = [];
    const undo = () => { for (const [share, db, name] of done.reverse()) renameShare(srv, share, db, name); };
    for (const { from, to } of st.pairs) {
      const fdb = from.db || conn.db, tdb = to.db || conn.db;
      if (!fdb || !tdb) { undo(); throw myError(ER.NO_DB); }
      checkTableName(to.table);
      if (srv.getTable(tdb, to.table)) { undo(); throw myError(ER.TABLE_EXISTS, frmPath(tdb, to.table)); }
      const share = srv.getTable(fdb, from.table);
      if (!share) { undo(); throw myError(ER.CANT_FIND_FILE, frmPath(fdb, from.table), 2); }
      if (!srv.dbs.has(tdb)) {
        undo();
        throw new SqlError(7, "Error on rename of '" + frmPath(fdb, from.table, '.MYI') + "' to '" + frmPath(tdb, to.table, '.MYI') + "' (Errcode: 2)");
      }
      done.push([share, fdb, from.table]);
      renameShare(srv, share, tdb, to.table);
    }
    return { affected: 0 };
  }

  // mysql_rm_table()
  function execDropTable(conn, st) {
    const srv = conn.srv;
    const wrong = [];
    for (const t of st.tables) {
      const db = t.db || conn.db;
      if (!db) throw myError(ER.NO_DB);
      if (conn.tmpTables.delete(db + '\0' + t.table)) continue;
      if (srv.getTable(db, t.table)) srv.dropTable(db, t.table);
      else if (!st.ifExists) wrong.push(t.table);
    }
    if (wrong.length) throw myError(ER.BAD_TABLE, wrong.join(','));
    return { affected: 0 };
  }

  function execTruncate(conn, st) {
    const db = st.table.db || conn.db;
    if (!db) throw myError(ER.NO_DB);
    return execDelete(conn, { table: st.table, where: null, limit: null });
  }

  // sql_db.cc
  function execCreateDb(conn, name, ifNotExists) {
    checkDbName(name);
    const srv = conn.srv;
    if (srv.dbs.has(name)) {
      if (ifNotExists) return { affected: 0 };
      throw myError(ER.DB_CREATE_EXISTS, name);
    }
    srv.createDb(name);
    return { affected: 1 };
  }
  function execDropDb(conn, name, ifExists) {
    checkDbName(name);
    const srv = conn.srv;
    const d = srv.dbs.get(name);
    if (!d) {
      if (ifExists) return { affected: 0 };
      throw myError(ER.DB_DROP_EXISTS, name);
    }
    let files = 0;
    for (const sh of d.tables.values()) files += sh.options.engine === 'HEAP' ? 1 : 3;
    srv.dropDb(name);
    return { affected: files };
  }

  // ---------------------------------------------------------------------------
  // SHOW and DESCRIBE (sql_show.cc, sql_acl.cc mysql_show_grants(),
  // mysqld.cc init_vars/status_vars)
  // ---------------------------------------------------------------------------
  // Item_empty_string / Item_int / Item_datetime as result columns
  const strCol = (name, len, maybe_null) => ({ table: '', name, length: len, type: T.STRING, flags: maybe_null ? 0 : F.NOT_NULL, decimals: NOT_FIXED_DEC });
  const intCol = (name, len, maybe_null) => ({ table: '', name, length: len, type: T.LONGLONG, flags: maybe_null ? 0 : F.NOT_NULL, decimals: 0 });
  const dtCol = (name, maybe_null) => ({ table: '', name, length: 19, type: T.DATETIME, flags: maybe_null ? 0 : F.NOT_NULL, decimals: 0 });
  const wildName = (name, wild) => (wild ? name + ' (' + wild + ')' : name);
  // wild_compare(): 0 when the name matches (case-sensitive, like file names)
  const wildOk = (s, wild) => !wild || !wild_compare(s, wild, '\\', false);
  const wildCaseOk = (s, wild) => !wild || !wild_compare(s, wild, '\\', true);
  // my_dir() sorts file names with strcmp
  const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  function showDatabases(conn, st) {
    const names = [...conn.srv.dbs.keys()].filter((n) => wildOk(n, st.wild)).sort(byName);
    return { fields: [strCol(wildName('Database', st.wild), NAME_LEN)], rows: names.map((n) => [n]) };
  }
  function showTables(conn, st) {
    const db = st.db || conn.db;
    if (!db) throw myError(ER.NO_DB);
    const fields = [strCol(wildName('Tables_in_' + db, st.wild), NAME_LEN)];
    const d = conn.srv.dbs.get(db);
    // the header is sent before the directory is read
    if (!d) return { fields, rows: [], error: new SqlError(12, "Can't read dir of './" + db + "/' (Errcode: 2)") };
    const names = [...d.tables.keys()].filter((n) => wildOk(n, st.wild)).sort(byName);
    return { fields, rows: names.map((n) => [n]) };
  }
  function openShow(conn, table) {
    const db = table.db || conn.db;
    if (!db) throw myError(ER.NO_DB);
    const share = conn.getTable(db, table.table);
    if (!share) throw myError(ER.NO_SUCH_TABLE, db, table.table);
    return share;
  }
  // the default record's value of a field as val_str() sees it
  function defaultStr(share, f) {
    if (share.record[f.idx] === null) return null;
    const g = f.clone({ record: share.record, null_row: false, alias: share.name, pack_record: share.pack_record, share });
    return g.val_str();
  }
  function showFields(conn, st) {
    const share = openShow(conn, st.table);
    const fields = [strCol('Field', NAME_LEN), strCol('Type', 40), strCol('Null', 1), strCol('Key', 3), strCol('Default', NAME_LEN), strCol('Extra', 20)];
    if (st.full) fields.push(strCol('Privileges', 80));
    const rows = [];
    for (const f of share.fields) {
      if (!wildCaseOk(f.field_name, st.wild)) continue;
      const row = [f.field_name, f.sql_type()];
      row.push((f.flags & F.NOT_NULL) && f.type() !== T.TIMESTAMP ? '' : 'YES');
      row.push(f.flags & F.PRI_KEY ? 'PRI' : f.flags & F.UNIQUE_KEY ? 'UNI' : f.flags & F.MULTIPLE_KEY ? 'MUL' : '');
      const null_default = f.type() === T.TIMESTAMP || f.auto_inc;
      const d = defaultStr(share, f);
      if (!null_default && d !== null) row.push(d);
      else if (f.nullable || null_default) row.push(null);
      else row.push('');
      row.push(f.auto_inc ? 'auto_increment' : '');
      if (st.full) row.push('select,insert,update,references');
      rows.push(row);
    }
    return { fields, rows, extra: share.rows };
  }
  function appendUnescaped(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\0') break;
      out += c === '\n' ? '\\n' : c === '\r' ? '\\r' : c === '\\' ? '\\\\' : c === "'" ? "''" : c;
    }
    return out;
  }
  const quoteId = (conn, name) => (conn.quote_show_create ? '`' + name + '`' : name);
  // store_create_info()
  function createInfo(conn, share) {
    let s = (share.tmp_table ? 'CREATE TEMPORARY TABLE ' : 'CREATE TABLE ') + quoteId(conn, share.name) + ' (\n';
    s += share.fields.map((f) => {
      let c = '  ' + quoteId(conn, f.field_name) + ' ' + f.sql_type();
      const has_default = f.type() !== T.BLOB && f.type() !== T.TIMESTAMP && !f.auto_inc;
      if (f.flags & F.NOT_NULL) c += ' NOT NULL';
      if (has_default) {
        c += ' default ';
        const d = defaultStr(share, f);
        if (d !== null) c += "'" + appendUnescaped(d) + "'";
        else if (f.nullable) c += 'NULL';
      }
      if (f.auto_inc) c += ' auto_increment';
      return c;
    }).join(',\n');
    share.keys.forEach((key, i) => {
      s += ',\n  ';
      const primary = i === share.primary_key && key.name === 'PRIMARY';
      if (primary) s += 'PRIMARY ';
      else if (key.flags & HA_NOSAME) s += 'UNIQUE ';
      else if (key.flags & HA_FULLTEXT) s += 'FULLTEXT ';
      s += 'KEY ';
      if (!primary) s += quoteId(conn, key.name);
      s += ' (' + key.parts.map((p) => {
        const f = share.fields[p.field];
        let c = quoteId(conn, f.field_name);
        if (p.length && p.length !== f.pack_length() && !(key.flags & HA_FULLTEXT)) c += '(' + p.length + ')';
        return c;
      }).join(',') + ')';
    });
    s += '\n) TYPE=' + share.options.engine;
    const o = share.options;
    if (o.min_rows) s += ' MIN_ROWS=' + o.min_rows;
    if (o.max_rows) s += ' MAX_ROWS=' + o.max_rows;
    if (o.avg_row_length) s += ' AVG_ROW_LENGTH=' + o.avg_row_length;
    if (o.PACK_KEYS_SYM !== undefined) s += o.PACK_KEYS_SYM ? ' PACK_KEYS=1' : ' PACK_KEYS=0';
    if (o.CHECKSUM_SYM) s += ' CHECKSUM=1';
    if (o.DELAY_KEY_WRITE_SYM) s += ' DELAY_KEY_WRITE=1';
    if (o.row_format && o.row_format !== 'DEFAULT') s += ' ROW_FORMAT=' + o.row_format;
    if (o.comment) s += " COMMENT='" + appendUnescaped(o.comment) + "'";
    return s;
  }
  function showCreate(conn, st) {
    const share = openShow(conn, st.table);
    return { fields: [strCol('Table', NAME_LEN), strCol('Create Table', 1024)], rows: [[share.name, createInfo(conn, share)]] };
  }
  function showKeys(conn, st) {
    const share = openShow(conn, st.table);
    const fields = [strCol('Table', NAME_LEN), intCol('Non_unique', 1), strCol('Key_name', NAME_LEN), intCol('Seq_in_index', 2),
      strCol('Column_name', NAME_LEN), strCol('Collation', 1, true), intCol('Cardinality', 11, true), intCol('Sub_part', 3, true),
      strCol('Packed', 10, true), strCol('Comment', 255)];
    const rows = [];
    for (const key of share.keys) {
      key.parts.forEach((p, j) => {
        const f = share.fields[p.field];
        // rec_per_key is only known for the last part of a unique key without NULLs
        const heap = share.options.engine === 'HEAP';
        const known = !heap && (key.flags & (HA_NOSAME | HA_NULL_PART_KEY)) === HA_NOSAME && j === key.parts.length - 1;
        rows.push([share.name, key.flags & HA_NOSAME ? '0' : '1', key.name, String(j + 1), f.field_name, heap ? null : 'A',
          known ? String(share.rows) : null, p.length && p.length !== f.pack_length() ? String(p.length) : null, null,
          key.flags & HA_FULLTEXT ? 'FULLTEXT' : '']);
      });
    }
    return { fields, rows };
  }
  function tableStatusRow(share) {
    const rows = share.rows;
    const data = share.dataLength();
    const fixed = !share.pack_record;
    const rec = share.reclength();
    const free = share.dataFree();
    const opts = [];
    const o = share.options;
    if (o.min_rows) opts.push('min_rows=' + o.min_rows);
    if (o.max_rows) opts.push('max_rows=' + o.max_rows);
    if (o.avg_row_length) opts.push('avg_row_length=' + o.avg_row_length);
    if (o.PACK_KEYS_SYM !== undefined) opts.push('pack_keys=' + (o.PACK_KEYS_SYM ? 1 : 0));
    if (o.CHECKSUM_SYM) opts.push('checksum=1');
    if (o.DELAY_KEY_WRITE_SYM) opts.push('delay_key_write=1');
    if (o.row_format && o.row_format !== 'DEFAULT') opts.push('row_format=' + { FIXED: 'FIXED', DYNAMIC: 'DYNAMIC', COMPRESSED: 'COMPRESSED' }[o.row_format]);
    const time = (t) => (t ? fmtDateTime(tmToTime(THD.tz.localtime(t))) : null);
    return [share.name, share.options.engine, fixed ? 'Fixed' : 'Dynamic', String(rows), String(rows ? Math.floor((data - free) / rows) : 0), String(data),
      fixed ? String(BigInt(rec) * 4294967296n - 1n) : '4294967295', String(1024 * (1 + (rows ? share.keys.length : 0))), String(free),
      share.auto_field >= 0 ? String(share.auto_increment) : null, time(share.create_time), time(share.update_time), null,
      opts.join(' '), o.comment || ''];
  }
  function showTableStatus(conn, st) {
    const db = st.db || conn.db;
    if (!db) throw myError(ER.NO_DB);
    const fields = [strCol('Name', NAME_LEN, true), strCol('Type', 10, true), strCol('Row_format', 10, true), intCol('Rows', 21, true),
      intCol('Avg_row_length', 21, true), intCol('Data_length', 21, true), intCol('Max_data_length', 21, true), intCol('Index_length', 21, true),
      intCol('Data_free', 21, true), intCol('Auto_increment', 21, true), dtCol('Create_time', true), dtCol('Update_time', true),
      dtCol('Check_time', true), strCol('Create_options', 255, true), strCol('Comment', 80)];
    const d = conn.srv.dbs.get(db);
    if (!d) return { fields, rows: [], error: new SqlError(12, "Can't read dir of './" + db + "/' (Errcode: 2)") };
    const names = [...d.tables.keys()].filter((n) => wildOk(n, st.wild)).sort(byName);
    return { fields, rows: names.map((n) => tableStatusRow(d.tables.get(n))) };
  }
  function showOpenTables(conn, st) {
    const db = st.db || conn.db;
    if (!db) throw myError(ER.NO_DB);
    return { fields: [strCol(wildName('Open_tables_in_' + db, st.wild), NAME_LEN), strCol('Comment', 80)], rows: [] };
  }

  // SHOW VARIABLES: the values of a default MySQL 3.23.49 (observed), with
  // this server's paths and time zone
  function variables(conn) {
    const srv = conn.srv;
    return [
      ['back_log', '50'], ['basedir', '/usr/local/mysql/'], ['binlog_cache_size', '32768'], ['character_set', 'latin1'],
      ['character_sets', 'latin1 dec8 dos german1 hp8 koi8_ru latin2 swe7 usa7 cp1251 danish hebrew win1251 estonia hungarian koi8_ukr win1251ukr greek win1250 croat cp1257 latin5'],
      ['concurrent_insert', 'ON'], ['connect_timeout', '5'], ['datadir', srv.datadir], ['delay_key_write', 'ON'],
      ['delayed_insert_limit', '100'], ['delayed_insert_timeout', '300'], ['delayed_queue_size', '1000'], ['flush', 'OFF'],
      ['flush_time', '0'], ['have_bdb', 'NO'], ['have_gemini', 'NO'], ['have_innodb', 'NO'], ['have_isam', 'YES'], ['have_raid', 'NO'],
      ['have_openssl', 'NO'], ['init_file', ''], ['interactive_timeout', '28800'], ['join_buffer_size', '131072'],
      ['key_buffer_size', '8388600'], ['language', '/usr/local/mysql/share/mysql/english/'], ['large_files_support', 'ON'],
      ['locked_in_memory', 'OFF'], ['log', 'OFF'], ['log_update', 'OFF'], ['log_bin', 'OFF'], ['log_slave_updates', 'OFF'],
      ['log_long_queries', 'OFF'], ['long_query_time', '10'], ['low_priority_updates', 'OFF'], ['lower_case_table_names', '0'],
      ['max_allowed_packet', '1048576'], ['max_binlog_cache_size', '4294967295'], ['max_binlog_size', '1073741824'],
      ['max_connections', '100'], ['max_connect_errors', '10'], ['max_delayed_threads', '20'], ['max_heap_table_size', '16777216'],
      ['max_join_size', '4294967295'], ['max_sort_length', '1024'], ['max_user_connections', '0'], ['max_tmp_tables', '32'],
      ['max_write_lock_count', '4294967295'], ['myisam_max_extra_sort_file_size', '256'], ['myisam_max_sort_file_size', '2047'],
      ['myisam_recover_options', '0'], ['myisam_sort_buffer_size', '8388608'], ['net_buffer_length', '16384'],
      ['net_read_timeout', '30'], ['net_retry_count', '10'], ['net_write_timeout', '60'], ['open_files_limit', '0'],
      ['pid_file', srv.datadir + srv.hostname + '.pid'], ['port', '3306'], ['protocol_version', '10'], ['record_buffer', '131072'],
      ['record_rnd_buffer', '131072'], ['query_buffer_size', '0'], ['safe_show_database', 'OFF'], ['server_id', '0'],
      ['slave_net_timeout', '3600'], ['skip_locking', 'ON'], ['skip_networking', 'OFF'], ['skip_show_database', 'OFF'],
      ['slow_launch_time', '2'], ['socket', '/tmp/mysql.sock'], ['sort_buffer', '2097144'], ['sql_mode', '0'], ['table_cache', '64'],
      ['table_type', 'MYISAM'], ['thread_cache_size', '0'], ['thread_stack', '65536'], ['transaction_isolation', 'READ-COMMITTED'],
      ['timezone', THD.tz.abbrev(srv.started)], ['tmp_table_size', '33554432'], ['tmpdir', '/tmp/'], ['version', SERVER_VERSION],
      ['wait_timeout', '28800']];
  }
  const STATUS_NAMES = ('Aborted_clients Aborted_connects Bytes_received Bytes_sent Com_admin_commands Com_alter_table Com_analyze ' +
    'Com_backup_table Com_begin Com_change_db Com_change_master Com_check Com_commit Com_create_db Com_create_function ' +
    'Com_create_index Com_create_table Com_delete Com_drop_db Com_drop_function Com_drop_index Com_drop_table Com_flush Com_grant ' +
    'Com_insert Com_insert_select Com_kill Com_load Com_load_master_table Com_lock_tables Com_optimize Com_purge Com_rename_table ' +
    'Com_repair Com_replace Com_replace_select Com_reset Com_restore_table Com_revoke Com_rollback Com_select Com_set_option ' +
    'Com_show_binlogs Com_show_create Com_show_databases Com_show_fields Com_show_grants Com_show_keys Com_show_logs ' +
    'Com_show_master_stat Com_show_open_tables Com_show_processlist Com_show_slave_stat Com_show_status Com_show_tables ' +
    'Com_show_variables Com_slave_start Com_slave_stop Com_truncate Com_unlock_tables Com_update Connections ' +
    'Created_tmp_disk_tables Created_tmp_tables Created_tmp_files Delayed_insert_threads Delayed_writes Delayed_errors ' +
    'Flush_commands Handler_delete Handler_read_first Handler_read_key Handler_read_next Handler_read_prev Handler_read_rnd ' +
    'Handler_read_rnd_next Handler_update Handler_write Key_blocks_used Key_read_requests Key_reads Key_write_requests Key_writes ' +
    'Max_used_connections Not_flushed_key_blocks Not_flushed_delayed_rows Open_tables Open_files Open_streams Opened_tables ' +
    'Questions Select_full_join Select_full_range_join Select_range Select_range_check Select_scan Slave_running ' +
    'Slave_open_temp_tables Slow_launch_threads Slow_queries Sort_merge_passes Sort_range Sort_rows Sort_scan ' +
    'Table_locks_immediate Table_locks_waited Threads_cached Threads_created Threads_connected Threads_running Uptime').split(' ');
  // statement kinds counted in Com_*
  const COM_OF = { select: 'Com_select', insert: 'Com_insert', replace: 'Com_replace', update: 'Com_update', delete: 'Com_delete',
    create_table: 'Com_create_table', alter: 'Com_alter_table', drop_table: 'Com_drop_table', create_index: 'Com_create_index',
    drop_index: 'Com_drop_index', create_db: 'Com_create_db', drop_db: 'Com_drop_db', rename: 'Com_rename_table',
    truncate: 'Com_truncate', set: 'Com_set_option', lock: 'Com_lock_tables', unlock: 'Com_unlock_tables', use: 'Com_change_db',
    show_databases: 'Com_show_databases', show_tables: 'Com_show_tables', show_fields: 'Com_show_fields', show_keys: 'Com_show_keys',
    show_variables: 'Com_show_variables', show_status: 'Com_show_status', show_processlist: 'Com_show_processlist',
    show_grants: 'Com_show_grants', show_create: 'Com_show_create', show_table_status: 'Com_show_tables', flush: 'Com_flush',
    grant: 'Com_grant', revoke: 'Com_revoke', begin: 'Com_begin', commit: 'Com_commit', rollback: 'Com_rollback', kill: 'Com_kill',
    load: 'Com_load', show_open_tables: 'Com_show_open_tables', show_logs: 'Com_show_logs' };
  function showVariables(conn, st) {
    const rows = variables(conn).filter((v) => wildCaseOk(v[0], st.wild));
    return { fields: [strCol('Variable_name', 30), strCol('Value', 256)], rows };
  }
  function showStatus(conn, st) {
    const srv = conn.srv;
    const up = Math.max(1, nowSeconds() - srv.started);
    const special = { Uptime: up, Threads_connected: srv.conns.size || 1, Threads_running: 1, Threads_created: srv.threadsCreated,
      Connections: srv.nextThread - 1, Questions: srv.questions, Opened_tables: srv.opened, Slave_running: 'OFF', Flush_commands: 1,
      Max_used_connections: srv.maxUsed };
    const rows = STATUS_NAMES.filter((n) => wildCaseOk(n, st.wild)).map((n) => [n, String(n in special ? special[n] : srv.status[n] || 0)]);
    return { fields: [strCol('Variable_name', 30), strCol('Value', 256)], rows };
  }
  function showProcesslist(conn, st) {
    const width = st.full ? 1048576 : 100;
    const fields = [intCol('Id', 7), strCol('User', 16), strCol('Host', 64), strCol('db', NAME_LEN, true), strCol('Command', 16),
      strCol('Time', 7), strCol('State', 30, true), strCol('Info', width, true)];
    const now = nowSeconds();
    const rows = [...conn.srv.conns].map((c) => {
      const active = c === conn;
      return [String(c.threadId), c.user, 'localhost', c.db, active ? 'Query' : 'Sleep', String(now - (active ? THD.query_start : c.lastActive)),
        active ? null : '', active ? conn.query.slice(0, width) : null];
    });
    return { fields, rows };
  }
  const PRIVS = ['Select', 'Insert', 'Update', 'Delete', 'Create', 'Drop', 'Reload', 'Shutdown', 'Process', 'File', 'Grant', 'References', 'Index', 'Alter'];
  // mysql_show_grants(): from the grant tables
  function showGrants(conn, st) {
    const user = st.user, host = st.host === null ? '%' : st.host;
    const srv = conn.srv;
    const users = srv.getTable('mysql', 'user');
    const readRows = (share) => {
      if (!share) return [];
      const t = new TableInst(share, share.name);
      return [...share.scan()].map(({ rec }) => {
        t.record = rec;
        const o = {};
        for (const f of t.fields) o[f.field_name] = f.val_str();
        return o;
      });
    };
    const u = readRows(users).find((r) => r.User === user && r.Host === host);
    if (!u) throw myError(ER.NONEXISTING_GRANT, user, host);
    const privList = (r, names) => {
      const have = names.filter((p) => p !== 'Grant' && r[p + '_priv'] === 'Y');
      if (have.length === names.filter((p) => p !== 'Grant').length) return 'ALL PRIVILEGES';
      return have.length ? have.map((p) => p.toUpperCase()).join(', ') : null;
    };
    const to = " TO '" + user + "'@'" + host + "'";
    let g = 'GRANT ' + (privList(u, PRIVS) || 'USAGE') + ' ON *.*' + to;
    if (u.Password) g += " IDENTIFIED BY PASSWORD '" + u.Password + "'";
    if (u.Grant_priv === 'Y') g += ' WITH GRANT OPTION';
    const rows = [[g]];
    const DB_PRIVS = ['Select', 'Insert', 'Update', 'Delete', 'Create', 'Drop', 'Grant', 'References', 'Index', 'Alter'];
    for (const r of readRows(srv.getTable('mysql', 'db'))) {
      if (r.User !== user || r.Host !== host) continue;
      const list = privList(r, DB_PRIVS);
      if (!list && r.Grant_priv !== 'Y') continue;
      rows.push(['GRANT ' + (list || '') + ' ON ' + r.Db + '.*' + to + (r.Grant_priv === 'Y' ? ' WITH GRANT OPTION' : '')]);
    }
    return { fields: [strCol('Grants for ' + user + '@' + host, 1024)], rows };
  }
  function showLogs() {
    return { fields: [strCol('File', 512), strCol('Type', 10), strCol('Status', 10)], rows: [] };
  }
  function showMasterStatus() {
    return { fields: [strCol('File', 512), intCol('Position', 20), strCol('Binlog_do_db', 255), strCol('Binlog_ignore_db', 255)],
      rows: [[null, null, null, null]] };
  }
  function showSlaveStatus() {
    return { fields: [strCol('Master_Host', 60), strCol('Master_User', 16), intCol('Master_Port', 6), intCol('Connect_retry', 6),
      strCol('Log_File', 512), intCol('Pos', 7), strCol('Slave_Running', 3), strCol('Replicate_do_db', 255),
      strCol('Replicate_ignore_db', 255), intCol('Last_errno', 4), strCol('Last_error', 255), intCol('Skip_counter', 12)],
    rows: [['', '', '0', '0', '', '0', 'No', '', '', '0', '', '0']] };
  }
  // mysqld_list_fields(): COM_FIELD_LIST
  function listFields(conn, table, wild) {
    const share = openShow(conn, { db: null, table });
    const t = new TableInst(share, share.name);
    t.db = share.db;
    return t.fields.filter((f) => wildCaseOk(f.field_name, wild)).map((f) => {
      const d = f.make_field();
      d.def = defaultStr(share, f);
      if (f.type() === T.TIMESTAMP || f.auto_inc) d.def = defaultStr(share, f);
      return d;
    });
  }

  // ---------------------------------------------------------------------------
  // The server: databases, persistence, connections
  // ---------------------------------------------------------------------------
  const CAPS = 1 | 2 | 4 | 8 | 16 | 64 | 128 | 256 | 8192; // LONG_PASSWORD FOUND_ROWS LONG_FLAG CONNECT_WITH_DB NO_SCHEMA ODBC LOCAL_FILES IGNORE_SPACE TRANSACTIONS
  const CLIENT_LONG_FLAG = 4, CLIENT_CONNECT_WITH_DB = 8, CLIENT_TRANSACTIONS = 8192, CLIENT_FOUND_ROWS = 2;
  const SERVER_STATUS_AUTOCOMMIT = 2;
  const DB_PATH = /^\/var\/lib\/mysql\/([^/]+)\.sqlite$/;
  const sqlQuote = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  const sqliteId = (s) => '"' + String(s).replace(/"/g, '""') + '"';

  class MysqlServer {
    constructor(SQL) {
      this.SQL = SQL;
      this.dbs = new Map();          // name -> { name, tables: Map(name -> TableShare) }
      this.loaded = new Map();       // name -> the bytes last loaded or exported
      this.dirtyDbs = new Set();
      this.nextThread = 1;
      this.started = nowSeconds();
      this.questions = 0;
      this.conns = new Set();
      this.status = {};
      this.threadsCreated = 0;
      this.maxUsed = 0;
      this.opened = 0;
      this.pid = 4242;
      this.hostname = 'simphp';
      this.datadir = '/var/lib/mysql/';
      this.tz = new TimeZone('UTC');
      this.userLocks = new Map();
      this.files = null;
      this.fs = null;
      this.outfiles = new Map();
    }
    // the time zone mysqld runs in (its TZ environment variable)
    setTimeZone(name) {
      if (!name) name = 'UTC';
      if (this.tz.name !== name) this.tz = new TimeZone(name);
    }

    // --- storage ------------------------------------------------------------
    // files: { '/var/lib/mysql/<db>.sqlite': Uint8Array|{data} } (the simulated disk)
    syncFrom(files) {
      this.files = files || {};
      const seen = new Set();
      for (const [path, f] of Object.entries(this.files)) {
        const m = path.match(DB_PATH);
        if (!m || !f) continue;
        const name = m[1];
        const bytes = f.data !== undefined ? f.data : f;
        seen.add(name);
        const prev = this.loaded.get(name);
        if (this.dbs.has(name) && prev && (prev === bytes || (prev.length === bytes.length && prev.every((b, i) => b === bytes[i])))) continue;
        this.loaded.set(name, bytes);
        this.dbs.set(name, { name, tables: new Map() });
        try { this.decodeDb(name, bytes); } catch (e) { /* an unreadable file is an empty database */ }
      }
      for (const name of [...this.dbs.keys()]) {
        if (!seen.has(name) && this.loaded.has(name)) { this.dbs.delete(name); this.loaded.delete(name); }
      }
      if (!this.dbs.size) this.initDefaultDatabases();
    }
    exportTo(out) {
      for (const name of this.dirtyDbs) {
        const path = '/var/lib/mysql/' + name + '.sqlite';
        const d = this.dbs.get(name);
        if (!d) { delete out[path]; this.loaded.delete(name); continue; }
        const bytes = this.encodeDb(d);
        this.loaded.set(name, bytes);
        out[path] = { data: bytes, mtime: Date.now() };
      }
      for (const name of this.dbs.keys()) {
        const path = '/var/lib/mysql/' + name + '.sqlite';
        if (!(path in out) && this.loaded.has(name)) out[path] = { data: this.loaded.get(name), mtime: Date.now() };
      }
      for (const [path, data] of this.outfiles) out[path] = { data, mtime: Date.now() };
      this.outfiles.clear();
      this.dirtyDbs.clear();
      return out;
    }
    encodeDb(d) {
      const db = new this.SQL.Database();
      try {
        db.run('CREATE TABLE __mysql (name TEXT PRIMARY KEY, def TEXT)');
        for (const sh of d.tables.values()) {
          db.run('INSERT INTO __mysql (name, def) VALUES (?, ?)', [sh.name, shareToJSON(sh)]);
          const cols = sh.fields.map((f, i) => 'c' + i);
          db.run('CREATE TABLE ' + sqliteId('t:' + sh.name) + ' (pos INTEGER PRIMARY KEY' + cols.map((c) => ', ' + c).join('') + ')');
          const stmt = db.prepare('INSERT INTO ' + sqliteId('t:' + sh.name) + ' VALUES (?' + ', ?'.repeat(cols.length) + ')');
          try { for (const { pos, rec } of sh.scan()) stmt.run([pos, ...rec.map(encodeValue)]); } finally { stmt.free(); }
        }
        return db.export();
      } finally { db.close(); }
    }
    decodeDb(name, bytes) {
      const sdb = new this.SQL.Database(bytes);
      const d = this.dbs.get(name);
      let legacy = null;
      try {
        const has = (t) => sdb.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = " + sqlQuote(t)).length > 0;
        if (has('__mysql')) {
          const r = sdb.exec('SELECT name, def FROM __mysql');
          for (const [tname, json] of r.length ? r[0].values : []) {
            const sh = shareFromJSON(name, tname, json);
            const rows = sdb.exec('SELECT * FROM ' + sqliteId('t:' + tname));
            let n = 0;
            for (const row of rows.length ? rows[0].values : []) { sh.slots[row[0]] = row.slice(1).map(decodeValue); n++; }
            sh.count = n;
            d.tables.set(tname, sh);
          }
        } else if (has('__simphp_meta')) legacy = this.readLegacy(sdb);
      } finally { sdb.close(); }
      if (legacy) this.migrateLegacy(name, legacy);
    }
    // databases written by the earlier emulator (a SQLite table per MySQL table
    // plus column definitions in __simphp_meta)
    readLegacy(sdb) {
      const out = [];
      const r = sdb.exec('SELECT tbl, def FROM __simphp_meta');
      for (const [tbl, json] of r.length ? r[0].values : []) {
        try {
          const meta = JSON.parse(json);
          const rows = sdb.exec('SELECT * FROM ' + sqliteId(tbl));
          out.push({ meta, columns: rows.length ? rows[0].columns : [], rows: rows.length ? rows[0].values : [] });
        } catch (e) { /* skip */ }
      }
      return out;
    }
    migrateLegacy(db, tables) {
      const conn = new Connection(this, { internal: true });
      conn.db = db;
      const lit = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v)
        : "'" + (v instanceof Uint8Array ? bytesToStr(v) : String(v)).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\0/g, '\\0') + "'");
      for (const { meta, columns, rows } of tables) {
        try {
          const defs = meta.columns.map((c) => {
            let s = '`' + c.name + '` ' + c.display;
            if (c.notNull) s += ' NOT NULL';
            if (c.def !== null && c.def !== undefined && !c.autoInc && c.kind !== 'timestamp') s += ' default ' + lit(String(c.def));
            if (c.autoInc) s += ' auto_increment';
            return s;
          });
          for (const k of meta.keys || []) {
            const cols = k.cols.map((x) => '`' + x + '`').join(',');
            defs.push(k.kind === 'PRI' ? 'PRIMARY KEY (' + cols + ')' : (k.kind === 'UNI' ? 'UNIQUE ' : 'KEY ') + '`' + k.name + '` (' + cols + ')');
          }
          conn.execute('CREATE TABLE `' + meta.name + '` (' + defs.join(', ') + ')');
          const names = meta.columns.map((c) => c.name);
          const idx = names.map((n) => columns.indexOf(n));
          for (const row of rows) {
            conn.execute('INSERT INTO `' + meta.name + '` (' + names.map((n) => '`' + n + '`').join(',') + ') VALUES (' +
              idx.map((i) => lit(i >= 0 ? row[i] : null)).join(',') + ')');
          }
        } catch (e) { /* keep what could be converted */ }
      }
      this.dirtyDbs.add(db);
    }
    initDefaultDatabases() {
      // mysql_install_db: the grant tables and an empty `test`
      this.createDb('mysql');
      const conn = new Connection(this, { internal: true });
      conn.db = 'mysql';
      for (const q of INSTALL_SQL) conn.execute(q.replace(/;\s*$/, ''));
      this.createDb('test');
    }
    createDb(name) { this.dbs.set(name, { name, tables: new Map() }); this.dirtyDbs.add(name); }
    dropDb(name) { this.dbs.delete(name); this.dirtyDbs.add(name); }
    getTable(db, name) { const d = this.dbs.get(db); return (d && d.tables.get(name)) || null; }
    addTable(sh) { this.dbs.get(sh.db).tables.set(sh.name, sh); this.dirtyDbs.add(sh.db); }
    dropTable(db, name) { const d = this.dbs.get(db); if (d) d.tables.delete(name); this.dirtyDbs.add(db); }
    // Files on the simulated machine. While PHP runs, simphp-core gives the
    // server its file system (fs: read/stat/write); otherwise the files it
    // was synced from are read, and files written go out with exportTo().
    fileRead(path) {
      if (this.fs) { const d = this.fs.read(path); return d === null ? null : bytesToStr(d); }
      if (this.outfiles.has(path)) return bytesToStr(this.outfiles.get(path));
      const f = this.files && this.files[path];
      if (!f) return null;
      const d = f.data !== undefined ? f.data : f;
      return typeof d === 'string' ? d : bytesToStr(d);
    }
    fileStat(path) {
      if (this.fs) return this.fs.stat(path);
      return this.outfiles.has(path) || (this.files && this.files[path]) ? { mode: 0o100644 } : null;
    }
    // 0 or an errno
    fileWrite(path, str) {
      if (this.fs) return this.fs.write(path, strToBytes(str));
      this.outfiles.set(path, strToBytes(str));
      return 0;
    }
    connect() { return new Connection(this); }
  }

  // ---------------------------------------------------------------------------
  // A client connection: the wire protocol and the statements
  // ---------------------------------------------------------------------------
  class Connection {
    constructor(server, opts = {}) {
      this.srv = server;
      this.internal = !!opts.internal;
      // (the bootstrap connection of mysql_install_db is not a thread)
      this.threadId = opts.internal ? 0 : server.nextThread++;
      this.db = null;
      this.user = 'root';
      this.host = 'localhost';
      this.inbuf = new Uint8Array(0);
      this.out = [];
      this.outLen = 0;
      this.authed = false;
      this.closed = false;
      this.clientFlags = CAPS;
      this.query = '';
      this.lastActive = nowSeconds();
      // THD state
      this.last_insert_id = 0n;
      this.insert_id_used = false;
      this.next_insert_id = 0n;
      this.user_vars = new Map();
      this.tmp_table = 0;
      this.tmpTables = new Map();
      this.quote_show_create = true;
      this.select_limit = null;
      this.locks = null;
      this.user_time = 0;
      this.rand = {};
      randominit(this.rand, server.started + this.threadId, server.started + this.threadId);
      if (!this.internal) {
        server.threadsCreated++;
        this.scramble = Array.from({ length: 8 }, () => String.fromCharCode(33 + Math.floor(Math.random() * 90))).join('');
        this.greet();
      }
    }
    getTable(db, name) { return this.tmpTables.get(db + '\0' + name) || this.srv.getTable(db, name); }
    dirty(share) { if (!share.tmp_table) this.srv.dirtyDbs.add(share.db); }

    // --- framing -------------------------------------------------------------
    send(payload, seq) {
      const b = typeof payload === 'string' ? strToBytes(payload) : payload;
      // packets over 16M are not needed here (max_allowed_packet is 1M)
      const hdr = new Uint8Array([b.length & 255, (b.length >> 8) & 255, (b.length >> 16) & 255, seq & 255]);
      this.out.push(hdr, b);
      this.outLen += 4 + b.length;
    }
    read(max) {
      const buf = new Uint8Array(Math.min(max, this.outLen));
      let o = 0;
      while (o < buf.length && this.out.length) {
        const head = this.out[0];
        const take = Math.min(head.length, buf.length - o);
        buf.set(head.subarray(0, take), o);
        o += take;
        if (take === head.length) this.out.shift(); else this.out[0] = head.subarray(take);
      }
      this.outLen -= o;
      return buf;
    }
    write(bytes) {
      const merged = new Uint8Array(this.inbuf.length + bytes.length);
      merged.set(this.inbuf);
      merged.set(bytes, this.inbuf.length);
      this.inbuf = merged;
      while (this.inbuf.length >= 4) {
        const len = this.inbuf[0] | (this.inbuf[1] << 8) | (this.inbuf[2] << 16);
        if (this.inbuf.length < 4 + len) break;
        const seq = this.inbuf[3];
        const payload = this.inbuf.slice(4, 4 + len);
        this.inbuf = this.inbuf.slice(4 + len);
        this.onPacket(payload, seq);
      }
    }
    close() {
      if (this.closed && !this.srv.conns.has(this)) return;
      this.closed = true;
      this.srv.conns.delete(this);
      for (const [k, v] of this.srv.userLocks) if (v === this) this.srv.userLocks.delete(k);
    }

    lenc(n) {
      n = BigInt(n);
      if (n < 251n) return String.fromCharCode(Number(n));
      if (n < 65536n) return '\xfc' + this.int2(Number(n));
      if (n < 16777216n) return '\xfd' + this.int3(Number(n));
      let s = '\xfe';
      for (let i = 0; i < 8; i++) { s += String.fromCharCode(Number(n & 255n)); n >>= 8n; }
      return s;
    }
    lstr(s) { return s === null ? '\xfb' : this.lenc(s.length) + s; }
    int2(n) { return String.fromCharCode(n & 255, (n >> 8) & 255); }
    int3(n) { return String.fromCharCode(n & 255, (n >> 8) & 255, (n >> 16) & 255); }
    int4(n) { return String.fromCharCode(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255); }

    greet() {
      const p = String.fromCharCode(PROTOCOL_VERSION) + SERVER_VERSION + '\0' + this.int4(this.threadId) +
        this.scramble + '\0' + this.int2(CAPS) + '\x08' + this.int2(SERVER_STATUS_AUTOCOMMIT) + '\0'.repeat(13);
      this.send(p, 0);
    }
    // send_ok()
    ok(seq, affected = 0, insertId = 0, info = '') {
      let p = '\0' + this.lenc(affected) + this.lenc(insertId);
      if (this.clientFlags & CLIENT_TRANSACTIONS) p += this.int2(SERVER_STATUS_AUTOCOMMIT);
      if (info) p += this.lstr(info);
      this.send(p, seq);
    }
    err(seq, code, msg) { this.send('\xff' + this.int2(code) + msg.slice(0, 199), seq); }
    eof(seq) { this.send('\xfe', seq); }
    // send_fields(): one field packet
    fieldPacket(f, withDefault) {
      let p = this.lstr(f.table || '') + this.lstr(f.name) + this.lstr(this.int3(Math.min(f.length || 0, 0xffffff))) +
        this.lstr(String.fromCharCode(f.type));
      if (this.clientFlags & CLIENT_LONG_FLAG) p += this.lstr(this.int2(f.flags & 0xffff) + String.fromCharCode(f.decimals || 0));
      else p += this.lstr(String.fromCharCode(f.flags & 255) + String.fromCharCode(f.decimals || 0));
      if (withDefault) p += this.lstr(f.def === undefined ? null : f.def);
      return p;
    }
    sendResult(res, seq) {
      this.send(this.lenc(res.fields.length) + (res.extra !== undefined ? this.lenc(res.extra) : ''), seq++);
      for (const f of res.fields) this.send(this.fieldPacket(f, false), seq++);
      this.eof(seq++);
      if (res.error) return this.err(seq, res.error.code, res.error.message);
      for (const row of res.rows) {
        let p = '';
        for (const v of row) p += this.lstr(v === null || typeof v === 'string' ? v : v.val_str());
        this.send(p, seq++);
      }
      this.eof(seq++);
    }

    // --- commands (sql_parse.cc do_command()) ---------------------------------
    onPacket(p, seq) {
      const s = bytesToStr(p);
      this.lastActive = nowSeconds();
      if (!this.authed) return this.handshake(p, s, seq);
      if (this.pendingLoad) {
        if (p.length) { this.pendingLoad.chunks.push(s); return undefined; }
        const { st, chunks } = this.pendingLoad;
        this.pendingLoad = null;
        try {
          THD.conn = this;
          const r = execLoad(this, st, chunks.join(''));
          return this.ok(seq + 1, r.affected, 0, r.info);
        } catch (e) {
          if (e instanceof SqlError) return this.err(seq + 1, e.code, e.message);
          return this.err(seq + 1, ER.UNKNOWN_ERROR, ERRMSG[ER.UNKNOWN_ERROR - 1000]);
        } finally { THD.count_cuted_fields = false; }
      }
      const cmd = p[0];
      const arg = s.slice(1);
      const srv = this.srv;
      srv.questions++;
      try {
        switch (cmd) {
          case 1: this.close(); return undefined;                            // COM_QUIT
          case 2:                                                             // COM_INIT_DB
            this.beginStatement(arg);
            this.changeDb(arg);
            return this.ok(seq + 1);
          case 3: {                                                           // COM_QUERY
            const res = this.execute(arg);
            if (res.localFile !== undefined) {
              // LOAD DATA LOCAL: ask the client for the file (packets up to an empty one)
              this.pendingLoad = { st: res.st, chunks: [] };
              return this.send('\xfb' + res.localFile, seq + 1);
            }
            if (res.fields) return this.sendResult(res, seq + 1);
            return this.ok(seq + 1, res.affected || 0, res.insertId || 0, res.info || '');
          }
          case 4: {                                                           // COM_FIELD_LIST
            const z = arg.indexOf('\0');
            const table = z < 0 ? arg : arg.slice(0, z);
            const wild = z < 0 ? '' : arg.slice(z + 1).replace(/\0.*$/, '');
            this.beginStatement(arg);
            if (!this.db) throw myError(ER.NO_DB);
            const fields = listFields(this, table, wild);
            let q = seq + 1;
            for (const f of fields) this.send(this.fieldPacket(f, true), q++);
            return this.eof(q);
          }
          case 5: {                                                           // COM_CREATE_DB
            this.beginStatement(arg);
            const r = execCreateDb(this, arg, false);
            return this.ok(seq + 1, r.affected);
          }
          case 6: {                                                           // COM_DROP_DB
            this.beginStatement(arg);
            const r = execDropDb(this, arg, false);
            return this.ok(seq + 1, r.affected);
          }
          case 7: case 13: case 14: return this.ok(seq + 1);                 // REFRESH DEBUG PING
          case 8: return this.ok(seq + 1);                                   // SHUTDOWN
          case 9: {                                                           // COM_STATISTICS
            const up = Math.max(1, nowSeconds() - srv.started);
            const opened = [...srv.dbs.values()].reduce((n, d) => n + d.tables.size, 0);
            const txt = 'Uptime: ' + up + '  Threads: ' + Math.max(1, srv.conns.size) + '  Questions: ' + srv.questions +
              '  Slow queries: 0  Opens: ' + opened + '  Flush tables: 1  Open tables: ' + opened + ' Queries per second avg: ' +
              fmtF(srv.questions / up, 3);
            return this.send(txt, seq + 1);
          }
          case 10:                                                            // COM_PROCESS_INFO
            this.beginStatement('');
            return this.sendResult(showProcesslist(this, { full: false }), seq + 1);
          case 12: {                                                          // COM_PROCESS_KILL
            this.beginStatement('');
            this.kill((p[1] | (p[2] << 8) | (p[3] << 16) | (p[4] << 24)) >>> 0);
            return this.ok(seq + 1);
          }
          case 17: {                                                          // COM_CHANGE_USER
            const u = arg.indexOf('\0');
            this.user = arg.slice(0, u);
            const pw = arg.indexOf('\0', u + 1);
            const db = pw >= 0 ? arg.slice(pw + 1).replace(/\0.*$/, '') : '';
            if (db) this.changeDb(db);
            return this.ok(seq + 1);
          }
          default: return this.err(seq + 1, ER.UNKNOWN_COM, ERRMSG[ER.UNKNOWN_COM - 1000]);
        }
      } catch (e) {
        if (e instanceof SqlError) return this.err(seq + 1, e.code, e.message);
        if (typeof process !== 'undefined' && process.env && process.env.SIMPHP_MYSQL_DEBUG) console.error(e);
        return this.err(seq + 1, ER.UNKNOWN_ERROR, ERRMSG[ER.UNKNOWN_ERROR - 1000]);
      } finally {
        THD.count_cuted_fields = false;
      }
    }
    // check_connection(): any user and password are accepted (the simulator
    // has no accounts to check them against)
    handshake(p, s, seq) {
      // client_flag(2) max_packet(3) user\0 scramble [db\0]
      this.clientFlags = p[0] | (p[1] << 8);
      let i = 5;
      const uEnd = s.indexOf('\0', i);
      this.user = s.slice(i, uEnd < 0 ? s.length : uEnd);
      i = uEnd < 0 ? s.length : uEnd + 1;
      const pEnd = s.indexOf('\0', i);
      i = pEnd < 0 ? s.length : pEnd + 1;
      let db = null;
      if ((this.clientFlags & CLIENT_CONNECT_WITH_DB) && i < s.length) { const dEnd = s.indexOf('\0', i); db = s.slice(i, dEnd < 0 ? s.length : dEnd); }
      this.authed = true;
      this.srv.conns.add(this);
      this.srv.maxUsed = Math.max(this.srv.maxUsed, this.srv.conns.size);
      if (db) {
        try { this.beginStatement(''); this.changeDb(db); } catch (e) { this.close(); return this.err(seq + 1, e.code, e.message); }
      }
      return this.ok(seq + 1);
    }
    // mysql_change_db()
    changeDb(name) {
      checkDbName(name);
      if (!this.srv.dbs.has(name)) throw myError(ER.BAD_DB, name);
      this.db = name;
    }
    kill(id) {
      const c = [...this.srv.conns].find((x) => x.threadId === id);
      if (!c) throw myError(ER.NO_SUCH_THREAD, id);
      c.close();
    }

    // --- statements ------------------------------------------------------------
    // mysql_init_query() and the THD state a statement starts with
    beginStatement(query) {
      this.query = query;
      THD.conn = this;
      THD.tz = this.srv.tz;
      THD.query_start = this.user_time || nowSeconds();
      THD.cuted_fields = 0;
      THD.count_cuted_fields = false;
      THD.last_insert_id_set = false;
      THD.no_errors = false;
      this.insert_id_used = false;
    }
    execute(sql) {
      this.beginStatement(sql);
      const st = new Parser(sql).parse();
      const com = COM_OF[st.cmd];
      if (com) this.srv.status[com] = (this.srv.status[com] || 0) + 1;
      return this.dispatch(st);
    }
    dispatch(st) {
      switch (st.cmd) {
        case 'empty': return { affected: 0 };
        case 'select': return this.select(st);
        case 'insert': case 'replace': return execInsert(this, st);
        case 'update': return execUpdate(this, st);
        case 'delete': return execDelete(this, st);
        case 'create_table': return execCreateTable(this, st);
        case 'create_db': return execCreateDb(this, st.name, st.ifNotExists);
        case 'create_index': return execCreateIndex(this, st);
        case 'alter': return execAlter(this, st);
        case 'rename': return execRename(this, st);
        case 'drop_table': return execDropTable(this, st);
        case 'drop_index': return execDropIndex(this, st);
        case 'drop_db': return execDropDb(this, st.name, st.ifExists);
        case 'truncate': return execTruncate(this, st);
        case 'use': this.changeDb(st.db); return { affected: 0 };
        case 'show_databases': return showDatabases(this, st);
        case 'show_tables': return showTables(this, st);
        case 'show_table_status': return showTableStatus(this, st);
        case 'show_open_tables': return showOpenTables(this, st);
        case 'show_fields': return showFields(this, st);
        case 'show_keys': return showKeys(this, st);
        case 'show_create': return showCreate(this, st);
        case 'show_variables': return showVariables(this, st);
        case 'show_status': return showStatus(this, st);
        case 'show_processlist': return showProcesslist(this, st);
        case 'show_grants': return showGrants(this, st);
        case 'show_logs': return showLogs(this, st);
        case 'show_master_status': return showMasterStatus(this, st);
        case 'show_slave_status': return showSlaveStatus(this, st);
        case 'show_binlogs': return { fields: [strCol('Log_name', 255)], rows: [] };
        case 'set': return this.set(st);
        case 'lock': {
          // LOCK TABLES first unlocks, then opens and locks the tables
          this.locks = null;
          const refs = st.list.map((l) => ({ db: l.table.db, name: l.table.table, alias: l.alias || l.table.table }));
          openTables(this, refs);
          this.locks = refs.map((r, i) => ({ db: r.db, alias: r.alias, mode: st.list[i].mode === 'write' ? 'write' : 'read' }));
          return { affected: 0 };
        }
        case 'unlock': this.locks = null; return { affected: 0 };
        case 'begin': case 'commit': case 'rollback': case 'flush': case 'grant': case 'revoke':
        case 'reset': case 'purge': case 'slave': case 'change_master':
          return { affected: 0 };
        case 'do': {
          const ctx = { tables: [], where: 'field list', allow_sum_func: false, conn: this };
          for (const v of st.values) { v.fix_fields(ctx); v.val_str(); }
          return { affected: 0 };
        }
        case 'kill': {
          const ctx = { tables: [], where: 'field list', allow_sum_func: false, conn: this };
          st.expr.fix_fields(ctx);
          this.kill(Number(BigInt.asUintN(32, st.expr.val_int())));
          return { affected: 0 };
        }
        case 'table_maint': return this.tableMaint(st);
        case 'backup': case 'restore': return this.backupRestore(st);
        // (this mysqld is linked statically: dlopen() can't load a UDF)
        case 'create_function':
          throw myError(ER.CANT_OPEN_LIBRARY, st.soname, 2, st.soname + ': cannot open shared object file: No such file or directory');
        case 'drop_function': throw myError(ER.FUNCTION_NOT_DEFINED, st.name);
        case 'load':
          if (st.local) {
            if (!(this.clientFlags & 128)) throw myError(ER.NOT_ALLOWED_COMMAND);
            // check the table now; the file comes in the next packets
            openTables(this, [{ db: st.table.db, name: st.table.table, alias: st.table.table }], true);
            return { localFile: st.file, st };
          }
          return execLoad(this, st);
        default: throw myError(ER.UNKNOWN_ERROR);
      }
    }
    select(st) {
      if (st.limit === null && this.select_limit !== null && !st.into) st.limit = this.select_limit;
      if (st.procedure && !strcaseeq(st.procedure.name, 'analyse')) throw myError(ER.UNKNOWN_PROCEDURE, st.procedure.name);
      const q = new Select(this, st);
      q.prepare();
      const res = q.run();
      if (st.into) { res.items = q.items; return selectInto(this, st.into, res); }
      return res;
    }
    set(st) {
      for (const o of st.list) {
        switch (o.opt) {
          case 'SQL_QUOTE_SHOW_CREATE': this.quote_show_create = !!o.value; break;
          case 'SQL_SELECT_LIMIT': this.select_limit = o.value === null ? null : Number(o.value); break;
          case 'TIMESTAMP': this.user_time = o.value === null ? 0 : Number(o.value); THD.query_start = this.user_time || nowSeconds(); break;
          case 'LAST_INSERT_ID': this.last_insert_id = BigInt(o.value); break;
          case 'INSERT_ID': this.next_insert_id = BigInt(o.value); break;
          case 'CHARSET':
            if (o.value !== null && !strcaseeq(o.value, 'cp1251_koi8')) throw myError(ER.UNKNOWN_CHARACTER_SET, o.value);
            break;
          case 'USER_VAR': {
            const it = new Item_func_set_user_var(o.name, o.expr);
            it.fix_fields({ tables: [], where: 'field list', allow_sum_func: false, conn: this });
            it.update();
            break;
          }
          default: break;
        }
      }
      return { affected: 0 };
    }
    // BACKUP TABLE / RESTORE TABLE: the table's files in a directory of the
    // simulated disk (here the definition and rows in the simulator's format)
    backupRestore(st) {
      const srv = this.srv;
      const rows = [];
      for (const t of st.tables) {
        const db = t.db || this.db;
        const name = (db || '') + '.' + t.table;
        const frm = absPath(srv, st.dir + '/' + t.table + '.frm'), myd = absPath(srv, st.dir + '/' + t.table + '.MYD');
        const share = db ? this.getTable(db, t.table) : null;
        if (st.cmd === 'backup') {
          if (!share) { rows.push([name, 'backup', 'error', "Table '" + name + "' doesn't exist"]); continue; }
          let err = srv.fileWrite(frm, shareToJSON(share));
          if (err) { rows.push([name, 'backup', 'error', 'Failed copying .frm file: errno = ' + err]); continue; }
          err = srv.fileWrite(myd, JSON.stringify([...share.scan()].map((r) => [r.pos, r.rec.map((v) => { const e = encodeValue(v); return e instanceof Uint8Array ? { s: bytesToStr(e) } : e; })])));
          rows.push(err ? [name, 'backup', 'error', 'Failed copying .MYD file: errno = ' + err] : [name, 'backup', 'status', 'OK']);
          continue;
        }
        if (share) { rows.push([t.table, 'restore', 'error', 'table exists, will not overwrite on restore']); continue; }
        const def = srv.fileRead(frm), data = srv.fileRead(myd);
        if (def === null || !db || !srv.dbs.has(db)) { rows.push([t.table, 'restore', 'error', 'Failed copying .frm file']); continue; }
        try {
          const sh = shareFromJSON(db, t.table, def);
          sh.slots = [];
          for (const [pos, rec] of data === null ? [] : JSON.parse(data)) sh.slots[pos] = rec.map((v) => (v && typeof v === 'object' ? v.s : decodeValue(v)));
          sh.count = sh.slots.filter(Boolean).length;
          sh.free = [];
          for (let i = 0; i < sh.slots.length; i++) if (!sh.slots[i]) { sh.slots[i] = null; sh.free.push(i); }
          srv.addTable(sh);
          rows.push([name, 'restore', 'status', 'OK']);
        } catch (e) { rows.push([t.table, 'restore', 'error', 'Failed copying .frm file']); }
      }
      return { fields: [strCol('Table', NAME_LEN * 2, true), strCol('Op', 10, true), strCol('Msg_type', 10, true), strCol('Msg_text', 255, true)], rows };
    }
    // mysql_admin_table(): CHECK/ANALYZE/REPAIR/OPTIMIZE TABLE
    tableMaint(st) {
      const rows = [];
      for (const t of st.tables) {
        const db = t.db || this.db;
        const name = (db || '') + '.' + t.table;
        const share = db ? this.getTable(db, t.table) : null;
        if (!share) { rows.push([name, st.op, 'error', "Table '" + name + "' doesn't exist"]); continue; }
        rows.push([name, st.op, 'status', adminTable(share, st) ? 'OK' : 'Table is already up to date']);
        this.dirty(share);
      }
      return { fields: [strCol('Table', NAME_LEN * 2, true), strCol('Op', 10, true), strCol('Msg_type', 10, true), strCol('Msg_text', 255, true)], rows };
    }
  }

  // ha_myisam::check()/analyze()/repair(): true when something was done
  function adminTable(sh, st) {
    const done = () => { sh.state_changed = sh.not_analyzed = false; sh.check_time = nowSeconds(); return true; };
    switch (st.op) {
      case 'check':
        if (st.opts.includes('FAST_SYM') || (st.opts.includes('CHANGED') && !sh.state_changed)) return false;
        return done();
      case 'analyze':
        if (!sh.not_analyzed) return false;
        sh.not_analyzed = false;
        return true;
      case 'repair':
        sh.compact();
        sh.not_sorted_pages = true;
        sh.not_optimized_keys = false;
        return done();
      case 'optimize': {
        let did = false;
        if (sh.free.length) { sh.compact(); sh.not_sorted_pages = true; sh.not_optimized_keys = false; did = true; }
        if (sh.not_sorted_pages) { sh.not_sorted_pages = false; did = true; }
        if (sh.not_analyzed) { sh.not_analyzed = false; did = true; }
        sh.state_changed = false;
        return did;
      }
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Files: SELECT ... INTO OUTFILE and LOAD DATA INFILE work on the simulated
  // machine's file system (mysqld's current directory is its datadir)
  // ---------------------------------------------------------------------------
  const EE_FILENOTFOUND = 0, EE_CANTCREATEFILE = 1, EE_STAT = 13;
  const EE_MSG = { [EE_FILENOTFOUND]: "File '%s' not found (Errcode: %d)", [EE_CANTCREATEFILE]: "Can't create/write to file '%s' (Errcode: %d)",
    [EE_STAT]: "Can't get stat of '%s' (Errcode: %d)" };
  // my_error() with a mysys code: code 0 becomes ER_UNKNOWN_ERROR (my_message_sql())
  const eeError = (code, path, errno) => new SqlError(code || ER.UNKNOWN_ERROR, cfmt(EE_MSG[code], [path, errno]));
  function absPath(srv, path) {
    const parts = [];
    for (const p of ((path[0] === '/' ? '' : srv.datadir) + path).split('/')) {
      if (p === '' || p === '.') continue;
      if (p === '..') parts.pop(); else parts.push(p);
    }
    return '/' + parts.join('/');
  }

  // select_export / select_dump (sql_class.cc)
  function selectInto(conn, ex, res) {
    const srv = conn.srv;
    // fn_format(): a name without a directory is in the database directory
    const name = ex.outfile.includes('/') ? ex.outfile : (conn.db ? conn.db + '/' : '') + ex.outfile;
    const path = absPath(srv, name);
    if (srv.fileStat(path)) throw myError(ER.FILE_EXISTS_ERROR, ex.outfile);
    const cellStr = (v) => (v === null || typeof v === 'string' ? v : v.val_str());
    let out = '';
    if (ex.dump) {
      if (res.rows.length > 1) {
        // the first row is written, then the file is deleted again
        throw myError(ER.TOO_MANY_ROWS);
      }
      for (const row of res.rows) for (const v of row) { const s = cellStr(v); out += s === null ? '\0' : s; }
    } else {
      const field_term = ex.field_term === undefined ? '\t' : ex.field_term;
      let line_term = ex.line_term === undefined ? '\n' : ex.line_term;
      const enclosed = ex.enclosed || '', escaped = ex.escaped === undefined ? '\\' : ex.escaped, line_start = ex.line_start || '';
      if (!line_term.length) line_term = field_term;
      const field_sep_char = enclosed.length ? enclosed[0] : field_term.length ? field_term[0] : null;
      const escape_char = escaped.length ? escaped[0] : null;
      const line_sep_char = line_term.length ? line_term[0] : null;
      let opt_enclosed = !!ex.opt_enclosed;
      if (!field_term.length) opt_enclosed = false;
      if (!enclosed.length) opt_enclosed = true;
      const items = res.fields;
      const blob_flag = res.items.some((it) => it.max_length >= MAX_BLOB_WIDTH);
      const fixed_row_size = !field_term.length && !enclosed.length && !blob_flag;
      for (const row of res.rows) {
        out += line_start;
        row.forEach((v, i) => {
          const item = res.items[i];
          const isString = item.result_type() === STRING_RESULT;
          const s = cellStr(v);
          const encl = s !== null && (!opt_enclosed || isString);
          if (encl) out += enclosed;
          let used = 0;
          if (s === null) {
            if (!fixed_row_size) out += escape_char !== null ? escape_char + 'N' : 'NULL';
          } else {
            used = fixed_row_size ? Math.min(s.length, item.max_length) : s.length;
            const t = s.slice(0, used);
            if (isString && escape_char !== null) {
              for (const c of t) {
                if (c === escape_char || c === field_sep_char || c === line_sep_char || c === '\0') out += escape_char + (c === '\0' ? '0' : c);
                else out += c;
              }
            } else out += t;
          }
          if (fixed_row_size && item.max_length > used) out += ' '.repeat(item.max_length - used);
          if (encl) out += enclosed;
          if (i < row.length - 1) out += field_term;
        });
        out += line_term;
      }
    }
    // (the database directories exist on a real server)
    if (srv.fs && srv.fs.mkdirp && conn.db && path.startsWith(srv.datadir + conn.db + '/')) srv.fs.mkdirp(srv.datadir + conn.db);
    const err = srv.fileWrite(path, out);
    if (err) throw eeError(EE_CANTCREATEFILE, name, err);
    return { affected: res.rows.length };
  }

  // READ_INFO (sql_load.cc): the reader of LOAD DATA
  const EOF = -1, NONE = -2;
  class ReadInfo {
    constructor(data, field_term, line_start, line_term, enclosed, escape_char) {
      this.data = data; this.p = 0; this.stack = [];
      if (field_term === line_term) line_term = '';
      this.field_term = field_term; this.line_term = line_term; this.line_start = line_start;
      this.enclosed_char = enclosed.length ? cc(enclosed, 0) : NONE;
      this.field_term_char = field_term.length ? cc(field_term, 0) : NONE;
      this.line_term_char = line_term.length ? cc(line_term, 0) : NONE;
      this.escape_char = escape_char;
      this.start_of_line = line_start.length > 0;
      this.found_end_of_line = this.eof = this.found_null = this.line_cuted = false;
      this.enclosed = false;
      this.row = '';
    }
    get() { return this.stack.length ? this.stack.pop() : this.p < this.data.length ? cc(this.data, this.p++) : EOF; }
    push(c) { this.stack.push(c); }
    terminator(str) {
      let chr = 0, i;
      for (i = 1; i < str.length; i++) if ((chr = this.get()) !== cc(str, i)) break;
      if (i === str.length) return true;
      this.push(chr);
      for (let k = i - 1; k >= 1; k--) this.push(cc(str, k));
      return false;
    }
    unescape(chr) {
      switch (chr) {
        case 110: return 10; case 116: return 9; case 114: return 13; case 98: return 8;
        case 48: return 0; case 90: return 26;
        case 78: this.found_null = true; return chr;
        default: return chr;
      }
    }
    find_start_of_fields() {
      const ls = this.line_start;
      for (;;) {
        let chr;
        do {
          if ((chr = this.get()) === EOF) { this.found_end_of_line = this.eof = true; return true; }
        } while ((chr & 255) !== cc(ls, 0));
        let k = 1;
        for (; k < ls.length; k++) {
          chr = this.get();
          if ((chr & 255) !== cc(ls, k)) {
            this.push(chr);
            while (--k !== 0) this.push(cc(ls, k));
            break;
          }
        }
        if (k === ls.length) return false;
      }
    }
    // one field: false when there is one (in this.row), true at the end of the line
    read_field() {
      this.found_null = false;
      if (this.found_end_of_line) return true;
      if (this.start_of_line) {
        this.start_of_line = false;
        if (this.find_start_of_fields()) return true;
      }
      let chr = this.get();
      if (chr === EOF) { this.found_end_of_line = this.eof = true; return true; }
      const to = [];
      let found_enclosed_char;
      if (chr === this.enclosed_char) { found_enclosed_char = this.enclosed_char; to.push(chr); }
      else { found_enclosed_char = NONE; this.push(chr); }
      const done = (enclosed, eol, start) => {
        this.enclosed = enclosed;
        if (eol) this.found_end_of_line = true;
        this.row = String.fromCharCode(...to.slice(start));
        return false;
      };
      for (;;) {
        chr = this.get();
        if (chr === EOF) { this.found_end_of_line = this.eof = true; return done(false, false, 0); }
        if (chr === this.escape_char) {
          if ((chr = this.get()) === EOF) { to.push(this.escape_char); this.found_end_of_line = this.eof = true; return done(false, false, 0); }
          to.push(this.unescape(chr));
          continue;
        }
        if (chr === this.line_term_char && found_enclosed_char === NONE) {
          if (this.terminator(this.line_term)) return done(false, true, 0);
        }
        if (chr === found_enclosed_char) {
          if ((chr = this.get()) === found_enclosed_char) { to.push(chr); continue; }
          if (chr === EOF || (chr === this.line_term_char && this.terminator(this.line_term))) return done(true, true, 1);
          if (chr === this.field_term_char && this.terminator(this.field_term)) return done(true, false, 1);
          this.push(chr);
          chr = 34;                   // (MySQL copies a '"', whatever the enclosing character)
        } else if (chr === this.field_term_char && found_enclosed_char === NONE) {
          if (this.terminator(this.field_term)) return done(false, false, 0);
        }
        to.push(chr);
      }
    }
    read_fixed_length(maxLen) {
      if (this.found_end_of_line) return true;
      if (this.start_of_line) {
        this.start_of_line = false;
        if (this.find_start_of_fields()) return true;
      }
      const to = [];
      while (to.length < maxLen) {
        let chr = this.get();
        if (chr === EOF) { this.found_end_of_line = this.eof = true; this.row = String.fromCharCode(...to); return !to.length; }
        if (chr === this.escape_char) {
          if ((chr = this.get()) === EOF) { to.push(this.escape_char); this.found_end_of_line = this.eof = true; this.row = String.fromCharCode(...to); return false; }
          to.push(this.unescape(chr));
          continue;
        }
        if (chr === this.line_term_char && this.terminator(this.line_term)) {
          this.found_end_of_line = true;
          this.row = String.fromCharCode(...to);
          return false;
        }
        to.push(chr);
      }
      this.row = String.fromCharCode(...to);
      return false;
    }
    next_line() {
      this.line_cuted = false;
      this.start_of_line = this.line_start.length > 0;
      if (this.found_end_of_line || this.eof) { this.found_end_of_line = false; return this.eof; }
      if (!this.line_term.length) return false;
      for (;;) {
        const chr = this.get();
        if (chr === EOF) { this.eof = true; return true; }
        if (chr === this.escape_char) {
          this.line_cuted = true;
          if (this.get() === EOF) return true;
          continue;
        }
        if (chr === this.line_term_char && this.terminator(this.line_term)) return false;
        this.line_cuted = true;
      }
    }
  }

  // mysql_load() (sql_load.cc); data is the file sent by the client for LOCAL
  function execLoad(conn, st, data) {
    const srv = conn.srv;
    const escaped = st.escaped === undefined ? '\\' : st.escaped, enclosed = st.enclosed || '';
    const field_term = st.field_term === undefined ? '\t' : st.field_term, line_term = st.line_term === undefined ? '\n' : st.line_term;
    const line_start = st.line_start || '';
    if (escaped.length > 1 || enclosed.length > 1) throw myError(ER.WRONG_FIELD_TERMINATORS);
    const ref = { db: st.table.db, name: st.table.table, alias: st.table.table };
    const [t] = openTables(conn, [ref], true);
    const ctx = { tables: [t], where: 'field list', allow_sum_func: false, conn };
    const fields = st.fields.length ? setupTargetFields(ctx, st.fields) : t.fields;
    const use_blobs = fields.some((f) => f.flags & F.BLOB);
    const use_timestamp = fields.some((f) => f.idx === t.share.timestamp_field);
    if (use_blobs && !line_term.length && !field_term.length) throw myError(ER.BLOBS_AND_NO_TERMINATED);
    let mode = st.duplicates;
    const local = data !== undefined;
    if (local && mode === 'error') mode = 'ignore';
    if (!local) {
      let name, path;
      if (!st.file.includes('/')) {
        name = './' + (conn.db || '') + '/' + st.file;
        path = absPath(srv, name);
      } else {
        name = st.file;
        path = absPath(srv, name);
        const s = srv.fileStat(path);
        if (!s) throw eeError(EE_STAT, name, 2);
        // readable by others, and a regular file
        if (!(s.mode & 4) || (s.mode & 0o170000) !== 0o100000) throw myError(ER.TEXTFILE_NOT_READABLE, name);
      }
      data = srv.fileRead(path);
      if (data === null) throw eeError(EE_FILENOTFOUND, name, 2);
    }
    const ri = new ReadInfo(data, field_term, line_start, line_term, enclosed, escaped.length ? cc(escaped, 0) : NONE);
    const info = { records: 0, deleted: 0, copied: 0 };
    THD.count_cuted_fields = true;
    THD.cuted_fields = 0;
    t.next_number = true;
    t.set_timestamp = !use_timestamp;
    const auto = t.share.auto_field >= 0 ? t.fields[t.share.auto_field] : null;
    try {
      if (line_term.length && field_term.length) {
        for (let n = st.skip || 0; n > 0; n--) if (ri.next_line()) break;
      }
      if (!field_term.length && !enclosed.length) {
        // read_fixed_length(): columns of their display width
        const width = fields.reduce((n, f) => n + (f.flags & F.BLOB ? 256 : f.field_length), 0);
        for (const f of fields) f.set_notnull();
        while (!ri.read_fixed_length(width)) {
          const row = ri.row;
          let pos = 0;
          for (const f of fields) {
            if (pos === row.length) { cut(); f.reset(); continue; }
            const length = Math.min(row.length - pos, f.field_length);
            f.store_str(row.substr(pos, length));
            pos = Math.min(pos + length, row.length);
          }
          if (pos !== row.length) cut();
          writeRecord(conn, t, info, mode);
          if (auto) auto.reset();
          if (ri.next_line()) break;
          if (ri.line_cuted) cut();
        }
      } else {
        // read_sep_field()
        for (;;) {
          let missing = -1;
          for (let i = 0; i < fields.length; i++) {
            if (ri.read_field()) { missing = i; break; }
            const f = fields[i], row = ri.row;
            if ((!ri.enclosed && enclosed.length && row === 'NULL') || (row.length === 1 && ri.found_null)) {
              f.reset();
              f.set_null();
              if (!f.maybe_null()) { if (f.type() === T.TIMESTAMP) f.set_time(); else cut(); }
              continue;
            }
            f.set_notnull();
            f.store_str(row);
          }
          if (missing === 0) break;
          if (missing > 0) {
            for (let i = missing; i < fields.length; i++) {
              const f = fields[i];
              if (f.nullable) f.set_null(); else f.reset();
              cut();
            }
          }
          writeRecord(conn, t, info, mode);
          if (auto) auto.reset();
          if (ri.next_line()) break;
          if (ri.line_cuted) cut();
        }
      }
    } finally {
      THD.count_cuted_fields = false;
      if (info.copied || info.deleted) conn.dirty(t.share);
    }
    return { affected: info.copied + info.deleted, insertId: 0n,
      info: INFO(ER.LOAD_INFO, info.records, info.deleted, info.records - info.copied, THD.cuted_fields) };
  }

  // mysql_install_db (scripts/mysql_install_db.sh): the grant tables
  const INSTALL_SQL = [
    "CREATE TABLE db (   Host char(60) binary DEFAULT '' NOT NULL,   Db char(64) binary DEFAULT '' NOT NULL,   User char(16) binary DEFAULT '' NOT NULL,   Select_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Insert_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Update_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Delete_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Create_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Drop_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Grant_priv enum('N','Y') DEFAULT 'N' NOT NULL,   References_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Index_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Alter_priv enum('N','Y') DEFAULT 'N' NOT NULL, PRIMARY KEY Host (Host,Db,User), KEY User (User) ) comment='Database privileges';",
    "CREATE TABLE host (  Host char(60) binary DEFAULT '' NOT NULL,  Db char(64) binary DEFAULT '' NOT NULL,  Select_priv enum('N','Y') DEFAULT 'N' NOT NULL,  Insert_priv enum('N','Y') DEFAULT 'N' NOT NULL,  Update_priv enum('N','Y') DEFAULT 'N' NOT NULL,  Delete_priv enum('N','Y') DEFAULT 'N' NOT NULL,  Create_priv enum('N','Y') DEFAULT 'N' NOT NULL,  Drop_priv enum('N','Y') DEFAULT 'N' NOT NULL,  Grant_priv enum('N','Y') DEFAULT 'N' NOT NULL,  References_priv enum('N','Y') DEFAULT 'N' NOT NULL,  Index_priv enum('N','Y') DEFAULT 'N' NOT NULL,  Alter_priv enum('N','Y') DEFAULT 'N' NOT NULL,  PRIMARY KEY Host (Host,Db) ) comment='Host privileges;  Merged with database privileges';",
    "CREATE TABLE user (   Host char(60) binary DEFAULT '' NOT NULL,   User char(16) binary DEFAULT '' NOT NULL,   Password char(16) binary DEFAULT '' NOT NULL,   Select_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Insert_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Update_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Delete_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Create_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Drop_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Reload_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Shutdown_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Process_priv enum('N','Y') DEFAULT 'N' NOT NULL,   File_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Grant_priv enum('N','Y') DEFAULT 'N' NOT NULL,   References_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Index_priv enum('N','Y') DEFAULT 'N' NOT NULL,   Alter_priv enum('N','Y') DEFAULT 'N' NOT NULL,   PRIMARY KEY Host (Host,User) ) comment='Users and global privileges';",
    "CREATE TABLE func (   name char(64) binary DEFAULT '' NOT NULL,   ret tinyint(1) DEFAULT '0' NOT NULL,   dl char(128) DEFAULT '' NOT NULL,   type enum ('function','aggregate') NOT NULL,   PRIMARY KEY (name) )   comment='User defined functions';",
    "CREATE TABLE tables_priv (   Host char(60) binary DEFAULT '' NOT NULL,   Db char(64) binary DEFAULT '' NOT NULL,   User char(16) binary DEFAULT '' NOT NULL,   Table_name char(60) binary DEFAULT '' NOT NULL,   Grantor char(77) DEFAULT '' NOT NULL,   Timestamp timestamp(14),   Table_priv set('Select','Insert','Update','Delete','Create','Drop','Grant','References','Index','Alter') DEFAULT '' NOT NULL,   Column_priv set('Select','Insert','Update','References') DEFAULT '' NOT NULL,   PRIMARY KEY (Host,Db,User,Table_name),   KEY Grantor (Grantor) )   comment='Table privileges';",
    "CREATE TABLE columns_priv (   Host char(60) binary DEFAULT '' NOT NULL,   Db char(64) binary DEFAULT '' NOT NULL,   User char(16) binary DEFAULT '' NOT NULL,   Table_name char(64) binary DEFAULT '' NOT NULL,   Column_name char(64) binary DEFAULT '' NOT NULL,   Timestamp timestamp(14),   Column_priv set('Select','Insert','Update','References') DEFAULT '' NOT NULL,   PRIMARY KEY (Host,Db,User,Table_name,Column_name) )   comment='Column privileges';",
    "INSERT INTO db VALUES ('%','test','','Y','Y','Y','Y','Y','Y','N','Y','Y','Y')",
    "INSERT INTO db VALUES ('%','test\\_%','','Y','Y','Y','Y','Y','Y','N','Y','Y','Y')",
    "INSERT INTO user VALUES ('localhost','root','','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y')",
    "INSERT INTO user VALUES ('simphp','root','','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y')",
    "REPLACE INTO user VALUES ('localhost','root','','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y')",
    "REPLACE INTO user VALUES ('simphp','root','','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y','Y')",
    "INSERT INTO user VALUES ('localhost','','','N','N','N','N','N','N','N','N','N','N','N','N','N','N')",
    "INSERT INTO user VALUES ('simphp','','','N','N','N','N','N','N','N','N','N','N','N','N','N','N')"
  ];

  MysqlServer.SERVER_VERSION = SERVER_VERSION;

  if (typeof module !== 'undefined' && module.exports) module.exports = MysqlServer;
  else root.MysqlServer = MysqlServer;
})(typeof self !== 'undefined' ? self : this);
