import assert from 'node:assert/strict';
import { test } from 'node:test';
import { artistFromApi, memberFromApi, noticeFromApi, settingsFromApi, type ApiNotice } from '../src/services/catalogMapping.ts';

test('artist and member IDs, original image paths, nullable fields and tags survive mapping', () => {
  const artist = artistFromApi({ id:11, name:'TWS', name_ko:'투어스', slug:'tws', logo_path:'/static/artists/tws/logo.webp', hero_image_path:null, theme_color:'#fff', tagline:null },'http://localhost:8000');
  assert.equal(artist.id,11); assert.equal(artist.nameKo,'투어스');
  assert.equal(artist.logoUrl,'http://localhost:8000/static/artists/tws/logo.webp');
  assert.equal(artist.heroImageUrl,null);
  const member = memberFromApi({ id:13, name:'Member', name_en:'member', position:null, color:null, mascot:null, birthday:'2000-01-01', mbti:null, description:null, tags:['A','B'], image_path:null },'http://localhost:8000');
  assert.equal(member.id,13); assert.deepEqual(member.tags,['A','B']);
  assert.equal(member.birthday,'2000-01-01'); assert.equal(member.imageUrl,null);
});

test('notice preserves related product ID and body lines; NEW excludes future dates and seven-day boundary', () => {
  const now = Date.parse('2026-10-27T00:00:00Z');
  const row: ApiNotice = { id:9, artist_slug:'tws', title:'Notice', body:'## title\n- item', product_id:281, is_pinned:true, show_in_topbar:false, published_at:'2026-10-26T00:00:00Z' };
  assert.deepEqual(noticeFromApi(row,now).body,['## title','- item']);
  assert.equal(noticeFromApi(row,now).productId,281);
  assert.equal(noticeFromApi(row,now).isNew,true);
  assert.equal(noticeFromApi({ ...row,published_at:'2026-10-28T00:00:00Z' },now).isNew,false);
  assert.equal(noticeFromApi({ ...row,published_at:'2026-10-20T00:00:00Z' },now).isNew,false);
  assert.deepEqual(noticeFromApi({ ...row,body:null },now).body,[]);
});

test('shop settings preserve actual fee and threshold without substituting defaults', () => {
  const settings = settingsFromApi({ free_shipping_threshold:50000, shipping_fee:3000, ship_days_text:'2~5', company_name:'Shop', ceo_name:'Owner', business_number:'demo', ecommerce_number:'demo', address:'demo', cs_phone:'demo', cs_hours:'10~18' });
  assert.equal(settings.freeShippingThreshold,50000); assert.equal(settings.shippingFee,3000);
  assert.equal(settings.companyName,'Shop'); assert.equal(settings.csHours,'10~18');
});
