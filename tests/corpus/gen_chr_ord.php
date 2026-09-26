<?php
error_reporting(E_ALL);
$all = "";
for ($i = 0; $i < 256; $i++) $all .= chr($i);
echo strlen($all), " ", md5($all), " ", crc32($all), "\n";
echo bin2hex($all), "\n";
for ($i = 0; $i < 256; $i += 16) {
    echo $i, ": ", urlencode(substr($all, $i, 16)), " | ", rawurlencode(substr($all, $i, 16)), "\n";
}
echo base64_encode($all), "\n";
echo md5(base64_decode(base64_encode($all))), "\n";
echo chr(-1) === chr(255) ? "neg wraps\n" : "neg differs\n";
echo bin2hex(chr(256)), bin2hex(chr(300)), bin2hex(chr(65.7)), bin2hex(chr("66")), "\n";
echo ord(""), ord("A"), ord("ABC"), ord("\xff"), ord(5), "\n";
echo md5(""), " ", md5("a"), " ", md5("abc"), " ", md5("The quick brown fox jumps over the lazy dog"), "\n";
echo crc32(""), " ", crc32("a"), " ", crc32("The quick brown fox jumped over the lazy dog."), " ", sprintf("%u", crc32("hello")), "\n";
foreach (array("", "f", "fo", "foo", "foob", "fooba", "foobar", "\0", "\0\0", "\xff\xfe") as $s) {
    echo "[", base64_encode($s), "]";
}
echo "\n";
foreach (array("Zm9v", "Zm9vYg==", "Zm9vYg", "Zm9v\nYmFy", "Zm9v YmFy", "!!!!", "", "Z", "Zm", "Zm9", "Zm9vYmFy====", "Zm=9v") as $s) {
    echo "[", bin2hex(base64_decode($s)), "]";
}
echo "\n";
echo urldecode("a%20b+c%2Bd%zz%4"), "|", rawurldecode("a%20b+c%2Bd%"), "\n";
echo urlencode("a b&c=d/e?f#g~h.i-j_k*l@m"), "\n";
echo rawurlencode("a b&c=d/e?f#g~h.i-j_k*l@m"), "\n";
echo bin2hex(""), "|", bin2hex("abc"), "|", bin2hex(255), "\n";
echo function_exists('str_rot13') ? "has rot13\n" : "no rot13\n";
echo convert_cyr_string("\xc1\xc2\xc3 abc", "k", "w"), "|", bin2hex(convert_cyr_string("\xc1\xc2\xc3", "w", "i")), "|", bin2hex(convert_cyr_string("\xe0\xe1\xe2", "a", "d")), "\n";
echo quoted_printable_decode("H=E9llo=20World=\r\nnext=3D=41=4a=4A=zz"), "\n";
echo bin2hex(quoted_printable_decode("=00=FF=\n=")), "\n";
echo utf8_encode("caf\xe9 \xff\x80"), "|", bin2hex(utf8_encode("\xe9")), "\n";
echo bin2hex(utf8_decode("caf\xc3\xa9 \xe2\x82\xac \xf0\x9f\x98\x80 \xc3")), "\n";
echo bin2hex(utf8_decode(utf8_encode(substr($all, 128)))) == bin2hex(substr($all, 128)) ? "utf8 rt ok\n" : "utf8 rt BAD\n";
$cc = count_chars("hello world", 1);
foreach ($cc as $k => $v) echo chr($k), "=$v ";
echo "\n";
echo count_chars("hello world", 3), "|", strlen(count_chars("hello world", 4)), "\n";
echo count(count_chars("abc", 0)), " ", count(count_chars("abc", 2)), "\n";
?>
