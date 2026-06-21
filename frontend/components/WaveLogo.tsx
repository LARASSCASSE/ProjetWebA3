export default function WaveLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 30" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 10c5-6 12-6 18 0s13 6 18 0" stroke="#1565C0" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M3 21c5-6 12-6 18 0s13 6 18 0" stroke="#1565C0" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}
