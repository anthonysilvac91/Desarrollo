import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-sans min-h-screen bg-app-bg transition-colors">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 ml-[260px]">
        <Topbar />
        
        {/* Main Content Area - Scroll is now allowed on the page level if content is long */}
        <main className="flex-1 px-8 pb-8 lg:px-14 lg:pb-12 pt-10 max-w-[1700px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
