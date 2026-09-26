<html><head><title>Forms &amp; request variables</title></head>
<body>
<h2>A POST form</h2>
<form method="post" action="index.php?source=form">
  <table>
  <tr><td>Name:</td><td><input type="text" name="user" value="O'Reilly"></td></tr>
  <tr><td>Quote:</td><td><input type="text" name="quote" value='He said "hi"'></td></tr>
  <tr><td>Languages:</td><td>
    <input type="checkbox" name="lang[]" value="php" checked> PHP
    <input type="checkbox" name="lang[]" value="perl" checked> Perl
    <input type="checkbox" name="lang[]" value="c"> C</td></tr>
  <tr><td>Upload:</td><td><input type="file" name="upload"></td></tr>
  </table>
  <input type="submit" name="go" value="Submit">
</form>
<p><small>(The form uses <code>enctype</code> default; add
<code>enctype="multipart/form-data"</code> to try file uploads.)</small></p>

<?php if ($REQUEST_METHOD == 'POST') { ?>
<h2>What PHP <?php echo PHP_VERSION ?> received</h2>
<p>Note <b>magic_quotes_gpc</b> is <?php echo get_magic_quotes_gpc() ? 'ON' : 'off' ?>:
quotes arrive already escaped with backslashes.</p>
<pre>
$_POST           = <?php print_r($_POST); ?>
$HTTP_POST_VARS  = <?php echo count($HTTP_POST_VARS) ?> entries (the pre-4.1 name)
$_GET            = <?php print_r($_GET); ?>
$user (register_globals) = <?php var_dump($user); ?>
stripslashes($user)      = <?php var_dump(stripslashes($user)); ?>
$_FILES          = <?php print_r($_FILES); ?>
</pre>
<?php } ?>
<h2>Try a link</h2>
<p><a href="index.php?a=1&amp;b[]=x&amp;b[]=y&amp;c[key]=val">index.php?a=1&amp;b[]=x&amp;b[]=y&amp;c[key]=val</a></p>
<?php if (count($_GET)) { echo "<pre>"; var_dump($_GET); echo "</pre>"; } ?>
</body></html>
