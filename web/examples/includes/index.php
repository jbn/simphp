<?php
require_once 'config.php';
require_once 'lib/functions.inc.php';
include 'lib/header.inc.php';
?>
<p>This page is assembled from four files. Edit them in the file list on the left.</p>
<ul>
<?php foreach ($CONFIG['links'] as $title => $url) { ?>
  <li><?php echo link_to($title, $url); ?></li>
<?php } ?>
</ul>
<p>Included files:</p>
<pre><?php print_r(get_included_files()); ?></pre>
<p><?php echo "include_path = " . ini_get('include_path'); ?></p>
<?php
// include of a missing file is only a warning...
@include 'does-not-exist.php';
echo "<p>still running after a failed include (it was silenced with @)</p>";
include 'lib/footer.inc.php';
?>
