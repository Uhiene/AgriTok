import { createBrowserRouter } from 'react-router-dom'

import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'
import FarmerLayout from './components/layouts/FarmerLayout'
import InvestorLayout from './components/layouts/InvestorLayout'
import AdminLayout from './components/layouts/AdminLayout'

// Auth
import Landing from './pages/auth/Landing'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import RegisterFarmer from './pages/auth/RegisterFarmer'
import RegisterInvestor from './pages/auth/RegisterInvestor'

// Farmer
import FarmerDashboard from './pages/farmer/FarmerDashboard'
import FarmerFarms from './pages/farmer/FarmerFarms'
import NewFarm from './pages/farmer/NewFarm'
import FarmDetail from './pages/farmer/FarmDetail'
import FarmerListings from './pages/farmer/MyListings'
import NewListing from './pages/farmer/NewListing'
import ListingDetail from './pages/farmer/ListingDetail'
import HarvestReport from './pages/farmer/HarvestReport'
import SharedWallet from './pages/shared/Wallet'
import FarmerNotes from './pages/farmer/FarmerNotes'
import FarmerProfile from './pages/farmer/FarmerProfile'

// Investor
import InvestorDashboard from './pages/investor/InvestorDashboard'
import InvestorMarketplace from './pages/investor/Marketplace'
import MarketplaceDetail from './pages/investor/ListingDetail'
import InvestorPortfolio from './pages/investor/InvestorPortfolio'
import PortfolioDetail from './pages/investor/PortfolioDetail'
import InvestorTransactions from './pages/investor/InvestorTransactions'
// InvestorWallet replaced by SharedWallet
import InvestorProfile from './pages/investor/InvestorProfile'

// Admin
import AdminDashboard from './pages/admin/AdminDashboard'
import KYCReview from './pages/admin/KYCReview'
import HarvestVerification from './pages/admin/HarvestVerification'
import PlatformListings from './pages/admin/PlatformListings'
import AdminFarmers from './pages/admin/AdminFarmers'
import AdminInvestments from './pages/admin/AdminInvestments'

// Shared
import Notifications from './pages/shared/Notifications'
import Settings from './pages/shared/Settings'

export const router = createBrowserRouter([
  // ── Public ────────────────────────────────────────────────
  { path: '/', element: <Landing /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/register/farmer', element: <RegisterFarmer /> },
  { path: '/register/investor', element: <RegisterInvestor /> },

  // ── Protected (any authenticated user) ───────────────────
  {
    element: <ProtectedRoute />,
    children: [
      // Shared protected pages
      { path: '/notifications', element: <Notifications /> },
      { path: '/settings', element: <Settings /> },

      // ── Farmer role only ───────────────────────────────
      {
        element: <RoleRoute role="farmer" />,
        children: [
          {
            element: <FarmerLayout />,
            children: [
              { path: '/farmer/dashboard', element: <FarmerDashboard /> },
              { path: '/farmer/farms', element: <FarmerFarms /> },
              { path: '/farmer/farms/new', element: <NewFarm /> },
              { path: '/farmer/farms/:id', element: <FarmDetail /> },
              { path: '/farmer/listings', element: <FarmerListings /> },
              { path: '/farmer/listings/new', element: <NewListing /> },
              { path: '/farmer/listings/:id', element: <ListingDetail /> },
              { path: '/farmer/harvest/:id', element: <HarvestReport /> },
              { path: '/farmer/wallet', element: <SharedWallet /> },
              { path: '/farmer/notes', element: <FarmerNotes /> },
              { path: '/farmer/profile', element: <FarmerProfile /> },
            ],
          },
        ],
      },

      // ── Admin role only ────────────────────────────────
      {
        element: <RoleRoute role="admin" />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { path: '/admin/dashboard',   element: <AdminDashboard /> },
              { path: '/admin/kyc',         element: <KYCReview /> },
              { path: '/admin/harvest',     element: <HarvestVerification /> },
              { path: '/admin/listings',    element: <PlatformListings /> },
              { path: '/admin/farmers',     element: <AdminFarmers /> },
              { path: '/admin/investments', element: <AdminInvestments /> },
            ],
          },
        ],
      },

      // ── Investor role only ─────────────────────────────
      {
        element: <RoleRoute role="investor" />,
        children: [
          {
            element: <InvestorLayout />,
            children: [
              { path: '/investor/dashboard',      element: <InvestorDashboard /> },
              { path: '/investor/marketplace',    element: <InvestorMarketplace /> },
              { path: '/investor/marketplace/:id',element: <MarketplaceDetail /> },
              { path: '/investor/portfolio',      element: <InvestorPortfolio /> },
              { path: '/investor/portfolio/:id',  element: <PortfolioDetail /> },
              { path: '/investor/transactions',   element: <InvestorTransactions /> },
              { path: '/investor/wallet',         element: <SharedWallet /> },
              { path: '/investor/profile',        element: <InvestorProfile /> },
            ],
          },
        ],
      },
    ],
  },
])
