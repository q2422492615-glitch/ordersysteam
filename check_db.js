import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    const rooms = await supabase.from('rooms').select('id, name').limit(2);
    console.log('Rooms:', rooms.data);
    const dishes = await supabase.from('dishes').select('id, name').limit(2);
    console.log('Dishes:', dishes.data);
}

test();
