<?php
error_reporting(E_ALL);
$texts = array(
    "The quick brown fox sat over the lazy dog",
    "A very long woooooooooooord.",
    "short",
    "",
    "   spaces   everywhere   ",
    "line1\nline2 is here and it is longer\nline3",
    "abcdefghijklmnopqrstuvwxyz",
);
$widths = array(3, 5, 10, 15, 20, 75); // width 1-2 with cut over-reads the buffer in 4.1.1 (undefined output)
foreach ($texts as $t) {
    foreach ($widths as $w) {
        echo "w=$w nc: [", str_replace("\n", "|", wordwrap($t, $w)), "]\n";
        echo "w=$w  c: [", str_replace("\n", "|", wordwrap($t, $w, "\n", 1)), "]\n";
    }
}
echo wordwrap("The quick brown fox", 10, "<br>\n"), "\n";
echo wordwrap("The quick brown fox", 10, "<br>"), "\n";
echo wordwrap("The quick brown fox"), "\n";
echo "[", @wordwrap("abc def", 0), "]\n";
echo "[", wordwrap("abc def ghi", -1, "#"), "]\n";
echo "[", wordwrap("aaaa bbbb", 4, "##", true), "]\n";
// chunk_split
echo chunk_split("abcdefghij", 3, "|"), "\n";
echo chunk_split("abcdefghij", 5), "|\n";
echo chunk_split("abc", 10, "-"), "\n";
echo chunk_split("", 2, "-"), "|\n";
echo strlen(chunk_split(str_repeat("x", 200))), "\n";
// nl2br
echo nl2br("a\nb\r\nc\rd\n\re"), "\n";
echo nl2br(""), "|\n";
echo nl2br("\n\n"), "\n";
echo nl2br("no newlines"), "\n";
?>
