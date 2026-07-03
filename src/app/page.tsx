import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function Home() {
	return (
		<div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-4 py-8">
			<div className="max-w-2xl text-center">
				<h1 className="text-5xl font-bold text-deep mb-4">
					<Image
						src="/images/sincere-bhakti-logo.png"
						alt="Sincere Bhakti"
						title="Sincere Bhakti"
						width={250}
						height={100}
						className="mx-auto mb-6"
						unoptimized
					/>
				</h1>
				<p className="text-xl text-deep/70 mb-2 italic">
					&ldquo;Simple living, high thinking&rdquo;
				</p>
				<p className="text-lg text-deep/60 mb-8 max-w-xl mx-auto">
					A sacred space for devotees of Gaudiya Vaishnavism. Share your realizations, kirtans,
					scriptural insights, and devotional media with the saṅga.
				</p>

				<div className="flex flex-wrap justify-center gap-4 mb-12">
					<Button href="/register" variant="default" size="hero">
						Join the Saṅga
					</Button>
					<Button href="/posts" variant="outline-deep" size="hero">
						Posts
					</Button>
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
