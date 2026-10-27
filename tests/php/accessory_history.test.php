<?php
require_once __DIR__ . '/../../pricing_history.php';

function ok($v, $m) { if (!$v) { fwrite(STDERR, "FAIL: $m\n"); exit(1); } }
function same($a, $b, $m) { ok($a === $b, $m . ' (got ' . var_export($a, true) . ')'); }

$meta=['quotationId'=>18,'refNo'=>'Q-2026-0018','date'=>'2026-10-25','customer'=>'ABC HARDWARE','phone'=>'012-3456789','email'=>'a@b.c','address'=>'1 Jalan X'];
$item=['cleanSize'=>'M12','accessories'=>[
  'nut'=>['enabled'=>true,'qty'=>2,'finish'=>'ZP','unitPrice'=>0.45],
  'fw'=>['enabled'=>true,'qty'=>1,'finish'=>'PL','unitPrice'=>0.12],
  'custom'=>['enabled'=>true,'text'=>'  Special  Cap ','unitPrice'=>1.75],
]];
$nut=dc_accessory_history_record($item,['type'=>'nut','cleanSize'=>'M12','finish'=>'ZP'],$meta);
same($nut['type'],'Nut','Nut is typed'); same($nut['size'],'M12','Nut uses canonical size'); same($nut['finish'],'ZP','Nut finish matches'); same($nut['unitPrice'],0.45,'Nut price returned');
same($nut['customer'],'ABC HARDWARE','customer/company display name is returned (owner decision 2026-10-27)');
foreach (['phone','email','address','companyId','customerId','items','formData'] as $k) ok(!array_key_exists($k,$nut),"no $k is returned");
same(dc_accessory_history_record($item,['type'=>'nut','cleanSize'=>'M12','finish'=>'PL'],$meta),null,'wrong finish is refused');
$fw=dc_accessory_history_record($item,['type'=>'fw','cleanSize'=>'M12','finish'=>'PL'],$meta);
same($fw['type'],'Flat Washer','Flat Washer is typed'); same($fw['unitPrice'],0.12,'Flat Washer price returned');
$custom=dc_accessory_history_record($item,['type'=>'custom','cleanSize'=>'M12','text'=>'special cap'],$meta);
same($custom['unitPrice'],1.75,'Custom exact normalised text is supported');
same(dc_accessory_history_record($item,['type'=>'custom','cleanSize'=>'M12','text'=>'cap'],$meta),null,'Custom fuzzy match is refused');
$records=[
  ['refNo'=>'Q-2026-1158','date'=>'2026-10-26','type'=>'Nut','size'=>'M12','finish'=>'','unitPrice'=>0.18],
  ['refNo'=>'Q-2026-1057','date'=>'2026-10-20','type'=>'Nut','size'=>'M12','finish'=>'','unitPrice'=>0.15],
  ['refNo'=>'Q-2026-1057','date'=>'2026-10-20','type'=>'Nut','size'=>'M12','finish'=>'','unitPrice'=>0.15],
  ['refNo'=>'Q-2026-1057','date'=>'2026-10-20','type'=>'Nut','size'=>'M12','finish'=>'','unitPrice'=>0.15],
  ['refNo'=>'Q-2026-1057','date'=>'2026-10-20','type'=>'Nut','size'=>'M12','finish'=>'ZP','unitPrice'=>0.20],
  ['refNo'=>'Q-2026-1057','date'=>'2026-10-20','type'=>'Nut','size'=>'M12','finish'=>'','unitPrice'=>0.20],
];
$dedup=dc_accessory_history_deduplicate($records);
same(count($dedup),4,'exact duplicate accessory records collapse to one');
same($dedup[0]['refNo'],'Q-2026-1158','newest record remains first');
same($dedup[1]['unitPrice'],0.15,'first identical record is retained');
same($dedup[2]['finish'],'ZP','same quotation with different finish is retained');
same($dedup[3]['unitPrice'],0.20,'same quotation with different price is retained');
ok(!array_key_exists('customer',$dedup[0]),'deduplication does not add customer metadata');
$two=dc_accessory_history_deduplicate([
  ['refNo'=>'Q-2026-1057','date'=>'2026-10-02','type'=>'Nut','size'=>'M12','finish'=>'','unitPrice'=>0.15,'customer'=>'ABC'],
  ['refNo'=>'Q-2026-0586','date'=>'2026-08-18','type'=>'Nut','size'=>'M12','finish'=>'','unitPrice'=>0.15,'customer'=>'XYZ'],
]);
same(count($two),2,'the same price in two quotations stays two historical records');
echo "ok accessory history (25 assertions)\n";
