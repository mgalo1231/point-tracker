import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qolxdbrchwmcyokdoziy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvbHhkYnJjaHdtY3lva2Rveml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MDQyMzYsImV4cCI6MjA3OTI4MDIzNn0.7oL8ACr0QyD4iVDDh1SWljknnwuhvn4QosI51Z9LLPQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
