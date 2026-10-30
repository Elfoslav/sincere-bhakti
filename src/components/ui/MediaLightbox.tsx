"use client";

import { useEffect, useCallback, useRef, useState, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { useLightboxHistory } from "@/lib/hooks/useLightboxHistory";
import { useTranslations } from "next-intl";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadableMedia } from "@/components/ui/loadable-media";

const MIN_SWIPE_DISTANCE = 50;
const SWIPE_CLICK_SUPPRESSION_MS = 400;

export default function MediaLightbox({
	images,
	currentIndex,
	onClose,
	onNavigate,
}: {
	images: { url: string; type?: string }[];
	currentIndex: number;
	onClose: () => void;
	onNavigate: (index: number) => void;
}) {
	const t = useTranslations("MediaLightbox");
	const dialogRef = useRef<HTMLDivElement>(null);
	const close = useLightboxHistory(onClose);
	const touchStart = useRef<{ id: number; x: number; y: number; index: number } | null>(null);
	const ignoreClickUntil = useRef(0);
	const [slide, setSlide] = useState<{ index: number; direction: "next" | "previous" | null }>({ index: currentIndex, direction: null });
	// Update before committing the keyed media so it enters in the correct
	// direction without flashing first. Opening the viewer stays motionless.
	if (slide.index !== currentIndex) {
		setSlide({ index: currentIndex, direction: currentIndex > slide.index ? "next" : "previous" });
	}

	function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
		// A fresh tap must always be able to use Close or the arrow controls.
		ignoreClickUntil.current = 0;
		touchStart.current = null;
		if (event.touches.length !== 1 || (window.visualViewport?.scale ?? 1) > 1) return;
		if (event.target instanceof Element && event.target.closest("button, video, a, input, textarea")) return;
		const touch = event.touches[0];
		touchStart.current = { id: touch.identifier, x: touch.clientX, y: touch.clientY, index: currentIndex };
	}

	function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
		const start = touchStart.current;
		touchStart.current = null;
		if (!start || event.touches.length || start.index !== currentIndex || (window.visualViewport?.scale ?? 1) > 1) return;
		const touch = Array.from(event.changedTouches).find((item) => item.identifier === start.id);
		if (!touch) return;
		const dx = touch.clientX - start.x;
		const dy = touch.clientY - start.y;
		if (Math.abs(dx) < MIN_SWIPE_DISTANCE || Math.abs(dx) <= Math.abs(dy) * 1.25) return;
		// Some browsers emit a click after a swipe. It must not close the
		// backdrop or activate a control under the finger, even at either end.
		ignoreClickUntil.current = Date.now() + SWIPE_CLICK_SUPPRESSION_MS;
		const next = currentIndex + (dx < 0 ? 1 : -1);
		if (next >= 0 && next < images.length) onNavigate(next);
	}


	// Move focus into the dialog on open and hand it back to the opener on close.
	useEffect(() => {
		const opener = document.activeElement as HTMLElement | null;
		dialogRef.current?.focus();
		return () => opener?.focus?.();
	}, []);

	// Navigating to the first/last image unmounts the focused arrow button;
	// recapture focus so it never falls back to the page behind the dialog.
	useEffect(() => {
		const dialog = dialogRef.current;
		if (dialog && !dialog.contains(document.activeElement)) dialog.focus();
	}, [currentIndex]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Tab") {
				const dialog = dialogRef.current;
				if (!dialog) return;
				const focusable = dialog.querySelectorAll<HTMLElement>('button:not([disabled]), video[controls]');
				if (focusable.length === 0) {
					e.preventDefault();
					return;
				}
				const first = focusable[0];
				const last = focusable[focusable.length - 1];
				const active = document.activeElement;
				if (e.shiftKey && (active === first || active === dialog)) {
					e.preventDefault();
					last.focus();
				} else if (!e.shiftKey && active === last) {
					e.preventDefault();
					first.focus();
				} else if (!dialog.contains(active)) {
					e.preventDefault();
					first.focus();
				}
				return;
			}
			if (e.key === "Escape") close();
			if (e.target instanceof HTMLVideoElement) return;
			if (e.key === "ArrowLeft" && currentIndex > 0) onNavigate(currentIndex - 1);
			if (e.key === "ArrowRight" && currentIndex < images.length - 1) onNavigate(currentIndex + 1);
		},
		[currentIndex, images.length, close, onNavigate],
	);

	useEffect(() => {
		document.addEventListener("keydown", handleKeyDown);
		const overflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = overflow;
		};
	}, [handleKeyDown]);

	const img = images[currentIndex];

	return createPortal(
		<div
			ref={dialogRef}
			tabIndex={-1}
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 outline-none overscroll-contain overflow-hidden"
			onTouchStart={handleTouchStart}
			onTouchMove={(event) => { if (event.touches.length !== 1) touchStart.current = null; }}
			onTouchEnd={handleTouchEnd}
			onTouchCancel={() => { touchStart.current = null; }}
			onClickCapture={(event) => {
				if (Date.now() < ignoreClickUntil.current) {
					event.preventDefault();
					event.stopPropagation();
				}
			}}
			onClick={close}
			role="dialog"
			aria-modal="true"
			aria-label={t("title")}
		>
			<div className="absolute inset-x-0 top-0 z-20 flex justify-end bg-black/80 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-3 pl-3" onClick={(e) => e.stopPropagation()}>
				<Button
					onClick={close}
					variant="icon-light"
					className="h-11 rounded-full bg-white/15 px-4 text-white hover:bg-white/25"
					icon={<X className="size-5" />}
				>
					{t("close")}
				</Button>
			</div>

			{currentIndex > 0 && (
				<Button
					onClick={(e) => {
						e.stopPropagation();
						onNavigate(currentIndex - 1);
					}}
					variant="icon-light"
					className="absolute z-10 left-2 sm:left-4 top-1/2 size-12 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70"
					aria-label={t("previous")}
					icon={<ChevronLeft className="size-8" />}
				/>
			)}

			{/* Clicks inside the media frame (incl. the Retry button) must not
			    reach the backdrop's close handler. */}
			<div className="max-w-full px-2 pt-[calc(5rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
				<LoadableMedia
					key={currentIndex}
					className={`bg-[conic-gradient(var(--muted)_25%,var(--card)_0_50%,var(--muted)_0_75%,var(--card)_0)] bg-[length:24px_24px] rounded overflow-hidden data-[status=loading]:min-h-[40vh] data-[status=loading]:min-w-[min(90vw,24rem)] data-[status=error]:min-w-[min(90vw,24rem)] ${slide.direction ? `media-lightbox-slide-${slide.direction}` : ""}`}
				>
					{({ ref, onLoad, onError }) => img.type === "video" ? (
						<video ref={ref} src={img.url} controls playsInline preload="metadata" aria-label={t("video")}
							className="max-w-[95vw] max-h-[calc(100dvh-8rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]"
							onLoadedMetadata={onLoad} onError={onError} />
					) : (
						// Using <img> for lightbox full-size display: user-uploaded images already
						// on R2, shown at original resolution, no optimization needed for modal view.
						<img
							ref={ref}
							src={img.url}
							alt={t("imageAlt", { current: currentIndex + 1, total: images.length })}
							className="max-w-[95vw] max-h-[calc(100dvh-8rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] object-contain"
							onLoad={onLoad}
							onError={onError}
						/>
					)}
				</LoadableMedia>
			</div>

			{currentIndex < images.length - 1 && (
				<Button
					onClick={(e) => {
						e.stopPropagation();
						onNavigate(currentIndex + 1);
					}}
					variant="icon-light"
					className="absolute z-10 right-2 sm:right-4 top-1/2 size-12 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70"
					aria-label={t("next")}
					icon={<ChevronRight className="size-8" />}
				/>
			)}

			<div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 bg-black/50 rounded-full px-3 py-1 text-white/70 text-sm">
				{currentIndex + 1} / {images.length}
			</div>
		</div>,
		document.body,
	);
}
