import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import InstallBanner from "@/components/viewer/InstallBanner";
import SecurityAlert from "@/components/viewer/SecurityAlert";
import ErrorBoundary from "@/components/ErrorBoundary";
import IpGate from "@/components/viewer/IpGate";
import RouteTransition from "@/components/viewer/RouteTransition";
import MobileBottomNav from "@/components/viewer/MobileBottomNav";
import WhatsAppFab from "@/components/viewer/WhatsAppFab";

const Index = lazy(() => import("./pages/Index"));
const LivePage = lazy(() => import("./pages/LivePage"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const MembershipPage = lazy(() => import("./pages/MembershipPage"));
const ViewerAuth = lazy(() => import("./pages/ViewerAuth"));
const CoinShop = lazy(() => import("./pages/CoinShop"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ViewerProfile = lazy(() => import("./pages/ViewerProfile"));
const ReplayPage = lazy(() => import("./pages/ReplayPage"));
const SchedulePage = lazy(() => import("./pages/SchedulePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const InstallPage = lazy(() => import("./pages/InstallPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ResellerLogin = lazy(() => import("./pages/ResellerLogin"));
const ResellerDashboard = lazy(() => import("./pages/ResellerDashboard"));

// Preload popular pages after initial render is idle
const preloadPopularPages = () => {
  import("./pages/LivePage");
  import("./pages/SchedulePage");
  import("./pages/ViewerAuth");
  import("./pages/CoinShop");
  import("./pages/MembershipPage");
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => {
  useEffect(() => {
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(preloadPopularPages);
    } else {
      setTimeout(preloadPopularPages, 2000);
    }
  }, []);

  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <IpGate>
            <Suspense fallback={<PageLoader />}>
              <RouteTransition>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/live" element={<LivePage />} />
                  <Route path="/admin" element={<AdminLogin />} />
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                  <Route path="/membership" element={<MembershipPage />} />
                  <Route path="/auth" element={<ViewerAuth />} />
                  <Route path="/coins" element={<CoinShop />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/profile" element={<ViewerProfile />} />
                  <Route path="/replay" element={<ReplayPage />} />
                  <Route path="/schedule" element={<SchedulePage />} />
                  <Route path="/install" element={<InstallPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/reseller" element={<ResellerLogin />} />
                  <Route path="/reseller/dashboard" element={<ResellerDashboard />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </RouteTransition>
            </Suspense>
            <MobileBottomNav />
          </IpGate>
        </BrowserRouter>
        <InstallBanner />
        <SecurityAlert />
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
