import WaveLogo from "@/components/WaveLogo";

export default function TopBar() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <WaveLogo className="h-5 w-8" />
        <span className="text-lg font-bold text-[#1F2937]">Breezy</span>
      </div>
      <div className="h-8 w-8 rounded-full bg-gray-200" />
    </header>
  );
}
