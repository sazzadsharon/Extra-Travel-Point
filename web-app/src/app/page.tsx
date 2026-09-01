import Navbar from '../components/layout/navbar';
import Footer from '../components/layout/footer';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <section className="relative bg-gradient-to-r from-blue-600 to-indigo-700 text-white overflow-hidden">
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Plan. Book. Travel.
              </h1>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                Your complete travel journey in one place.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="/plan-trip"
                  className="bg-white text-blue-700 px-8 py-3 rounded-full font-bold text-lg shadow-lg hover:bg-gray-50 transition"
                >
                  Plan My Trip
                </a>
                <a
                  href="/destinations"
                  className="border-2 border-white text-white px-8 py-3 rounded-full font-bold text-lg hover:bg-white/10 transition"
                >
                  Explore Destinations
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
