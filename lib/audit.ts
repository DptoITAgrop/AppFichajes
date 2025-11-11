import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function logAction(user: string, action: string, details?: string, ip?: string) {
  await supabase.from("audit_logs").insert([{ user, action, details, ip }]);
}
