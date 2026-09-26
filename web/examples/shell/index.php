<?php
// PHP 4 scripts often shelled out. The simulated server has a small /bin/sh
// with the usual Linux commands, and a sendmail that delivers into
// /var/mail/outbox (see the file list after running this).
header("Content-Type: text/plain");

echo "whoami:   ", `whoami`;
echo "uname -a: ", shell_exec("uname -a");
echo "date:     ", exec("date"), "\n\n";

echo "exec() with output lines and exit status:\n";
exec("ls -l /var/www", $lines, $status);
foreach ($lines as $l) echo "  | $l\n";
echo "  exit status: $status\n\n";

echo "system() returns the last line and prints everything:\n";
$last = system("echo one; echo two; echo three | tr a-z A-Z");
echo "  last line was: $last\n\n";

echo "Pipes, redirection and exit codes:\n";
passthru("printf 'pear\\napple\\nfig\\napple\\n' | sort | uniq -c");
exec("grep -q nothing /etc/passwd", $o, $rc);
echo "  grep exit status: $rc\n";
echo "  ", shell_exec("nosuchcommand 2>&1");
echo "\n";

$fp = popen("wc -w", "w");
fwrite($fp, "counting words through a pipe\n");
pclose($fp);

echo "\nSending mail:\n";
$ok = mail("rasmus@example.com", "Greetings from PHP " . PHP_VERSION,
           "This message went through /usr/sbin/sendmail -t -i.\n",
           "From: webmaster@localhost\r\nX-Mailer: PHP/" . phpversion());
echo "  mail() returned ", $ok ? "TRUE" : "FALSE", "\n\n";
echo shell_exec("cat /var/mail/outbox");
?>
