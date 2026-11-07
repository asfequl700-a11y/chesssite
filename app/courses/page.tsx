import { GameScreen } from "@/components/game-screen";
import { CourseList } from "@/components/courses";

export const metadata = { title: "Courses" };

export default function Page() {
  return (
    <GameScreen title="Courses">
      <CourseList />
    </GameScreen>
  );
}
