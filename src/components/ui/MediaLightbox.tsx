"use client";

import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function MediaLightbox({
	images,
	currentIndex,
	onClose,
	onNavigate,
}: {
	images: { url: string }[];
	currentIndex: number;
	onClose: () => void;
	onNavigate: (index: number) => void;
}) {
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
			if (e.key === "ArrowLeft" && currentIndex > 0) onNavigate(currentIndex - 1);
			if (e.key === "ArrowRight" && currentIndex < images.length - 1) onNavigate(currentIndex + 1);
		},
		[currentIndex, images.length, onClose, onNavigate],
	);

	useEffect(() => {
		document.addEventListener("keydown", handleKeyDown);
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = "";
		};
	}, [handleKeyDown]);

	const img = images[currentIndex];

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
			onClick={onClose}
			role="dialog"
			aria-modal="true"
			aria-label="Image viewer"
		>
			<button
				onClick={onClose}
				className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
				aria-label="Close"
			>
				<X className="w-6 h-6" />
			</button>

			{currentIndex > 0 && (
				<button
					onClick={(e) => {
						e.stopPropagation();
						onNavigate(currentIndex - 1);
					}}
					className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white transition-colors"
					aria-label="Previous image"
				>
					<ChevronLeft className="w-8 h-8" />
				</button>
			)}

			<div className="bg-[conic-gradient(#e5e5e5_25%,#f5f5f5_0_50%,#e5e5e5_0_75%,#f5f5f5_0)] bg-[length:24px_24px] rounded overflow-hidden">
				<img
					src={img.url}
					alt=""
					className="max-w-[90vw] max-h-[90vh] object-contain"
					onClick={(e) => e.stopPropagation()}
				/>
			</div>

			{currentIndex < images.length - 1 && (
				<button
					onClick={(e) => {
						e.stopPropagation();
						onNavigate(currentIndex + 1);
					}}
					className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/70 hover:text-white transition-colors"
					aria-label="Next image"
				>
					<ChevronRight className="w-8 h-8" />
				</button>
			)}

			<div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
				{currentIndex + 1} / {images.length}
			</div>
		</div>
	);
}
