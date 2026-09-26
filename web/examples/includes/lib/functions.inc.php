<?php
function link_to($title, $url) {
    return '<a href="' . htmlspecialchars($url) . '">' . htmlspecialchars($title) . '</a>';
}
?>
