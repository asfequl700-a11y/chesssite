import { GameScreen } from "@/components/game-screen";
import { LessonList } from "@/components/lesson-list";

export const metadata = { title: "Learn" };

export default function Page() {
  return (
    <GameScreen title="Learn">
      <LessonList />
    </GameScreen>
  );
}
