import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-2xl text-center">
        <div className="text-6xl mb-6">🪷</div>
        <h1 className="text-5xl font-bold text-deep mb-4">
          Sincere Bhakti
        </h1>
        <p className="text-xl text-deep/70 mb-2 italic">
          &ldquo;Simple living, high thinking&rdquo;
        </p>
        <p className="text-lg text-deep/60 mb-8 max-w-xl mx-auto">
          A sacred space for devotees of Gaudiya Vaishnavism. Share your
          realizations, kirtans, scriptural insights, and devotional media with
          the saṅga.
        </p>

        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <Link
            href="/register"
            className="bg-saffron hover:bg-saffron-dark text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors shadow-md"
          >
            Join the Saṅga
          </Link>
          <Link
            href="/timeline"
            className="border-2 border-deep text-deep hover:bg-deep hover:text-warm px-8 py-3 rounded-lg text-lg font-semibold transition-colors"
          >
            View Timeline
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-white rounded-lg p-6 border border-sand">
            <div className="text-3xl mb-2">📿</div>
            <h3 className="font-semibold text-deep mb-2">Share Bhakti</h3>
            <p className="text-sm text-deep/60">
              Post your realizations, kirtan links, and devotional insights.
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 border border-sand">
            <div className="text-3xl mb-2">🌺</div>
            <h3 className="font-semibold text-deep mb-2">Sacred Media</h3>
            <p className="text-sm text-deep/60">
              Share images and videos from your spiritual journey.
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 border border-sand">
            <div className="text-3xl mb-2">🤝</div>
            <h3 className="font-semibold text-deep mb-2">Devotee Saṅga</h3>
            <p className="text-sm text-deep/60">
              Connect with fellow devotees in a respectful community.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
