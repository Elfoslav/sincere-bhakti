/**
 * Hand-drawn SVG motifs for the "Dawn Sādhana" visual identity.
 * These replace emoji markers (📿 🌺 🤝) with brand-colored devotional
 * iconography: lotus, japa mala, and tulsi leaves.
 * Decorative by default — pass aria-hidden unless used as standalone imagery.
 */

export function LotusMotif({ className }: { className?: string }) {
  // A single petal shape (tip up, anchored at the base pivot 26,34). It's
  // reused and fanned out symmetrically via rotation to form the flower.
  const petal = "M26 34 C 21.5 26 21.5 15 26 7 C 30.5 15 30.5 26 26 34 Z";
  return (
    <svg
      className={className}
      width="38"
      height="31"
      viewBox="0 0 52 42"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* base / receptacle, behind the petals */}
      <path d="M18 33 A8 5 0 0 1 34 33 Z" fill="#b06a2a" />
      {/* outer petals (behind, darkest) */}
      <path d={petal} transform="rotate(-62 26 34)" fill="#c87427" />
      <path d={petal} transform="rotate(62 26 34)" fill="#c87427" />
      {/* inner petals */}
      <path d={petal} transform="rotate(-33 26 34)" fill="#e08a2e" />
      <path d={petal} transform="rotate(33 26 34)" fill="#e08a2e" />
      {/* center petal (front, brightest) */}
      <path d={petal} fill="#e8c36a" />
    </svg>
  );
}

export function MalaMotif({ className }: { className?: string }) {
  const beads = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    return {
      cx: 15 + Math.cos(angle) * 10,
      cy: 13 + Math.sin(angle) * 10,
    };
  });
  return (
    <svg
      className={className}
      width="34"
      height="34"
      viewBox="0 0 30 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {beads.map((b, i) => (
        <circle key={i} cx={b.cx} cy={b.cy} r="2.1" fill={i === 0 ? "#b8862b" : "#d4a843"} />
      ))}
      {/* tassel below the head bead */}
      <path d="M15 5.5V1.5" stroke="#b8862b" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function TulsiMotif({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="32"
      height="34"
      viewBox="0 0 28 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M14 28C14 20 14 12 14 5" stroke="#2e6b4f" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 10C10 9 6.5 6 6 2C10 2.5 13.5 5.5 14 10Z" fill="#2e6b4f" />
      <path d="M14 10C18 9 21.5 6 22 2C18 2.5 14.5 5.5 14 10Z" fill="#3a7d5c" />
      <path d="M14 19C10.5 18 7.5 15.5 7 12C10.5 12.5 13.5 15 14 19Z" fill="#3a7d5c" />
      <path d="M14 19C17.5 18 20.5 15.5 21 12C17.5 12.5 14.5 15 14 19Z" fill="#2e6b4f" />
    </svg>
  );
}
