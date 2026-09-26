<?php
$s = "Hello, World";
echo strlen($s), strtolower($s), strtoupper($s), ucfirst("abc"), ucwords("hello big-world foo_bar"), "\n";
echo substr($s, 7), "|", substr($s, -5, 3), "|", substr($s, 3, -3), "|", var_export(substr($s, 20), true), "|", substr($s, -20, 2), "\n";
echo strpos($s, "o"), "|", strrpos($s, "o"), "|", var_export(strpos($s, "z"), true), "|", strpos($s, "o", 5), "|", stristr($s, "WOR"), "|", strstr($s, ","), "|", strrchr($s, "o"), "\n";
echo str_replace("l", "L", $s), "|", str_replace(array("H", "W"), "_", $s), "|", substr_replace($s, "XX", 3, 2), "|", str_repeat("ab", 3), "\n";
echo trim("  x  "), "|", rtrim("xyy", "y"), "|", ltrim("0012", "0"), "|", trim("[abc]", "[]"), "|", chop("abc \n"), "|", trim("abcxcba", "a..c"), "\n";
echo str_pad("5", 3, "0", STR_PAD_LEFT), str_pad("x", 5, "ab"), str_pad("x", 6, "-", STR_PAD_BOTH), "\n";
echo implode(",", explode(" ", "a b  c")), "|", implode("|", explode(",", "a,b,c", 2)), "|", join("-", array(1, 2)), "\n";
print_r(explode(",", "")); print_r(explode(",", ",a,"));
echo strcmp("a", "b"), strcmp("b", "a"), strcmp("a", "a"), strcasecmp("HELLO", "hello"), strncmp("abcd", "abef", 2), strncasecmp("ABx", "aby", 2), strnatcmp("img12", "img10"), strnatcasecmp("A1", "a2"), "\n";
echo nl2br("a\nb\r\nc"), "|", htmlspecialchars("<>&\"'"), "|", htmlentities("café <b>"), "|", html_entity_decode("&lt;&amp;&gt;&eacute;"), "\n";
echo addslashes("O'Re\"il\\ly\0x"), "|", stripslashes("O\\'Re\\\\ily"), "|", addcslashes("foo[bar]", 'A..Z'), "|", stripcslashes('a\tb\x41'), "|", quotemeta("1+1=2?"), "\n";
echo strrev("abc"), str_word_count("The quick brown"), "|", wordwrap("A very long woooooooooooord.", 8, "\n", 1), "|", wordwrap("short", 10), "\n";
echo chunk_split("abcdefg", 3, "-"), "|", strtr("Hi all", "ai", "eo"), "|", strtr("Hi all", array("Hi" => "Hello", "Hello" => "x")), "\n";
echo sprintf("[%s] [%5s] [%-5s] [%05d] [%5.1f] [%-8.3f] [%x] [%X] [%o] [%b] [%c] [%%] [%u] [%e] [%.2e]", "s", "ab", "ab", 42, 3.14159, 2.5, 255, 255, 8, 10, 65, -1, 1234.5678, 0.000123), "\n";
echo sprintf("%'.10d|%+d|%+d|%1\$s|%2\$s", 42, 5, -5), "\n";
echo sprintf("%s %s", "only one"), "\n";
echo sprintf("%d %d %d", "12abc", 3.99, -3.99), "|", sprintf("%.0f %.1f %.2f %.3f", 2.5, 0.05, 1.005, 1.0005), "\n";
echo sprintf("%10.4f|%-10.2f|%010.3f", -3.14159, 2.5, -1.5), "\n";
printf("%s\n", 1.0); printf("%d%%\n", 50); echo vsprintf("%2\$s %1\$s\n", array("a", "b"));
echo number_format(1234.5), "|", number_format(1234.5678, 2), "|", number_format(-1234.567, 1, ',', ' '), "|", number_format(0.5), "|", number_format(1.5), "|", number_format(2.5), "\n";
echo ord("A"), chr(66), chr(256 + 67), bin2hex("abc"), strtoupper(dechex(3735928559)), "\n";
echo md5(""), " ", md5("The quick brown fox"), " ", crc32("hello"), "\n";
echo base64_encode("\x00\xff binary"), " ", base64_decode("SGVsbG8="), " ", urlencode("a b+c&d=e/f?g~h.i_j-k*"), " ", rawurlencode("a b+c~"), " ", urldecode("a+b%20c"), " ", rawurldecode("a+b%20c"), "\n";
echo soundex("Tymczak"), soundex("Lloyd"), metaphone("Knight"), metaphone("Thumb"), levenshtein("flaw", "lawn"), similar_text("Hello", "World", $pct), round($pct, 4), "\n";
echo str_word_count("Hello fri3nd, you're looking good today!"), " ", ucfirst(""), strlen(str_repeat("x", 0)), "\n";
echo substr_count("hello hello hello", "ll"), " ", count_chars("abcab", 3), " ", strspn("42 is the answer", "1234567890"), " ", strcspn("abcd", "cd"), "\n";
print_r(sscanf("12 apples and 3.5 pears", "%d %s and %f %s"));
print_r(count_chars("hello", 1));
echo strip_tags("<p>Hello <b>World</b><br/> <!-- c --> <?php echo 1; ?>x</p>", "<b>"), "\n";
echo nl2br("x"), ltrim("\t\n x"), strval(0.1 + 0.2), strval(1/3), "\n";
echo implode(",", str_split_polyfill("abcdef", 2)), "\n";
function str_split_polyfill($s, $n) { $out = array(); for ($i = 0; $i < strlen($s); $i += $n) $out[] = substr($s, $i, $n); return $out; }
echo function_exists("money_format") ? "mf" : "no mf", function_exists("str_split") ? " ss" : " no ss", function_exists("file_get_contents") ? " fgc" : " no fgc", function_exists("sha1") ? " sha1" : " no sha1", "
"; ?>
