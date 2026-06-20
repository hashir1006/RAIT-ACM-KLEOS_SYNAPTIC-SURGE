import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('URL:', SUPABASE_URL);
console.log('Service Key length:', SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY.length : 0);
console.log('Service Key prefix:', SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY.substring(0, 15) : 'none');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing URL or Key in env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function test() {
  try {
    console.log('Testing select on user_profiles...');
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('Select error:', error);
    } else {
      console.log('Select success, data:', data);
    }
  } catch (err) {
    console.error('Execution error:', err);
  }
}

test();
