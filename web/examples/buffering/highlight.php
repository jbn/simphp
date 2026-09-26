<html><body>
<h3>highlight_string()</h3>
<?php
highlight_string('<?php
// PHP 4 syntax highlighting, straight from the Zend engine
class Greeter {
    var $greeting = "Hello";
    function greet($who) {
        return "$this->greeting, $who!";
    }
}
$g = new Greeter;
echo $g->greet("world");
?>');
?>
<h3>show_source(__FILE__)</h3>
<?php show_source(__FILE__); ?>
</body></html>
