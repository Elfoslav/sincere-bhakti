"use client";

import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
			<Button
				onClick={onClose}
				variant="icon-light"
				size="icon-lg"
				className="absolute top-4 right-4 rounded-full bg-black/50 hover:bg-black/70"
				aria-label="Close"
				icon={<X className="size-6" />}
			/>

			{currentIndex > 0 && (
				<Button
					onClick={(e) => {
						e.stopPropagation();
						onNavigate(currentIndex - 1);
					}}
					variant="icon-light"
					className="absolute left-4 top-1/2 size-12 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70"
					aria-label="Previous image"
					icon={<ChevronLeft className="size-8" />}
				/>
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
				<Button
					onClick={(e) => {
						e.stopPropagation();
						onNavigate(currentIndex + 1);
					}}
					variant="icon-light"
					className="absolute right-4 top-1/2 size-12 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70"
					aria-label="Next image"
					icon={<ChevronRight className="size-8" />}
				/>
			)}

			<div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 rounded-full px-3 py-1 text-white/70 text-sm">
				{currentIndex + 1} / {images.length}
			</div>
		</div>
	);
}
