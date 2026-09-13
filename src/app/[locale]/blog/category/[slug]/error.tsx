import ErrorState from "@/components/ErrorState";

export default function BlogCategoryError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState {...props} />;
}
