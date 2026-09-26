<?php
error_reporting(E_ALL);
$s = "O'Reilly \"quoted\" back\\slash nul\0byte";
echo addslashes($s), "\n";
echo bin2hex(addslashes($s)), "\n";
echo stripslashes(addslashes($s)) === $s ? "roundtrip ok\n" : "roundtrip BAD\n";
echo stripslashes("a\\\\b\\'c\\\"d\\0e\\nf\\"), "\n";
echo bin2hex(stripslashes("\\0\\\\0")), "\n";
echo addcslashes("foo[bar]", 'A..Z'), "\n";
echo addcslashes("zoo['.']", 'z..A'), "\n";
echo addcslashes("Hello\tWorld\n\x01\x7f\xff", "\0..\37!@\177..\377"), "\n";
echo addcslashes("abcdef", "a..c"), "\n";
echo addcslashes("abc", ""), "\n";
echo addcslashes("a\\b", "\\"), "\n";
echo addcslashes("\r\n\t\v\f\x07\x08", "\0..\37"), "\n";
echo stripcslashes('a\n\t\x41\101\\\\z\q'), "|\n";
echo bin2hex(stripcslashes('\a\b\f\v\r\0\x7\777')), "\n";
echo stripcslashes('\x4g'), "|", stripcslashes('abc\\'), "|\n";
echo quotemeta("1+1=2? (yes) [no] ^$ \\ * ."), "\n";
echo quotemeta(""), "|\n";
echo escapeshellarg("hello"), " ", escapeshellarg("it's"), " ", escapeshellarg(""), " ", escapeshellarg("a b;c"), "\n";
echo escapeshellcmd("ls -l; rm -rf / & echo `x` | y > z < w \$HOME * ? [a] {b} ~ ^ #"), "\n";
echo escapeshellcmd("'quoted' \"double\""), "\n";
// htmlspecialchars
$h = "<a href='x'>T&amp;\"C\"</a> \xe9 \xa0 &#169; &nbsp;";
echo htmlspecialchars($h), "\n";
echo htmlspecialchars($h, ENT_QUOTES), "\n";
echo htmlspecialchars($h, ENT_NOQUOTES), "\n";
echo htmlspecialchars($h, ENT_COMPAT), "\n";
echo htmlentities($h), "\n";
echo htmlentities($h, ENT_QUOTES), "\n";
echo htmlentities($h, ENT_NOQUOTES), "\n";
echo htmlentities($h, ENT_QUOTES, "ISO-8859-1"), "\n";
echo htmlentities(implode("", array_map("chr", range(160, 255)))), "\n";
echo ENT_COMPAT, ENT_QUOTES, ENT_NOQUOTES, HTML_SPECIALCHARS, HTML_ENTITIES, "\n";
$t = get_html_translation_table(HTML_SPECIALCHARS);
ksort($t); foreach ($t as $k => $v) echo bin2hex($k), "=$v ";
echo "\n";
$t = get_html_translation_table(HTML_SPECIALCHARS, ENT_QUOTES);
echo count($t), "\n";
$t = get_html_translation_table(HTML_SPECIALCHARS, ENT_NOQUOTES);
echo count($t), "\n";
$t = get_html_translation_table(HTML_ENTITIES);
echo count($t), "\n";
ksort($t); $i = 0; foreach ($t as $k => $v) { echo bin2hex($k), "=$v "; if (++$i % 8 == 0) echo "\n"; }
echo "\n";
echo strtr("&lt;b&gt; &amp;amp; &eacute;", array_flip(get_html_translation_table(HTML_ENTITIES))), "\n";
?>
