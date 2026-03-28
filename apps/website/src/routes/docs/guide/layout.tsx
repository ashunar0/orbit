export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-semibold mb-2">Guide</h3>
      <div className="pl-4 border-l-2 border-orange-400">
        {children}
      </div>
    </div>
  );
}
