const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function runDailyCheck() {
  // Target date: exactly 7 days from today
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);
  const targetDateStr = targetDate.toISOString().split('T')[0];

  console.log(`Checking for maintenance due on: ${targetDateStr}`);

  const { data: dueServices, error } = await supabase
    .from('unit_services')
    .select('id, service_type, next_due_date, apartments(unit_number, building_name)')
    .eq('next_due_date', targetDateStr)
    .eq('reminder_sent', false);

  if (error || !dueServices.length) {
    console.log('No reminders to send today.');
    return;
  }

  for (const item of dueServices) {
    const text = `🔔 *Maintenance Reminder (Due in 7 Days)*\n\n🏢 *Unit:* ${item.apartments.unit_number} (${item.apartments.building_name})\n🛠️ *Service:* ${item.service_type}\n📅 *Due Date:* ${item.next_due_date}\n\nPlease schedule vendor visits.`;

    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${process.env.ADMIN_WHATSAPP_NUMBER}`,
      body: text,
    });

    await supabase.from('unit_services').update({ reminder_sent: true }).eq('id', item.id);
    console.log(`Alert sent for ${item.apartments.unit_number} - ${item.service_type}`);
  }
}

runDailyCheck();
