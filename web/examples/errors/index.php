<?php
// Default error_reporting in 4.1.1 is E_ALL & ~E_NOTICE, so notices are hidden.
echo "<p>error_reporting() = ", error_reporting(), " (E_ALL = ", E_ALL, ")</p>";

echo $undefined_variable;           // notice, silently ignored by default
$arr = array();
echo $arr['missing'];               // also just a notice

error_reporting(E_ALL);
echo "<h3>With E_ALL:</h3>";
echo $undefined_variable;
echo $arr[missing_const];           // unquoted key: undefined constant notice

echo "<h3>Warnings</h3>";
$x = 10 / 0;                        // Warning: Division by zero
var_dump($x);
$fp = fopen("/no/such/file", "r");  // Warning: failed to open
@$fp = fopen("/no/such/file", "r"); // silenced with @

ini_set('track_errors', 1);
@strpos();
echo "<p>\$php_errormsg: $php_errormsg</p>";

echo "<h3>A custom error handler</h3>";
function my_handler($errno, $errstr, $errfile, $errline) {
    $types = array(E_WARNING => 'Warning', E_NOTICE => 'Notice',
                   E_USER_ERROR => 'User error', E_USER_WARNING => 'User warning',
                   E_USER_NOTICE => 'User notice');
    echo "<div style='border:1px solid red;padding:4px;margin:2px'><b>[{$types[$errno]}]</b> "
       . "$errstr <i>(line $errline)</i></div>";
}
$old = set_error_handler('my_handler');
echo $another_undefined;
trigger_error("Something odd happened", E_USER_WARNING);
restore_error_handler();

echo "<h3>Fatal errors stop the script</h3>";
undefined_function();
echo "never printed";
?>
