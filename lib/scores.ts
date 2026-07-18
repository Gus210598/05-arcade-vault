import { createClient as createServerClient } from "@/lib/supabase/server";

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/yyyy, formateado desde created_at
}

function formatDate(createdAt: string): string {
  const d = new Date(createdAt);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

// Server-side (usa lib/supabase/server.ts) — llamado desde Server Components
export async function getTopScores(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("scores")
    .select("player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row, i) => ({
    rank: i + 1,
    name: row.player_name,
    score: row.score,
    date: formatDate(row.created_at),
  }));
}

export async function getGameStats(
  gameId: string,
): Promise<{ best: number; plays: number }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("scores")
    .select("score")
    .eq("game_id", gameId);

  if (error || !data || data.length === 0) {
    return { best: 0, plays: 0 };
  }

  return {
    best: Math.max(...data.map((row) => row.score)),
    plays: data.length,
  };
}
