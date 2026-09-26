<?php
echo PHP_VERSION, " ", PHP_OS, " ", phpversion(), " ", zend_version(), " ", defined('PHP_EOL') ? 'eol' : 'no eol', " ", defined('PHP_INT_MAX') ? 'intmax' : 'no intmax', " ", E_ALL, " ", defined('E_STRICT') ? 'strict' : 'no strict', "\n";
echo __FILE__, " ", __LINE__, " ", defined('__CLASS__') ? 'c' : 'noc', " ", TRUE, FALSE, NULL, "|", true === TRUE ? 'y' : 'n', "\n";
define('MYCONST', 42); define('lower', 'l', true); echo MYCONST, LOWER, lower, constant('MYCONST'), defined('MYCONST'), "\n";
$exts = get_loaded_extensions(); sort($exts); echo implode(",", $exts), "\n";
foreach (array('standard', 'pcre', 'session', 'xml', 'bcmath', 'calendar', 'ctype', 'wddx', 'mysql', 'posix', 'zlib') as $e) echo $e, "=", extension_loaded($e) ? 1 : 0, " ";
echo "\n", count(get_extension_funcs('standard')) > 300 ? "many funcs" : "few funcs", "\n";
$f = get_defined_functions(); echo count($f['internal']), "\n";
$c = get_defined_constants(); echo count($c) > 100 ? "consts" : "few consts", " ", $c['E_ALL'], "\n";
echo ini_get('precision'), ini_get('register_globals'), ini_get('magic_quotes_gpc'), ini_get('short_open_tag'), ini_get('asp_tags'), ini_get('max_execution_time'), ini_get('memory_limit'), "|", ini_get('include_path'), "|", ini_get('error_reporting'), "|", ini_get('display_errors'), ini_get('html_errors'), ini_get('track_errors'), ini_get('output_buffering'), ini_get('implicit_flush'), "|", ini_get('session.save_path'), ini_get('session.name'), ini_get('variables_order'), ini_get('gpc_order'), "|", ini_get('arg_separator.output'), ini_get('upload_max_filesize'), ini_get('post_max_size'), ini_get('safe_mode'), ini_get('allow_url_fopen'), ini_get('default_mimetype'), "\n";
var_dump(ini_get('nonexistent'), ini_set('precision', 10), ini_get('precision'), ini_restore('precision'), ini_get('precision'));
echo get_magic_quotes_gpc(), get_magic_quotes_runtime(), "\n";
set_magic_quotes_runtime(1); echo get_magic_quotes_runtime(), "\n"; set_magic_quotes_runtime(0);
echo gettype(getenv("PATH")), " ", getenv("TZ"), " ", var_export(getenv("NOPE"), true), "\n";
putenv("FOO=bar"); echo getenv("FOO"), "\n";
echo php_sapi_name(), " ", get_cfg_var('cfg_file_path') ? 'cfg' : 'nocfg', " ", get_current_user() != '' ? 'user' : '', "\n";
foreach (array('is_callable', 'array_key_exists', 'key_exists', 'array_chunk', 'array_fill', 'is_a', 'fmod', 'str_word_count', 'array_combine', 'ob_get_level', 'ob_get_clean', 'html_entity_decode', 'sha1', 'file_get_contents', 'var_export', 'array_change_key_case', 'md5_file', 'image_type_to_mime_type', 'pathinfo', 'nl_langinfo', 'mb_strlen', 'ctype_alpha', 'easter_date', 'bcadd', 'gzcompress', 'utf8_encode', 'iconv', 'posix_getpid', 'mysql_connect', 'session_start', 'xml_parser_create', 'preg_match', 'ereg', 'wddx_serialize_value', 'socket_create', 'fsockopen', 'mail', 'exec', 'dl', 'debug_backtrace', 'version_compare', 'array_search', 'realpath', 'is_scalar', 'array_sum', 'call_user_func_array', 'str_ireplace', 'stripos', 'strripos', 'array_walk_recursive', 'http_build_query', 'memory_get_usage', 'getrusage', 'uniqid', 'lcg_value', 'levenshtein', 'money_format', 'number_format', 'localeconv', 'ob_gzhandler', 'openlog', 'ftok', 'crypt', 'getmypid', 'posix_uname') as $fn) echo $fn, "=", function_exists($fn) ? 1 : 0, " ";
echo "\n";
echo version_compare("4.1.1", "4.1.0"), version_compare("4.1.1", "4.1.1"), version_compare("4.0.6", "4.1.0", "<") ? 'lt' : 'ge', version_compare("4.1.1RC1", "4.1.1"), "\n";
var_dump(ctype_digit("123"), ctype_alpha("abc1"), ctype_space(" \n"), ctype_upper("AB"), ctype_xdigit("fg"), ctype_punct("!?"), ctype_alnum(""));
echo easter_date(2002), " ", easter_days(2002), " ", jdtogregorian(2452270), " ", gregoriantojd(1, 1, 2000), " ", jddayofweek(2452270, 1), " ", jdmonthname(2452270, 1), " ", cal_days_in_month(CAL_GREGORIAN, 2, 1900), " ", unixtojd(1009411200), " ", jdtounix(2452271), " ", frenchtojd(1, 1, 1), " ", jdtojulian(2452270), "\n";
print_r(cal_from_jd(2452270, CAL_GREGORIAN));
echo utf8_encode("caf\xe9"), " ", utf8_decode("caf\xc3\xa9") == "caf\xe9" ? 'ok' : 'bad', "\n";
echo crypt("password", "ab"), " ", crypt("password", '$1$saltsalt$'), " ", strlen(crypt("x")), "\n";
echo str_rot13("Hello"), " ", strrev(strval(12345)), " ", nl2br("a\n"), " ", quoted_printable_decode("a=3Db"), " ", convert_cyr_string("abc", "w", "k"), " ", soundex(""), "|", metaphone(""), "|\n";
echo gettype(microtime()), " ", strlen(uniqid("")), " ", gettype(lcg_value()), " ", is_float(lcg_value()) ? 'f' : 'nf', " ", strlen(md5(uniqid(rand(), true))), "\n";
echo gethostbyname("localhost"), " ", gethostbyname("nonexistent.invalid"), " ", ip2long("127.0.0.1"), " ", long2ip(3232235777), " ", ip2long("255.255.255.255"), "\n";
print_r(parse_url("http://user:pass@host.com:8080/p/a/t/h.php?query=1&x[]=2#frag"));
print_r(parse_url("/relative/path?q")); print_r(parse_url("mailto:a@b.com"));
parse_str("a=1&b[]=2&b[]=3&c[k]=v&d=%20x+y&e", $out); print_r($out);
echo base64_encode(pack("nvc*", 0x1234, 0x5678, 65, 66)), " "; print_r(unpack("nfirst/vsecond/c2chars", pack("nvc*", 0x1234, 0x5678, 65, 66)));
print_r(unpack("N", pack("N", -1))); print_r(unpack("V2x", pack("V2", 1, 2)));
echo bin2hex(pack("A5a5H4h4", "ab", "cd", "1f2e", "1f2e")), " ", bin2hex(pack("d", 1.5)), " ", bin2hex(pack("f", 1.5)), " ", bin2hex(pack("s", -2)), "\n";
echo "end
"; ?>
