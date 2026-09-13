import ErrorState from "@/components/ErrorState";

export default function BlogChannelError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState {...props} />;
}
