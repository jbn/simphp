<?php
error_reporting(E_ALL);
echo getrandmax(), " ", mt_getrandmax(), "\n";
foreach (array(0, 1, 42, 12345, -1, 2147483647) as $seed) {
    mt_srand($seed);
    echo "mt seed $seed:";
    for ($i = 0; $i < 8; $i++) echo " ", mt_rand();
    echo " |";
    for ($i = 0; $i < 8; $i++) echo " ", mt_rand(1, 6);
    echo " |";
    for ($i = 0; $i < 4; $i++) echo " ", mt_rand(-100, 100);
    echo " |";
    for ($i = 0; $i < 3; $i++) echo " ", mt_rand(0, 2147483647);
    echo " |", mt_rand(5, 5), " ", mt_rand(10, 1);
    echo "\n";
}
foreach (array(0, 1, 42, 12345) as $seed) {
    srand($seed);
    echo "srand $seed:";
    for ($i = 0; $i < 8; $i++) echo " ", rand();
    echo " |";
    for ($i = 0; $i < 8; $i++) echo " ", rand(1, 100);
    echo " |", rand(-5, -1), " ", rand(3, 3);
    echo "\n";
}
mt_srand(5); $a = mt_rand(); mt_srand(5); $b = mt_rand(); echo $a == $b ? "repeatable\n" : "not repeatable\n";
srand(5); $a = rand(); srand(5); $b = rand(); echo $a == $b ? "repeatable\n" : "not repeatable\n";
mt_srand(3);
$counts = array(0, 0, 0, 0, 0, 0);
for ($i = 0; $i < 600; $i++) $counts[mt_rand(0, 5)]++;
echo implode(",", $counts), "\n";
mt_srand(11); srand(11);
$arr = range(1, 20); shuffle($arr); echo implode(",", $arr), "\n";
$keys = array_rand(array_flip(range("a", "z")), 5); echo implode(",", $keys), "\n";
echo array_rand(array("x" => 1, "y" => 2)), "\n";
mt_srand("12abc"); echo mt_rand(), "\n";
mt_srand(1.9); echo mt_rand(), "\n";
?>
