import { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  ClipboardCheck,
  Coins,
  Users,
  Leaf,
  ArrowRight,
  Zap,
  Shield,
  Globe,
  ChevronRight,
} from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { getAllListings } from "../../lib/supabase/listings";
import { searchPhotos } from "../../lib/api/unsplash";
import CropCard from "../../components/CropCard";
import { useAuth } from "../../hooks/useAuth";

import logo from "../../assets/agritoken-logo.svg";

function FadeInSection({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Data hooks ────────────────────────────────────────────────

function useLandingStats() {
  return useQuery({
    queryKey: ["landing-stats"],
    queryFn: async () => {
      const [farmersRes, listingsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "farmer"),
        supabase.from("crop_listings").select("amount_raised_usd, status"),
      ]);

      const farmerCount = farmersRes.count ?? 0;
      const listings = listingsRes.data ?? [];
      const totalRaised = listings.reduce(
        (sum, l) => sum + Number(l.amount_raised_usd ?? 0),
        0,
      );
      const activeListings = listings.filter((l) => l.status === "open").length;
      return { farmerCount, totalRaised, activeListings };
    },
    staleTime: 1000 * 60 * 5,
  });
}

function useFeaturedListings() {
  return useQuery({
    queryKey: ["featured-listings"],
    queryFn: () =>
      getAllListings({ status: "open" }).then((data) => data.slice(0, 3)),
    staleTime: 1000 * 60 * 5,
  });
}

function useHeroImages() {
  return useQuery({
    queryKey: ["hero-unsplash-images"],
    queryFn: () => searchPhotos("farming africa harvest crops", 6),
    staleTime: 1000 * 60 * 60,
  });
}

// ── Navbar ────────────────────────────────────────────────────

