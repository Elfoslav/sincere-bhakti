"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

const dialogActionsClassName = "flex gap-2 *:flex-1 sm:*:flex-none sm:flex-wrap sm:items-center sm:justify-end";
const dialogActionButtonClassName = "flex-1 sm:flex-none sm:min-w-24 max-sm:w-full";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
	return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
	return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
	return (
		<DialogPrimitive.Backdrop
			data-slot="dialog-overlay"
			className={cn(
				"fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
				className,
			)}
			{...props}
		/>
	);
}

function DialogContent({
	className,
	children,
	showCloseButton = true,
	...props
}: DialogPrimitive.Popup.Props & {
	showCloseButton?: boolean;
}) {
	return (
		<DialogPortal>
			<DialogOverlay />
			<DialogPrimitive.Popup
				data-slot="dialog-content"
				className={cn(
					"fixed top-1/2 left-1/2 z-50 flex flex-col w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
					className,
				)}
				{...props}
			>
				{children}
				{showCloseButton && (
					<DialogPrimitive.Close
						data-slot="dialog-close"
						render={
							<Button
								variant="ghost"
								className="absolute top-2 right-2"
								size="icon-sm"
								icon={<XIcon />}
							/>
						}
					>
						<span className="sr-only">Close</span>
					</DialogPrimitive.Close>
				)}
			</DialogPrimitive.Popup>
		</DialogPortal>
	);
}

interface DialogHeaderProps extends Omit<React.ComponentProps<"div">, "title"> {
	text?: React.ReactNode;
	subheading?: React.ReactNode;
	subheadingRight?: React.ReactNode;
	titleClassName?: string;
	subheadingClassName?: string;
	subheadingRightClassName?: string;
}

function DialogHeader({
	className,
	text,
	subheading,
	subheadingRight,
	titleClassName,
	subheadingClassName,
	subheadingRightClassName,
	children,
	...props
}: DialogHeaderProps) {
	const hasStructuredContent = text || subheading || subheadingRight;

	return (
		<div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props}>
			{hasStructuredContent ? (
				<>
					{text && <DialogTitle className={titleClassName}>{text}</DialogTitle>}
					{(subheading || subheadingRight) && (
						<DialogDescription
							className={cn(
								subheadingRight && "flex items-center justify-between gap-3",
								subheadingClassName,
							)}
						>
							{subheading && <span>{subheading}</span>}
							{subheadingRight && (
								<span className={cn("shrink-0", subheadingRightClassName)}>{subheadingRight}</span>
							)}
						</DialogDescription>
					)}
				</>
			) : (
				children
			)}
		</div>
	);
}

function DialogFooter({
	className,
	showCloseButton = false,
	children,
	...props
}: React.ComponentProps<"div"> & {
	showCloseButton?: boolean;
}) {
	return (
		<div
			data-slot="dialog-footer"
			className={cn(
				// Symmetric negative margins cancel DialogContent's p-4 on all sides so
				// the muted footer band bleeds to the full popup width. (The previous
				// `w-[calc(100%+2rem)] -ml-4` set an explicit width with only a left
				// margin, which fought the flex-column stretch and left a gap.)
				"-mx-4 -mb-4 rounded-b-xl border-t bg-muted/50 p-4",
				dialogActionsClassName,
				className,
			)}
			{...props}
		>
			{children}
			{showCloseButton && (
				<DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>
			)}
		</div>
	);
}

function DialogActions({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div data-slot="dialog-actions" className={cn("w-full", dialogActionsClassName, className)} {...props} />
	);
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			className={cn("font-heading text-base leading-none font-medium", className)}
			{...props}
		/>
	);
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn(
				"text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
	dialogActionButtonClassName,
};
