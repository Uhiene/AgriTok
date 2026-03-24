import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'
import FarmerLayout from './components/layouts/FarmerLayout'
import InvestorLayout from './components/layouts/InvestorLayout'
import AdminLayout from './components/layouts/AdminLayout'

// ── Lazy page imports — each page only loads when first visited ──

// Auth
const Landing          = lazy(() => import('./pages/auth/Landing'))
const Login            = lazy(() => import('./pages/auth/Login'))
const Register         = lazy(() => import('./pages/auth/Register'))
const RegisterFarmer   = lazy(() => import('./pages/auth/RegisterFarmer'))
const RegisterInvestor = lazy(() => import('./pages/auth/RegisterInvestor'))

// Farmer
const FarmerDashboard = lazy(() => import('./pages/farmer/FarmerDashboard'))
const FarmerFarms     = lazy(() => import('./pages/farmer/FarmerFarms'))
const NewFarm         = lazy(() => import('./pages/farmer/NewFarm'))
const FarmDetail      = lazy(() => import('./pages/farmer/FarmDetail'))
const FarmerListings  = lazy(() => import('./pages/farmer/MyListings'))
const NewListing      = lazy(() => import('./pages/farmer/NewListing'))
const ListingDetail   = lazy(() => import('./pages/farmer/ListingDetail'))
const HarvestReport   = lazy(() => import('./pages/farmer/HarvestReport'))
const FarmerNotes     = lazy(() => import('./pages/farmer/FarmerNotes'))
const FarmerProfile   = lazy(() => import('./pages/farmer/FarmerProfile'))

// Investor
const InvestorDashboard   = lazy(() => import('./pages/investor/InvestorDashboard'))
const InvestorMarketplace = lazy(() => import('./pages/investor/Marketplace'))
const MarketplaceDetail   = lazy(() => import('./pages/investor/ListingDetail'))
const InvestorPortfolio   = lazy(() => import('./pages/investor/InvestorPortfolio'))
const PortfolioDetail     = lazy(() => import('./pages/investor/PortfolioDetail'))
const InvestorTransactions = lazy(() => import('./pages/investor/InvestorTransactions'))
const InvestorProfile     = lazy(() => import('./pages/investor/InvestorProfile'))

// Admin
const AdminDashboard      = lazy(() => import('./pages/admin/AdminDashboard'))
const KYCReview           = lazy(() => import('./pages/admin/KYCReview'))
const HarvestVerification = lazy(() => import('./pages/admin/HarvestVerification'))
const PlatformListings    = lazy(() => import('./pages/admin/PlatformListings'))
const AdminFarmers        = lazy(() => import('./pages/admin/AdminFarmers'))
const AdminInvestments    = lazy(() => import('./pages/admin/AdminInvestments'))
const AdminPayouts        = lazy(() => import('./pages/admin/AdminPayouts'))
const AdminSettings       = lazy(() => import('./pages/admin/AdminSettings'))

// Shared
const SharedWallet  = lazy(() => import('./pages/shared/Wallet'))
const Notifications = lazy(() => import('./pages/shared/Notifications'))
const Settings      = lazy(() => import('./pages/shared/Settings'))

// ── Page-level loading fallback ───────────────────────────────

function PageLoader() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-accent-green border-t-transparent animate-spin" />
    </div>
  )
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

// ── Router ────────────────────────────────────────────────────

export const router = createBrowserRouter([
  // ── Public ────────────────────────────────────────────────
  { path: '/',                  element: <S><Landing /></S> },
  { path: '/login',             element: <S><Login /></S> },
  { path: '/register',          element: <S><Register /></S> },
  { path: '/register/farmer',   element: <S><RegisterFarmer /></S> },
  { path: '/register/investor', element: <S><RegisterInvestor /></S> },

  // ── Protected (any authenticated user) ───────────────────
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/notifications', element: <S><Notifications /></S> },
      { path: '/settings',      element: <S><Settings /></S> },

      // ── Farmer ────────────────────────────────────────
      {
        element: <RoleRoute role="farmer" />,
        children: [{
          element: <FarmerLayout />,
          children: [
            { path: '/farmer/dashboard',     element: <S><FarmerDashboard /></S> },
            { path: '/farmer/farms',         element: <S><FarmerFarms /></S> },
            { path: '/farmer/farms/new',     element: <S><NewFarm /></S> },
            { path: '/farmer/farms/:id',     element: <S><FarmDetail /></S> },
            { path: '/farmer/listings',      element: <S><FarmerListings /></S> },
            { path: '/farmer/listings/new',  element: <S><NewListing /></S> },
            { path: '/farmer/listings/:id',  element: <S><ListingDetail /></S> },
            { path: '/farmer/harvest/:id',   element: <S><HarvestReport /></S> },
            { path: '/farmer/wallet',        element: <S><SharedWallet /></S> },
            { path: '/farmer/notes',         element: <S><FarmerNotes /></S> },
            { path: '/farmer/profile',       element: <S><FarmerProfile /></S> },
          ],
        }],
      },

      // ── Admin ─────────────────────────────────────────
      {
        element: <RoleRoute role="admin" />,
        children: [{
          element: <AdminLayout />,
          children: [
            { path: '/admin/dashboard',   element: <S><AdminDashboard /></S> },
            { path: '/admin/kyc',         element: <S><KYCReview /></S> },
            { path: '/admin/harvest',     element: <S><HarvestVerification /></S> },
            { path: '/admin/listings',    element: <S><PlatformListings /></S> },
            { path: '/admin/farmers',     element: <S><AdminFarmers /></S> },
            { path: '/admin/investments', element: <S><AdminInvestments /></S> },
            { path: '/admin/payouts',     element: <S><AdminPayouts /></S> },
            { path: '/admin/settings',    element: <S><AdminSettings /></S> },
          ],
        }],
      },

      // ── Investor ──────────────────────────────────────
      {
        element: <RoleRoute role="investor" />,
        children: [{
          element: <InvestorLayout />,
          children: [
            { path: '/investor/dashboard',       element: <S><InvestorDashboard /></S> },
            { path: '/investor/marketplace',     element: <S><InvestorMarketplace /></S> },
            { path: '/investor/marketplace/:id', element: <S><MarketplaceDetail /></S> },
            { path: '/investor/portfolio',       element: <S><InvestorPortfolio /></S> },
            { path: '/investor/portfolio/:id',   element: <S><PortfolioDetail /></S> },
            { path: '/investor/transactions',    element: <S><InvestorTransactions /></S> },
            { path: '/investor/wallet',          element: <S><SharedWallet /></S> },
            { path: '/investor/profile',         element: <S><InvestorProfile /></S> },
          ],
        }],
      },
    ],
  },
])
