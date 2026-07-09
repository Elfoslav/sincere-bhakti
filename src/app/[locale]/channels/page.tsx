import { redirect } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ChannelsPage({ params }: Props) {
  const { locale } = await params;
  redirect({ href: "/posts", locale });
}