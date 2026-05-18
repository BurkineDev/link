(async ()=>{
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {console.error('missing env', { url, key }); process.exit(1);}
  const c = createClient(url,key, { auth: { persistSession: false }});
  const owner = '8adb7174-52f7-4ce8-8910-9ab39352abab';
  const res = await c.from('shops').insert({
    owner_id: owner,
    name: 'Test Shop',
    slug: 'test-shop',
    template_id: 'minimal',
    currency: 'XOF'
  }).select().single();
  console.log(JSON.stringify(res, null, 2));
})();
