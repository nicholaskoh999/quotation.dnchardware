<?php
require_once __DIR__ . '/../../pricing_history.php';

function ok($v, $m) { if (!$v) { fwrite(STDERR, "FAIL: $m\n"); exit(1); } }
function same($a, $b, $m) { ok($a === $b, $m . ' (got ' . var_export($a, true) . ')'); }

$meta=['quotationId'=>18,'refNo'=>'Q-2026-0018','date'=>'2026-10-25'];
$item=['cleanSize'=>'M12','accessories'=>[
  'nut'=>['enabled'=>true,'qty'=>2,'finish'=>'ZP','unitPrice'=>0.45],
  'fw'=>['enabled'=>true,'qty'=>1,'finish'=>'PL','unitPrice'=>0.12],
  'custom'=>['enabled'=>true,'text'=>'  Special  Cap ','unitPrice'=>1.75],
]];
$nut=dc_accessory_history_record($item,['type'=>'nut','cleanSize'=>'M12','finish'=>'ZP'],$meta);
same($nut['type'],'Nut','Nut is typed'); same($nut['size'],'M12','Nut uses canonical size'); same($nut['finish'],'ZP','Nut finish matches'); same($nut['unitPrice'],0.45,'Nut price returned');
ok(!array_key_exists('customer',$nut),'no customer metadata is returned');
same(dc_accessory_history_record($item,['type'=>'nut','cleanSize'=>'M12','finish'=>'PL'],$meta),null,'wrong finish is refused');
$fw=dc_accessory_history_record($item,['type'=>'fw','cleanSize'=>'M12','finish'=>'PL'],$meta);
same($fw['type'],'Flat Washer','Flat Washer is typed'); same($fw['unitPrice'],0.12,'Flat Washer price returned');
$custom=dc_accessory_history_record($item,['type'=>'custom','cleanSize'=>'M12','text'=>'special cap'],$meta);
same($custom['unitPrice'],1.75,'Custom exact normalised text is supported');
same(dc_accessory_history_record($item,['type'=>'custom','cleanSize'=>'M12','text'=>'cap'],$meta),null,'Custom fuzzy match is refused');
echo "ok accessory history (11 assertions)\n";
