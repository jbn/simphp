<?php
error_reporting(E_ALL);
$docs = array(
    "<p>Hello <b>World</b></p>",
    "<p>Para</p><!-- comment --><br/>text",
    "a < b and c > d",
    "<a href=\"x>y\">link</a>",
    "<a href='x>y'>link</a>",
    "<scr<script>ipt>alert(1)</script>",
    "unclosed <b tag here",
    "<<b>>double<</b>>",
    "<?php echo 1; ?>after php",
    "<? short ?>x",
    "text</p>more<br>end",
    "<b>bold</b><i>it</i><u>under</u><p>p</p>",
    "",
    "no tags at all",
    "<B>UPPER</B><Br>",
    "<p class=\"a\">x</p><P>y</P>",
    "1 <2> 3",
    "<!DOCTYPE html><html><body>x</body></html>",
    "<a\nhref='x'>multi\nline</a>",
    "<b>a</b\n>c",
    "5 > 3 < 4 <x>y</x>",
);
$allowed = array(null, "<b>", "<b><i>", "<p><br>", "<a>", "b", "<B>");
foreach ($docs as $d) {
    foreach ($allowed as $a) {
        $r = ($a === null) ? strip_tags($d) : strip_tags($d, $a);
        echo "[", str_replace("\n", "\\n", $r), "]";
    }
    echo "\n";
}
// fgetss-like via temp file
@mkdir("/tmp/phpsim", 0777);
$fp = fopen("/tmp/phpsim/st.html", "w");
if (!$fp) die("no scratch dir\n");
fwrite($fp, "<html>\n<b>line1</b>\n<i>line2</i> <a href='z'>q</a>\n<p>split\ntag</p>\n");
fclose($fp);
$fp = fopen("/tmp/phpsim/st.html", "r");
while (!feof($fp)) { $l = fgetss($fp, 100); echo "[", str_replace("\n", "\\n", $l), "]"; }
echo "\n";
fclose($fp);
$fp = fopen("/tmp/phpsim/st.html", "r");
while (!feof($fp)) { $l = fgetss($fp, 100, "<b>"); echo "[", str_replace("\n", "\\n", $l), "]"; }
echo "\n";
fclose($fp);
unlink("/tmp/phpsim/st.html");
?>
