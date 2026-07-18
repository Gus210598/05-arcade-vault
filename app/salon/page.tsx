import HallOfFame from "@/components/HallOfFame";
import { getTopScores } from "@/lib/scores";

export default async function HallOfFamePage() {
  const asteroidsScores = await getTopScores("asteroides", 12);

  return <HallOfFame asteroidsScores={asteroidsScores} />;
}
