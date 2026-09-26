<?php
ini_set('precision', 17);
foreach (array(array(10,-15), array(10,-5), array(2,0.5), array(10,2.5), array(3,-2), array(7,-3), array(1.1,10), array(2,-0.5), array(10,-2), array(5,0.3)) as $p) {
  echo $p[0], "^", $p[1], " = ", pow($p[0], $p[1]), "   exp(log*y)=", exp(log($p[0]) * $p[1]), "\n";
}
?>
