function NavItem({ label, active, badge }: { label: string; active?: boolean; badge?: number }) {
  return (
    <button className={`relative flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${active ? "text-[#1565C0]" : "text-[#6B7280]"}`}>
      <span className="h-5 w-5 rounded-full border-2 border-current" />
      {label}
      {badge ? (
        <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export default function BottomNav() {
  return (
    <nav className="sticky bottom-0 flex items-center justify-around border-t border-gray-200 bg-white py-1.5">
      <NavItem label="Feed" active />
      <NavItem label="Notifs" badge={3} />
      <NavItem label="Messages" badge={2} />
      <NavItem label="Profil" />
    </nav>
  );
}
