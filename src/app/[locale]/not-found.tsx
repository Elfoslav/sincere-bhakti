import NotFoundState from "@/components/NotFoundState";
import { getRandomInt, NOT_FOUND_JOKES } from "@/lib/not-found-jokes";

export default function NotFoundPage() {
  return <NotFoundState jokeIndex={getRandomInt(NOT_FOUND_JOKES.length)} />;
}
