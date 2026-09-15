const SUPABASE_URL = "https://eumfudusjqcjbsukxcyv.supabase.co";
const SUPABASE_KEY = "sb_publishable_e9J4xKfdIbIM2STAI4lReQ_Ks-d8owd";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

console.log("Supabase connecté !");
