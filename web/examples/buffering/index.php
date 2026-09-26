<?php
// Output buffering with a callback, and headers after output.
function shout($buffer) {
    return strtoupper($buffer);
}

ob_start("shout");
echo "this text is transformed by an output callback.\n";
ob_end_flush();

ob_start();
echo "captured";
$captured = ob_get_contents();
ob_end_clean();
echo "ob_get_contents() gave us: '$captured'\n";

echo "Now we try to send a header after output has started:\n";
header("X-Too-Late: yes");   // Warning: Cannot add header information
echo "\nheaders_sent(): ", headers_sent() ? "true" : "false", "\n";
?>
