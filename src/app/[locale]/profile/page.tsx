import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect({ href: "/posts", locale });
  }

  redirect({ href: `/profile/${session.user.id}`, locale });
}