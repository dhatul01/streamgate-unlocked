import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import LivePage from "./pages/LivePage";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import MembershipPage from "./pages/MembershipPage";
import ViewerAuth from "./pages/ViewerAuth";
import CoinShop from "./pages/CoinShop";
import ResetPassword from "./pages/ResetPassword";
import ViewerProfile from "./pages/ViewerProfile";
import ReplayPage from "./pages/ReplayPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
