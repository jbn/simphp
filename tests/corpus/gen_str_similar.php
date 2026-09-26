<?php
error_reporting(E_ALL);
$words = array("", "a", "kitten", "sitting", "Saturday", "Sunday", "Hello", "hallo", "world", "PHP", "php", "Tymczak", "Robert", "Rupert", "Ashcraft", "Lloyd", "Knight", "Thompson", "Xavier");
foreach ($words as $w) {
    echo str_pad($w, 10), " sx=", soundex($w), " mp=", metaphone($w), "\n";
}
for ($i = 0; $i < count($words) - 1; $i++) {
    $a = $words[$i]; $b = $words[$i + 1];
    $p = 0;
    $n = similar_text($a, $b, $p);
    echo "$a/$b lev=", levenshtein($a, $b), " sim=$n pct=", round($p, 4), "\n";
}
echo levenshtein("kitten", "sitting", 1, 1, 1), "\n";
echo levenshtein("kitten", "sitting", 2, 3, 4), "\n";
echo levenshtein("abc", "", 5, 1, 1), "\n";
echo levenshtein("", "abc", 5, 1, 1), "\n";
echo levenshtein(str_repeat("a", 260), "b"), "\n";
echo similar_text("World","Word"), "\n";
echo similar_text("", ""), "\n";
$p = 0; similar_text("", "", $p); echo $p, "\n";
$p = 0; similar_text("abcdef", "fedcba", $p); echo $p, "\n";
echo metaphone("Thumb"), " ", metaphone("knight"), " ", metaphone("character"), " ", metaphone("science"), " ", metaphone("which"), " ", metaphone("ghost"), " ", metaphone("aeroplane"), "\n";
echo metaphone("Schmidt"), " ", metaphone("xylophone"), " ", metaphone("wright"), " ", metaphone("Philip"), " ", metaphone("judge"), "\n";
echo soundex("123"), "|", soundex("!!!"), "|", soundex("A1B2"), "|", soundex("Pfister"), "|", soundex("Honeyman"), "\n";
// comparisons
$cmp = array("a", "A", "b", "10", "9", "img12", "img10", "img2", "IMG2", "abc", "abd", "ab", "", "x1y20", "x1y3");
foreach ($cmp as $x) {
    $row = "";
    foreach ($cmp as $y) {
        $r = array(strcmp($x, $y), strcasecmp($x, $y), strnatcmp($x, $y), strnatcasecmp($x, $y), strncmp($x, $y, 2), strncasecmp($x, $y, 1));
        foreach ($r as $k => $v) $r[$k] = $v < 0 ? "-" : ($v > 0 ? "+" : "0");
        $row .= implode("", $r) . " ";
    }
    echo str_pad($x, 6), $row, "\n";
}
echo strncmp("abc", "abd", -1), "\n";
echo strnatcmp("a01", "a1"), strnatcmp("0.5", "0.10"), strnatcmp(" 5", "5"), strnatcmp("a  b", "a b"), "\n";
?>
