import Navbar from '../components/layout/navbar';
import Footer from '../components/layout/footer';
import HeroSection from '../components/home/HeroSection';
import BookingSearchCard from '../components/home/BookingSearchCard';
import ServicesGrid from '../components/home/ServicesGrid';
import AiPlannerSection from '../components/home/AiPlannerSection';
import TravelPassSection from '../components/home/TravelPassSection';
import RewardsSection from '../components/home/RewardsSection';
import EditorialDestinations from '../components/home/EditorialDestinations';
import TrustStrip from '../components/home/TrustStrip';
import FinalCta from '../components/home/FinalCta';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen overflow-x-clip">
        <HeroSection />
        <BookingSearchCard />
        <ServicesGrid />
        <AiPlannerSection />
        <TravelPassSection />
        <RewardsSection />
        <EditorialDestinations />
        <TrustStrip />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}