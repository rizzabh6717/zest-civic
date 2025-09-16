import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Web3Provider } from "@/contexts/Web3Context";
import { UserTypeSelector } from "@/components/UserTypeSelector";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Citizen pages
import CitizenDashboard from "./pages/citizen/Dashboard";
import SubmitGrievance from "./pages/citizen/SubmitGrievance";
import Grievances from "./pages/citizen/Grievances";
import Voting from "./pages/citizen/Voting";

// Worker pages  
import WorkerDashboard from "./pages/worker/Dashboard";
import Marketplace from "./pages/worker/Marketplace";

// DAO pages
import DAODashboard from "./pages/dao/Dashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Web3Provider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/select-role" element={<UserTypeSelector />} />
            
            {/* Citizen Routes */}
            <Route path="/citizen/dashboard" element={<CitizenDashboard />} />
            <Route path="/citizen/submit-grievance" element={<SubmitGrievance />} />
            <Route path="/citizen/grievances" element={<Grievances />} />
            <Route path="/citizen/voting" element={<Voting />} />
            <Route path="/citizen/profile" element={<CitizenDashboard />} />
            
            {/* Worker Routes */}
            <Route path="/worker/dashboard" element={<WorkerDashboard />} />
            <Route path="/worker/marketplace" element={<Marketplace />} />
            <Route path="/worker/reputation" element={<WorkerDashboard />} />
            
            {/* DAO Routes */}
            <Route path="/dao/dashboard" element={<DAODashboard />} />
            <Route path="/dao/governance" element={<DAODashboard />} />
            <Route path="/dao/bids" element={<DAODashboard />} />
            <Route path="/dao/members" element={<DAODashboard />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </Web3Provider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
