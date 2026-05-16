window.SUPABASE_URL = "https://bnnfolhrqxgxjmobclrm.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_pNxU4AFpAZPpeJ0wICLvIw_6nW90njQ";

window.db = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
);