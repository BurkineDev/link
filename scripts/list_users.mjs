(async ()=>{
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url === undefined || key === undefined) {
    console.error('missing env', { url, key });
    process.exit(1);
  }
  const c = createClient(url,key);
  const users = await c.auth.admin.listUsers();
  console.log(JSON.stringify(users, null, 2));
})();
