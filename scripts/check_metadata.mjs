(async ()=>{
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {console.error('missing env'); process.exit(1);}
  const c = createClient(url,key, { auth: { persistSession: false }});
  const res = await c.from('shops').select('metadata').limit(1);
  console.log(JSON.stringify(res, null, 2));
})();
