import WaveLogo from "@/components/WaveLogo";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <WaveLogo className="h-7 w-11" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-[#1F2937]">Votre fil est calme</h2>
      <p className="mt-1 text-sm text-[#6B7280]">
        Suivez quelques comptes pour voir leurs posts apparaître ici.
      </p>
      <button className="mt-5 rounded-lg border border-[#1565C0] px-4 py-2 text-sm font-semibold text-[#1565C0]">
        Découvrir des comptes
      </button>
    </div>
  );
}
