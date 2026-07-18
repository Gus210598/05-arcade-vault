import { createClient } from "@/lib/supabase/client";

// Client-side (usa lib/supabase/client.ts) — llamado desde GamePlayer.tsx
export async function saveScoreToSupabase(entry: {
  gameId: string;
  playerName: string;
  score: number;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("scores").insert({
    game_id: entry.gameId,
    player_name: entry.playerName,
    score: entry.score,
  });

  if (error) throw error;
}
