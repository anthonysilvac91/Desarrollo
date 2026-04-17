export default function MobileAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // We enforce a mobile-like container centered on desktop for testing, 
    // and full width on actual mobile devices. Max-w-md provides a nice app feel.
    <div className="font-sans min-h-screen bg-app-bg transition-colors flex justify-center w-full">
      <div className="w-full max-w-md bg-app-bg min-h-screen flex flex-col relative shadow-2xl overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
