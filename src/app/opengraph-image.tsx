import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				background: "#1a1a2e",
				color: "#f5f7fa",
				fontFamily: "sans-serif",
				padding: "60px 80px",
			}}
		>
			<div style={{ fontSize: 100, marginBottom: 20, lineHeight: 1 }}>🪷</div>
			<h1
				style={{
					fontSize: 80,
					fontWeight: 900,
					color: "#e8bf60",
					margin: "0 0 12px",
					textAlign: "center",
					letterSpacing: "0.02em",
				}}
			>
				Sincere Bhakti
			</h1>
			<p
				style={{
					fontSize: 38,
					color: "#e8dcc8",
					textAlign: "center",
					margin: 0,
					lineHeight: 1.5,
					fontWeight: 500,
				}}
			>
				A spiritual community for devotees of Gauḍīya Vaiṣṇavism
			</p>
			<p
				style={{
					fontSize: 36,
					color: "#e8bf60",
					marginTop: 36,
					opacity: 1,
					fontWeight: 900,
				}}
			>
				Share bhakti · Inspire devotion
			</p>
		</div>,
		size,
	);
}
