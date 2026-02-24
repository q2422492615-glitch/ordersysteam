import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testLifecycle() {
    const testId = crypto.randomUUID();
    console.log('Testing with ID:', testId);

    // 1. Insert
    const { data: insertData, error: insertErr } = await supabase.from('reservations').upsert({
        id: testId,
        room_id: 'r1',
        customer_name: 'Lifecycle Test',
        phone: '123456789',
        pax: 2,
        standard_price: 100,
        total_price: 200,
        period: 'lunch',
        reservation_date: '2026-02-24',
        status: 'pending'
    });
    console.log('Insert Error:', insertErr);

    // 2. Select to verify
    const { data: verifyData } = await supabase.from('reservations').select('id, customer_name').eq('id', testId);
    console.log('Verify Inserted:', verifyData);

    // 3. Update
    const { error: updateErr } = await supabase.from('reservations').update({ customer_name: 'Updated Name' }).eq('id', testId);
    console.log('Update Error:', updateErr);

    // 4. Delete
    const { error: deleteErr } = await supabase.from('reservations').delete().eq('id', testId);
    console.log('Delete Error:', deleteErr);

    // 5. Select to verify deletion
    const { data: finalData } = await supabase.from('reservations').select('id').eq('id', testId);
    console.log('Final Verify (should be empty):', finalData);
}

testLifecycle();
