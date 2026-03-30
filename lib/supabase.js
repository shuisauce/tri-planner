import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

// ── Planner Data Operations ──

export async function loadPlanner() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("planner")
    .select("schedule, swim_hours")
    .eq("id", "main")
    .single();
  if (error) {
    console.error("Load error:", error.message);
    return null;
  }
  return data;
}

export async function savePlanner(schedule, swimHours) {
  if (!supabase) return false;
  const { error } = await supabase.from("planner").upsert({
    id: "main",
    schedule,
    swim_hours: swimHours,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("Save error:", error.message);
    return false;
  }
  return true;
}
