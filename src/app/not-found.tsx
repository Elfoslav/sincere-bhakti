import { getLocale } from "next-intl/server";
import SiteLayout from "@/components/SiteLayout";
import NotFoundState from "@/components/NotFoundState";
import { getRandomInt, NOT_FOUND_JOKES } from "@/lib/not-found-jokes";

export default async function NotFound() {
  const locale = await getLocale();
  return (
    <SiteLayout locale={locale}>
      <NotFoundState jokeIndex={getRandomInt(NOT_FOUND_JOKES.length)} />
    </SiteLayout>
  );
}
