"use client";

import { useParams } from "next/navigation";
import ProfileContent from "@/components/ProfileContent";

export default function ProfileByIdPage() {
  const params = useParams();
  const authorId = params.id as string;

  return <ProfileContent authorId={authorId} />;
}