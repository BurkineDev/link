(async ()=>{
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {console.error('missing env', { url, key }); process.exit(1);}
  const c = createClient(url,key, { auth: { persistSession: false }});
  const profiles = await c.from('profiles').select('*').limit(20);
  console.log('profiles', JSON.stringify(profiles, null, 2));
  const shops = await c.from('shops').select('*').limit(20);
  console.log('shops', JSON.stringify(shops, null, 2));
})();
