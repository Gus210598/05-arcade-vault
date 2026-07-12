import { notFound } from "next/navigation";
import GamePlayer from "@/components/GamePlayer";
import { GAMES } from "@/lib/games";

export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
