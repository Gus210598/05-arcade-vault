import HallOfFame from "@/components/HallOfFame";
import { GAMES, type ScoreRow } from "@/lib/games";
import { getTopScores } from "@/lib/scores";

export default async function HallOfFamePage() {
  const realBackendGames = GAMES.filter((g) => g.hasRealBackend);
  const entries = await Promise.all(
    realBackendGames.map(
      async (g) => [g.id, await getTopScores(g.id, 12)] as const,
    ),
  );
  const realScores: Record<string, ScoreRow[]> = Object.fromEntries(entries);

  return <HallOfFame realScores={realScores} />;
}
