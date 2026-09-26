<?php
// Object-oriented PHP, 4.x style: no public/private, constructors are named
// after the class, and objects are *values* (assignment copies them!).
header("Content-Type: text/plain");

class Animal {
    var $name;
    var $sound = "...";

    function Animal($name) {
        $this->name = $name;
    }

    function speak() {
        return $this->name . " says " . $this->sound;
    }
}

class Dog extends Animal {
    var $sound = "Woof";

    function Dog($name) {
        parent::Animal($name);   // must call the parent constructor explicitly
    }

    function speak() {
        return parent::speak() . "!";
    }
}

$rex = new Dog("Rex");
echo $rex->speak(), "\n";
echo "get_class: ", get_class($rex), "   (class names are lower-cased in PHP 4)\n";
echo "parent:    ", get_parent_class($rex), "\n";
echo "is_a?      ", is_subclass_of($rex, 'animal') ? "yes" : "no", "\n\n";

// Assignment copies the object...
$copy = $rex;
$copy->name = "Copy";
echo "after \$copy = \$rex: rex is still '", $rex->name, "'\n";

// ...unless you ask for a reference.
$ref =& $rex;
$ref->name = "Ref";
echo "after \$ref =& \$rex: rex is now '", $rex->name, "'\n";

// Passing to a function also copies, unless the parameter is by-reference.
function rename_it($a, $n) { $a->name = $n; }
function rename_ref(&$a, $n) { $a->name = $n; }
rename_it($rex, "Nope");
echo "rename_it():  ", $rex->name, "\n";
rename_ref($rex, "Yep");
echo "rename_ref(): ", $rex->name, "\n\n";

// The classic "=& new" idiom
$obj =& new Animal("Cat");
$obj->sound = "Meow";
echo $obj->speak(), "\n\n";

print_r(get_object_vars($rex));
var_dump($rex);
echo "\nMethods: ";
print_r(get_class_methods('dog'));

// No exceptions in PHP 4 -- errors are values
class Result {
    var $ok; var $value; var $error;
    function Result($ok, $value, $error = null) { $this->ok = $ok; $this->value = $value; $this->error = $error; }
}
function safe_div($a, $b) {
    if ($b == 0) return new Result(false, null, "division by zero");
    return new Result(true, $a / $b);
}
$r = safe_div(1, 0);
echo "\nsafe_div(1,0): ", $r->ok ? $r->value : "error: " . $r->error, "\n";
?>
