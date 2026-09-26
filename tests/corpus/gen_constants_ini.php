<?php
error_reporting(E_ALL);
define("MY_CONST", 42);
define("my_ci", "insensitive", true);
define("FLT", 1.5);
define("STRC", "str");
define("BOOLC", false);
var_dump(define("MY_CONST", 43));
var_dump(@define("ARRC", array(1)));
var_dump(MY_CONST, my_ci, MY_CI, My_Ci, FLT, STRC, BOOLC);
var_dump(defined("MY_CONST"), defined("my_const"), defined("MY_CI"), defined("NOPE"), defined("E_ALL"), defined("true"), defined("TRUE"), defined("PHP_VERSION"));
var_dump(constant("MY_CONST"), constant("MY_CI"), constant("E_ALL"), @constant("NOPE"));
echo UNDEFINED_CONST_X, "\n";
var_dump(TRUE, True, true, FALSE, NULL, Null);
echo E_ERROR, " ", E_WARNING, " ", E_PARSE, " ", E_NOTICE, " ", E_CORE_ERROR, " ", E_CORE_WARNING, " ", E_COMPILE_ERROR, " ", E_COMPILE_WARNING, " ", E_USER_ERROR, " ", E_USER_WARNING, " ", E_USER_NOTICE, " ", E_ALL, "\n";
echo PHP_VERSION, " ", PHP_OS, " ", M_PI, " ", DIRECTORY_SEPARATOR, " ", PATH_SEPARATOR, "\n";
echo __LINE__, " ", basename(__FILE__), "\n";
foreach (array("SORT_ASC", "SORT_DESC", "SORT_REGULAR", "SORT_NUMERIC", "SORT_STRING", "CASE_LOWER", "CASE_UPPER", "COUNT_NORMAL", "LC_ALL", "LC_CTYPE", "LC_NUMERIC", "LC_TIME", "LC_COLLATE", "LC_MONETARY", "LC_MESSAGES", "SEEK_SET", "SEEK_CUR", "SEEK_END", "LOCK_SH", "LOCK_EX", "LOCK_UN", "LOCK_NB", "INI_USER", "INI_PERDIR", "INI_SYSTEM", "INI_ALL", "PREG_PATTERN_ORDER", "PREG_SET_ORDER", "PREG_SPLIT_NO_EMPTY", "PREG_SPLIT_DELIM_CAPTURE", "CONNECTION_ABORTED", "CONNECTION_NORMAL", "CONNECTION_TIMEOUT", "STR_PAD_LEFT", "STR_PAD_RIGHT", "STR_PAD_BOTH", "PATHINFO_DIRNAME", "CRYPT_SALT_LENGTH", "CRYPT_STD_DES", "CRYPT_MD5", "M_SQRT2", "XML_ERROR_NONE", "CAL_GREGORIAN", "PHP_OUTPUT_HANDLER_START", "PHP_SHLIB_SUFFIX", "CHAR_MAX", "ABDAY_1", "CODESET", "YESEXPR", "HTML_ENTITIES", "UPLOAD_ERR_OK", "E_STRICT") as $c) {
    echo $c, "=", defined($c) ? var_s(constant($c)) : "undef", "\n";
}
function var_s($v) { return gettype($v) . ":" . $v; }
$all = get_defined_constants();
echo is_array($all) ? "array" : "not", " has E_ALL=", isset($all["E_ALL"]) ? $all["E_ALL"] : "no", " has MY_CONST=", isset($all["MY_CONST"]) ? $all["MY_CONST"] : "no", "\n";
$dirs = array("precision", "short_open_tag", "asp_tags", "magic_quotes_gpc", "magic_quotes_runtime", "magic_quotes_sybase", "register_globals", "track_vars", "error_reporting", "display_errors", "log_errors", "html_errors", "max_execution_time", "memory_limit", "output_buffering", "implicit_flush", "safe_mode", "allow_url_fopen", "default_mimetype", "default_charset", "arg_separator.output", "arg_separator.input", "variables_order", "gpc_order", "auto_prepend_file", "y2k_compliance", "zend.ze1_compatibility_mode", "serialize_precision", "nonexistent.directive", "session.name", "session.save_handler", "session.use_cookies", "assert.active", "file_uploads", "upload_max_filesize", "post_max_size", "highlight.string", "highlight.comment", "highlight.keyword", "highlight.default", "highlight.html", "highlight.bg", "enable_dl", "expose_php", "ignore_user_abort", "track_errors", "xmlrpc_errors", "sql.safe_mode", "bcmath.scale", "error_prepend_string", "docref_root", "precision");
foreach ($dirs as $d) { $v = ini_get($d); echo $d, "=", var_s2($v), "\n"; }
function var_s2($v) { return $v === false ? "FALSE" : "[" . $v . "]"; }
var_dump(ini_set("precision", "10"), ini_get("precision"), 1/3);
ini_restore("precision"); var_dump(ini_get("precision"), 1/3);
var_dump(ini_set("nonexistent.x", "1"), ini_set("safe_mode", "1"), ini_get("safe_mode"));
var_dump(ini_alter("precision", "5"), 1/3);
var_dump(get_cfg_var("nonexistent_cfg"), set_magic_quotes_runtime(0), get_magic_quotes_runtime(), get_magic_quotes_gpc());
?>
