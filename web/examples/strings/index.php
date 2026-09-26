<?php
header("Content-Type: text/plain");

$s = "The quick brown fox jumps over the lazy dog";
echo "ucwords:       ", ucwords($s), "\n";
echo "strrev:        ", strrev($s), "\n";
echo "str_pad:       [", str_pad("PHP", 11, "-=", STR_PAD_BOTH), "]\n";
echo "wordwrap:\n", wordwrap($s, 15, "\n", 1), "\n";
echo "substr_count:  ", substr_count($s, "o"), "\n";
echo "similar_text:  ", similar_text("World", "Word"), "\n";
echo "levenshtein:   ", levenshtein("kitten", "sitting"), "\n";
echo "soundex/metaphone: ", soundex("Robert"), " ", metaphone("Thompson"), "\n";
echo "md5:           ", md5("php"), "\n";
echo "crc32:         ", crc32("The quick brown fox jumped over the lazy dog."), "\n";
echo "base64:        ", base64_encode("PHP 4.1.1"), "\n";
echo "sprintf:       ", sprintf("%08.3f|%-6s|%'*10s|%x|%o|%b|%c|%e", 3.14159, "ab", "pad", 255, 8, 5, 65, 12345.678), "\n";
echo "number_format: ", number_format(1234567.891, 2), " / ", number_format(1234567.891, 2, ',', '.'), "\n\n";

// Perl-compatible regular expressions
preg_match_all('/(\w)(\w*)/', "hello big world", $m, PREG_SET_ORDER);
echo "preg_match_all: ", count($m), " matches, first = ", $m[0][0], "\n";
echo "preg_replace /e: ", preg_replace('/(\d+)/e', '$1*2', "3 apples and 5 pears"), "\n";
echo "preg_split:     "; print_r(preg_split('/[\s,]+/', "a, b  c,d"));

// POSIX regular expressions (ereg) - very common in PHP 4 code
if (ereg("([0-9]{4})-([0-9]{2})-([0-9]{2})", "Date: 2001-12-10", $regs)) {
    echo "ereg:           year=$regs[1] month=$regs[2] day=$regs[3]\n";
}
echo "eregi_replace:  ", eregi_replace("FOX", "cat", $s), "\n";
echo "split:          "; print_r(split("[/.-]", "10/12-2001.x"));

echo "\nhtmlspecialchars: ", htmlspecialchars("<a href='x'>T&C</a>"), "\n";
echo "nl2br:            ", nl2br("line1\nline2"), "\n";
echo "strip_tags:       ", strip_tags("<b>bold</b> <i>text</i>", "<i>"), "\n";
echo "addslashes:       ", addslashes("It's \"quoted\""), "\n";
echo "urlencode:        ", urlencode("a b&c=d/é"), "\n";
echo "str_replace:      ", str_replace(array("a","b"), array("1","2"), "aabbcc"), "\n";
echo "strtr:            ", strtr("Hi all", array("Hi" => "Hello", "all" => "world")), "\n";
echo "sscanf:           "; print_r(sscanf("age: 25 name: Bob", "age: %d name: %s"));
?>