function Navbar() {
  const { isAuthenticated, profile } = useAuth();
  const navigate = useNavigate();

  const dashboardPath =
    profile?.role === "farmer" ? "/farmer/dashboard" : "/investor/dashboard";

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-forest-dark/95 backdrop-blur-sm border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src={logo} alt="AgriToken Logo" className="h-10 w-auto" />
          <Link
            to="/"
            className="font-display text-2xl text-accent-green tracking-tight"
          >
            AgriToken
          </Link>
        </div>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-8">
          {["How It Works", "Marketplace", "For Farmers", "For Investors"].map(
            (label) => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-white/70 hover:text-white text-sm font-body transition-colors duration-200"
              >
                {label}
              </a>
            ),
          )}
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <ConnectButton.Custom>
            {({ account, openConnectModal, mounted }) => {
              if (!mounted) return null;
              return account ? (
                <button
                  onClick={() => navigate(dashboardPath)}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-pill border border-accent-green/60 text-accent-green text-sm font-body font-medium hover:border-accent-green hover:bg-accent-green/10 transition-all duration-200"
                >
                  <span className="w-2 h-2 rounded-full bg-accent-green" />
                  {account.displayName}
                </button>
              ) : (
                <button
                  onClick={openConnectModal}
                  className="hidden sm:block px-4 py-2 rounded-pill border border-white/30 text-white text-sm font-body font-medium hover:border-accent-green hover:text-accent-green transition-all duration-200"
                >
                  Connect Wallet
                </button>
              );
            }}
          </ConnectButton.Custom>

          {isAuthenticated ? (
            <Link
              to={dashboardPath}
              className="px-5 py-2 rounded-pill bg-accent-green text-forest-dark text-sm font-body font-semibold hover:bg-accent-green/90 transition-colors duration-200"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to="/register"
              className="px-5 py-2 rounded-pill bg-accent-green text-forest-dark text-sm font-body font-semibold hover:bg-accent-green/90 transition-colors duration-200"
            >
              Get Started
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────────

function HeroSection() {
  const { data: heroImages = [] } = useHeroImages();

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-forest-dark"
      style={{
        backgroundImage: `
          radial-gradient(ellipse 80% 60% at 20% 50%, rgba(26,92,56,0.35) 0%, transparent 60%),
          url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")
        `,
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-20 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left: copy */}
        <div className="space-y-8">
          <FadeInSection delay={0.1}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-pill bg-accent-green/15 border border-accent-green/30 text-accent-green text-xs font-body font-semibold uppercase tracking-widest">
              <Leaf className="w-3.5 h-3.5" />
              Real-World Asset Financing on BNB Chain
            </span>
          </FadeInSection>

          <FadeInSection delay={0.2}>
            <h1 className="font-display text-5xl sm:text-6xl xl:text-7xl text-white leading-[1.05] tracking-tight">
              Your Harvest,
              <br />
              <span className="text-accent-green">Tokenized.</span>
            </h1>
          </FadeInSection>

          <FadeInSection delay={0.3}>
            <p className="text-white/65 text-lg font-body leading-relaxed max-w-lg">
              Smallholder farmers raise pre-harvest capital by tokenizing future
              crop yields. Investors earn real yield backed by real crops,
              verified on-chain.
            </p>
          </FadeInSection>

          <FadeInSection delay={0.4}>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/register/farmer"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-pill bg-accent-green text-forest-dark font-body font-semibold text-base hover:bg-accent-green/90 transition-all duration-200 group"
              >
                I am a Farmer
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
              <Link
                to="/register/investor"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-pill bg-white/10 border border-white/20 text-white font-body font-semibold text-base hover:bg-white/15 hover:border-white/40 transition-all duration-200 group"
              >
                I am an Investor
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
            </div>
          </FadeInSection>

          <FadeInSection delay={0.5}>
            <div className="flex items-center gap-6 pt-2">
              <div className="flex -space-x-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-forest-dark bg-gradient-to-br from-forest-mid to-accent-green/60"
                  />
                ))}
              </div>
              <p className="text-white/50 text-sm font-body">
                Trusted by farmers across 6 countries
              </p>
            </div>
          </FadeInSection>
        </div>

        {/* Right: image mosaic */}
        <FadeInSection delay={0.3} className="hidden lg:block">
          <div className="grid grid-cols-3 gap-3 h-[520px]">
            {/* Tall left column */}
            <div className="flex flex-col gap-3">
              {heroImages.slice(0, 2).map((img, i) => (
                <div
                  key={img.id}
                  className={`rounded-card overflow-hidden ${i === 0 ? "flex-[1.4]" : "flex-1"}`}
                >
                  <img
                    src={img.urls.regular}
                    alt={img.alt_description ?? "Crop farming"}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {heroImages.length === 0 && (
                <>
                  <div className="flex-[1.4] rounded-card bg-forest-mid/30" />
                  <div className="flex-1 rounded-card bg-forest-mid/20" />
                </>
              )}
            </div>
            {/* Tall middle column (offset) */}
            <div className="flex flex-col gap-3 mt-6">
              {heroImages.slice(2, 4).map((img, i) => (
                <div
                  key={img.id}
                  className={`rounded-card overflow-hidden ${i === 0 ? "flex-1" : "flex-[1.4]"}`}
                >
                  <img
                    src={img.urls.regular}
                    alt={img.alt_description ?? "Harvest"}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {heroImages.length === 0 && (
                <>
                  <div className="flex-1 rounded-card bg-forest-mid/25" />
                  <div className="flex-[1.4] rounded-card bg-forest-mid/35" />
                </>
              )}
            </div>
            {/* Right column */}
            <div className="flex flex-col gap-3">
              {heroImages.slice(4, 6).map((img) => (
                <div
                  key={img.id}
                  className="flex-1 rounded-card overflow-hidden"
                >
                  <img
                    src={img.urls.regular}
                    alt={img.alt_description ?? "Farm"}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {heroImages.length === 0 && (
                <>
                  <div className="flex-1 rounded-card bg-forest-mid/20" />
                  <div className="flex-1 rounded-card bg-forest-mid/30" />
                </>
              )}
            </div>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────

function StatsBar() {
  const { data: stats } = useLandingStats();

  const formatUSD = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const items = [
    {
      label: "Farmers Registered",
      value: stats?.farmerCount ?? "—",
      icon: Users,
    },
    {
      label: "Total Capital Raised",
      value: stats ? formatUSD(stats.totalRaised) : "—",
      icon: Coins,
    },
    {
      label: "Active Listings",
      value: stats?.activeListings ?? "—",
      icon: Leaf,
    },
    {
      label: "Countries",
      value: 6,
      icon: Globe,
    },
  ];

  return (
    <section
      id="for-farmers"
      className="bg-cream border-y border-forest-dark/[0.08]"
    >
      <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
        {items.map(({ label, value, icon: Icon }, i) => (
          <FadeInSection key={label} delay={i * 0.08}>
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-card bg-forest-dark/6 flex items-center justify-center">
                <Icon className="w-5 h-5 text-forest-mid" />
              </div>
              <p className="font-display text-4xl text-forest-dark">{value}</p>
              <p className="text-text-muted text-sm font-body">{label}</p>
            </div>
          </FadeInSection>
        ))}
      </div>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────

function HowItWorksSection() {
  const steps = [
    {
      icon: ClipboardCheck,
      step: "01",
      title: "Register Your Farm",
      description:
        "Farmers complete KYC, register farm details with GPS coordinates, and upload verification documents.",
    },
    {
      icon: Coins,
      step: "02",
      title: "Tokenize Your Crop",
      description:
        "Create a crop listing, set your funding goal, and mint ERC-20 tokens representing future harvest yield on BNB Chain.",
    },
    {
      icon: Users,
      step: "03",
      title: "Investors Fund It",
      description:
        "Investors browse verified listings and buy crop tokens using USDT, BNB, or fiat via Stripe in minutes.",
    },
    {
      icon: Leaf,
      step: "04",
      title: "Harvest Payout",
      description:
        "After harvest verification with photo proof, smart contract auto-distributes returns to all token holders.",
    },
  ];

  return (
    <section id="how-it-works" className="bg-cream py-24">
      <div className="max-w-7xl mx-auto px-6">
        <FadeInSection className="text-center mb-16">
          <span className="text-accent-green text-sm font-body font-semibold uppercase tracking-widest">
            How It Works
          </span>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl text-forest-dark">
            From Seed to Settlement
          </h2>
          <p className="mt-4 text-text-muted font-body text-lg max-w-xl mx-auto">
            Four steps from farm registration to investor payout, all
            transparent and on-chain.
          </p>
        </FadeInSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Connector line */}
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-forest-dark/15 to-transparent" />

          {steps.map(({ icon: Icon, step, title, description }, i) => (
            <FadeInSection key={step} delay={i * 0.1}>
              <div className="bg-white rounded-card shadow-card p-7 flex flex-col gap-5 h-full relative">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-card bg-accent-green/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-forest-mid" />
                  </div>
                  <span className="font-mono text-3xl font-bold text-forest-dark/8 select-none">
                    {step}
                  </span>
                </div>
                <div>
                  <h3 className="font-body font-semibold text-forest-dark text-lg mb-2">
                    {title}
                  </h3>
                  <p className="text-text-muted font-body text-sm leading-relaxed">
                    {description}
                  </p>
                </div>
                {i < steps.length - 1 && (
                  <ChevronRight className="hidden lg:block absolute -right-3.5 top-12 w-7 h-7 text-forest-dark/20 bg-cream rounded-full p-1 z-10" />
                )}
              </div>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Featured Listings ─────────────────────────────────────────

function FeaturedListingsSection() {
  const { data: listings = [], isLoading } = useFeaturedListings();

  // Fetch one Unsplash image per listing based on crop type
  const { data: cropImages = [] } = useQuery({
    queryKey: ["crop-images-featured", listings.map((l) => l.id).join(",")],
    queryFn: () => searchPhotos("harvest crop field africa", 3),
    enabled: listings.length > 0,
    staleTime: 1000 * 60 * 60,
  });

  return (
    <section id="marketplace" className="bg-white py-24">
      <div className="max-w-7xl mx-auto px-6">
        <FadeInSection className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <span className="text-accent-green text-sm font-body font-semibold uppercase tracking-widest">
              Open Listings
            </span>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl text-forest-dark">
              Featured Crops
            </h2>
            <p className="mt-3 text-text-muted font-body">
              Live investment opportunities, verified on-chain.
            </p>
          </div>
          <Link
            to="/investor/marketplace"
            className="flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-pill border border-forest-dark text-forest-dark text-sm font-body font-semibold hover:bg-forest-dark hover:text-white transition-all duration-200 group"
          >
            View All Listings
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
          </Link>
        </FadeInSection>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-card bg-forest-dark/5 h-[420px] animate-pulse"
              />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <Leaf className="w-12 h-12 text-forest-dark/20 mx-auto mb-4" />
            <p className="font-body text-text-muted text-lg">
              No open listings yet. Be the first to tokenize a harvest.
            </p>
            <Link
              to="/register/farmer"
              className="mt-6 inline-block px-6 py-3 rounded-pill bg-accent-green text-forest-dark font-body font-semibold text-sm hover:bg-accent-green/90 transition-colors"
            >
              Register as Farmer
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing, i) => (
              <FadeInSection key={listing.id} delay={i * 0.1}>
                <CropCard
                  listing={listing}
                  imageUrl={cropImages[i]?.urls.regular}
                />
              </FadeInSection>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Why BNB Chain ─────────────────────────────────────────────

function WhyBNBSection() {
  const cards = [
    {
      icon: Zap,
      title: "Low Fees",
      description:
        "Transaction costs under $0.05 mean farmers keep more of their capital and investors see higher net returns.",
    },
    {
      icon: Shield,
      title: "Fast Settlement",
      description:
        "BNB Chain processes blocks in ~3 seconds. Funds reach farmers and payouts reach investors in near real-time.",
    },
    {
      icon: Globe,
      title: "RWA-Ready",
      description:
        "BNB Chain's growing RWA ecosystem and native USDT liquidity make it the natural home for tokenized crop finance.",
    },
  ];

  return (
    <section
      id="for-investors"
      className="bg-forest-dark py-24 relative overflow-hidden"
    >
      {/* Decorative blur */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-accent-green/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-forest-mid/30 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6">
        <FadeInSection className="text-center mb-16">
          <span className="text-accent-green text-sm font-body font-semibold uppercase tracking-widest">
            Built on BNB Chain
          </span>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl text-white">
            Why BNB Chain?
          </h2>
          <p className="mt-4 text-white/50 font-body text-lg max-w-xl mx-auto">
            The infrastructure for real-world asset finance at scale.
          </p>
        </FadeInSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map(({ icon: Icon, title, description }, i) => (
            <FadeInSection key={title} delay={i * 0.1}>
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-card p-8 hover:bg-white/[0.07] hover:border-white/[0.14] transition-all duration-300">
                <div className="w-12 h-12 rounded-card bg-accent-green/15 flex items-center justify-center mb-6">
                  <Icon className="w-6 h-6 text-accent-green" />
                </div>
                <h3 className="font-body font-semibold text-white text-xl mb-3">
                  {title}
                </h3>
                <p className="text-white/50 font-body text-sm leading-relaxed">
                  {description}
                </p>
              </div>
            </FadeInSection>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────

function Footer() {
  const year = new Date().getFullYear();

  const columns = [
    {
      heading: "Platform",
      links: [
        { label: "Marketplace", href: "/investor/marketplace" },
        { label: "For Farmers", href: "/register/farmer" },
        { label: "For Investors", href: "/register/investor" },
        { label: "How It Works", href: "#how-it-works" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "About", href: "#" },
        { label: "Blog", href: "#" },
        { label: "Careers", href: "#" },
        { label: "Contact", href: "#" },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy Policy", href: "#" },
        { label: "Terms of Service", href: "#" },
        { label: "Risk Disclosure", href: "#" },
      ],
    },
  ];

  return (
    <footer className="bg-forest-dark border-t border-white/[0.06] pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 pb-12 border-b border-white/[0.06]">
          {/* Brand */}
          <div className="md:col-span-1 space-y-5">
            <Link
              to="/"
              className="font-display text-2xl text-accent-green block"
            >
              AgriToken
            </Link>
            <p className="text-white/40 text-sm font-body leading-relaxed">
              Tokenized crop financing for smallholder farmers. Real yield, real
              crops, on-chain.
            </p>
            {/* BNB Chain badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill bg-white/[0.05] border border-white/[0.08]">
              <div className="w-4 h-4 rounded-full bg-[#F0B90B] flex items-center justify-center">
                <span className="text-[7px] font-bold text-black">B</span>
              </div>
              <span className="text-white/50 text-xs font-body">
                Built on BNB Chain
              </span>
            </div>
          </div>

          {/* Link columns */}
          {columns.map(({ heading, links }) => (
            <div key={heading} className="space-y-4">
              <h4 className="text-white text-sm font-body font-semibold">
                {heading}
              </h4>
              <ul className="space-y-3">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      to={href}
                      className="text-white/40 text-sm font-body hover:text-white/70 transition-colors duration-200"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-sm font-body">
            {year} AgriToken. All rights reserved.
          </p>
          <p className="text-white/20 text-xs font-body">
            Not financial advice. Investing in crop tokens carries risk.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={heroRef} className="min-h-screen font-body">
      <Navbar />
      <HeroSection />
      <StatsBar />
      <HowItWorksSection />
      <FeaturedListingsSection />
      <WhyBNBSection />
      <Footer />
    </div>
  );
}
