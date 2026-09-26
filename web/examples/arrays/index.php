<?php
header("Content-Type: text/plain");

$fruits = array("d" => "lemon", "a" => "orange", "b" => "banana", "c" => "apple");

asort($fruits);  echo "asort:  "; print_r($fruits);
ksort($fruits);  echo "ksort:  "; print_r($fruits);
arsort($fruits); echo "arsort: "; print_r($fruits);

// Classic PHP 4 iteration idiom
reset($fruits);
while (list($key, $val) = each($fruits)) {
    echo "$key => $val\n";
}

// Callbacks are just function names (no closures until PHP 5.3)
function cmp_len($a, $b) {
    if (strlen($a) == strlen($b)) return 0;
    return (strlen($a) < strlen($b)) ? -1 : 1;
}
$words = array("pear", "fig", "banana", "kiwi", "watermelon");
usort($words, "cmp_len");
echo "\nusort by length: ", implode(", ", $words), "\n";

function add_prefix(&$item, $key, $prefix) { $item = "$prefix$item"; }
array_walk($words, 'add_prefix', 'fruit:');
echo "array_walk: ", implode(" ", $words), "\n";

$nums = range(1, 10);
function is_odd($n) { return $n & 1; }
function square($n) { return $n * $n; }
echo "array_filter odd: ", implode(",", array_filter($nums, "is_odd")), "\n";
echo "array_map square: ", implode(",", array_map("square", $nums)), "\n";
echo "array_sum:        ", array_sum($nums), "\n";
echo "array_slice:      ", implode(",", array_slice($nums, 2, 3)), "\n";
echo "array_reverse:    ", implode(",", array_reverse($nums)), "\n";
echo "in_array('5'):    ", in_array('5', $nums) ? "true" : "false", "\n";
echo "array_search(7):  ", array_search(7, $nums), "\n";

echo "\narray_merge vs +:\n";
$a = array(0 => 'a', 1 => 'b', 'x' => 'X');
$b = array(0 => 'c', 'x' => 'Y', 'z' => 'Z');
print_r(array_merge($a, $b));
print_r($a + $b);

echo "\narray_count_values: "; print_r(array_count_values(array("a", "b", "a", 1, "1")));
echo "array_unique: ";       print_r(array_unique(array(4, "4", "3", 4, 3, "3")));
echo "array_flip: ";         print_r(array_flip(array("a" => 1, "b" => 2)));
echo "compact/extract: ";
$city = "Paris"; $zip = "75001";
$arr = compact('city', 'zip'); print_r($arr);

// Multisort
$data = array(3, 1, 2);
$labels = array("three", "one", "two");
array_multisort($data, $labels);
echo "array_multisort: ", implode(",", $labels), "\n";

// Sorting mixed types the PHP 4 way
$mixed = array("10", 9, "9a", 1.5, "abc", true);
sort($mixed);
echo "\nsort(mixed): "; var_dump($mixed);
?>
