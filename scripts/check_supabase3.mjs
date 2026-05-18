import('url');
import('fs');
(async ()=>{
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url === undefined || key === undefined) {
    console.error('missing env', { url, key });
    process.exit(1);
  }
  const c = createClient(url,key);
  const p = await c.from('profiles').select('*').eq('email','test@example.com');
  console.log('profiles', JSON.stringify(p, null, 2));
  const s = await c.from('shops').select('*').eq('slug','test-shop');
  console.log('shops', JSON.stringify(s, null, 2));
})();
