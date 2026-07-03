import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-md text-center">
        <div className="text-6xl mb-6">😕</div>
        <h1 className="text-6xl font-bold text-deep mb-2">404</h1>
        <p className="text-xl text-deep/70 mb-2 italic">
          &ldquo;Not found in this material world&rdquo;
        </p>
        <p className="text-deep/60 mb-8">
          The page you seek does not exist — much like lasting happiness
          outside of bhakti.
        </p>
        <Button href="/" variant="default" size="hero">
          Return Home
        </Button>
      </div>
    </div>
  );
}
