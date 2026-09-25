'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, MapPin, Star, BriefcaseBusiness } from 'lucide-react';
import api from '../../../lib/apiClient';

interface ProviderService {
  id: number;
  name: string;
  category: string;
  serviceType: string;
  description?: string | null;
  price: number;
  currency: string;
  locationCity?: string | null;
  images?: string[] | null;
}

interface Provider {
  id: number;
  businessName: string;
  category: string;
  description?: string | null;
  address: string;
  city?: string | null;
  logo?: string | null;
  rating: number;
  totalReviews: number;
  isVerified: boolean;
  services: ProviderService[];
}

export default function ProviderProfilePage() {
  const params = useParams<{ id: string }>();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      setError('Invalid provider');
      setLoading(false);
      return;
    }

    api.get<{ success: boolean; provider: Provider }>(`/discovery/providers/${id}`)
      .then((response) => setProvider(response.data.provider))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load provider profile'))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-etp-600" /></div>;
  }

  if (error || !provider) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Provider unavailable</h1>
          <p className="text-sm text-slate-500 mb-6">{error || 'This provider could not be found.'}</p>
          <Link href="/marketplace" className="text-sm font-medium text-etp-600">Back to Marketplace</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-etp-600 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </Link>

        <section className="bg-white rounded-3xl border border-slate-200 shadow-soft overflow-hidden mb-8">
          <div className="h-36 bg-gradient-to-r from-etp-600 via-violet-600 to-slate-900" />
          <div className="px-5 sm:px-8 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5 -mt-12">
              <div className="w-24 h-24 rounded-2xl bg-white border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
                {provider.logo ? <img src={provider.logo} alt={provider.businessName} className="w-full h-full object-cover" /> : <BriefcaseBusiness className="w-10 h-10 text-etp-500" />}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{provider.businessName}</h1>
                  {provider.isVerified && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle2 className="w-3.5 h-3.5" /> Verified</span>}
                </div>
                <p className="text-sm text-slate-500 mt-1">{provider.category}</p>
              </div>
              <div className="flex items-center gap-1 text-sm text-amber-600 font-semibold">
                <Star className="w-4 h-4 fill-current" /> {provider.rating > 0 ? provider.rating.toFixed(1) : 'New'}
                <span className="font-normal text-slate-400">({provider.totalReviews} reviews)</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="font-semibold text-slate-900 mb-2">About this provider</h2>
                <p className="text-sm leading-6 text-slate-600">{provider.description || 'No description provided yet.'}</p>
              </div>
              <div className="text-sm text-slate-600">
                <div className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 text-slate-400" /><span>{provider.address}{provider.city ? `, ${provider.city}` : ''}</span></div>
                <div className="mt-3 text-slate-500">{provider.services.length} published service{provider.services.length === 1 ? '' : 's'}</div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between mb-4">
            <div><h2 className="text-xl font-bold text-slate-900">Published services</h2><p className="text-sm text-slate-500">Services currently offered by this provider.</p></div>
          </div>
          {provider.services.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">No published services are available.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {provider.services.map((service) => (
                <article key={service.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-soft">
                  <div className="aspect-[16/9] bg-slate-100">
                    {service.images?.[0] ? <img src={service.images[0]} alt={service.name} className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center text-slate-300"><BriefcaseBusiness className="w-10 h-10" /></div>}
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-medium text-etp-600 mb-1">{service.category} · {service.serviceType}</p>
                    <h3 className="font-semibold text-slate-900">{service.name}</h3>
                    {service.description && <p className="text-sm text-slate-500 mt-2 line-clamp-2">{service.description}</p>}
                    {service.locationCity && <p className="text-xs text-slate-500 mt-3 flex items-center gap-1"><MapPin className="w-3 h-3" />{service.locationCity}</p>}
                    <div className="mt-4 text-lg font-bold text-etp-700">{service.currency} {Number(service.price).toLocaleString()}</div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
