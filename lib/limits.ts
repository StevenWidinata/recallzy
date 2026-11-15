import "server-only";
import { createAdminClient } from "./supabase/admin";

export function dailyLimit() {
  const n = Number(process.env.DAILY_QUIZ_LIMIT);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

/** Today's date in UTC (matches Postgres current_date on Supabase). */
function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

/** How many quizzes this user generated today with the shared key. */
export async function usedToday(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("daily_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("day", todayUtc())
    .maybeSingle();
  if (error) throw error;
  return data?.count ?? 0;
}

export async function remainingToday(userId: string): Promise<number> {
  return Math.max(0, dailyLimit() - (await usedToday(userId)));
}

export async function recordUsage(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("increment_usage", { p_user: userId });
  if (error) throw error;
}
