'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import {
  MessageCircle,
  Send,
  Loader2,
  Bot,
  User,
  Bus,
  Hotel,
  Utensils,
  Plane,
  Car,
  Sparkles,
  MapPin,
  AlertCircle,
  ArrowRight,
  Wallet,
  Bike,
  Ship,
  GraduationCap,
  ShieldAlert,
  CheckCircle2,
  Compass,
} from 'lucide-react';
import api from '../../lib/apiClient';
import Navbar from '../../components/layout/navbar';
import Footer from '../../components/layout/footer';
import { useTranslation } from '../../i18n/hooks/useTranslation';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SubService {
  icon: string;
  label: string;
  labelBn: string;
  description: string;
  link: string;
}

interface LiveDataItem {
  name: string;
  price?: number;
  currency?: string;
  detail?: string;
  availabilityNote?: string;
}

interface ServiceRecommendation {
  intent: string;
  category: string;
  icon: string;
  label: string;
  labelBn: string;
  description: string;
  link: string;
  subServices: SubService[];
  liveData?: LiveDataItem[];
  availabilityNote?: string;
}

interface ExtractedInfo {
  destination?: string;
  budget?: number;
  needs: string[];
}

interface ChatResponse {
  reply: string;
  services: ServiceRecommendation[];
  extractedInfo: ExtractedInfo;
}

const iconMap: Record<string, any> = {
  bus: Bus,
  hotel: Hotel,
  utensils: Utensils,
  plane: Plane,
  car: Car,
  sparkles: Sparkles,
  bike: Bike,
  ship: Ship,
  'graduation-cap': GraduationCap,
  'map-pin': MapPin,
  compass: Compass,
  cng: Bike,
};

const suggestionChips = [
  'আমার বাজেট ৫০০০ টাকা, ২ জন, ৩ দিন — ৫ তারিখে কক্সবাজার যাব',
  'খাবারের option দেখাও',
  'Flight দিয়ে গেলে কত লাগবে?',
  'গাড়ি ভাড়া চাই',
  'ঘোরার জায়গা দেখাও',
  'কক্সবাজারে লোকাল গাইড চাই',
  'সিএনজি লাগবে',
  'প্রাইভেট গাড়ি লাগবে',
];

export default function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'আসসালামু আলাইকুম! 👋 আমি ETP AI — আপনার ভ্রমণ সঙ্গী। কোথায় যেতে চান, কত বাজেট আছে এবং কী কী দরকার — বলুন! আপনার প্রয়োজনের ভিত্তিতে শুধু প্রাসঙ্গিক সেবা দেখিয়ে দেবো।',
    },
  ]);
  const [services, setServices] = useState<ServiceRecommendation[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destination, setDestination] = useState<string | undefined>();
  const [budget, setBudget] = useState<number | undefined>();

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages((current) => current.length === 1 && current[0].role === 'assistant'
      ? [{ role: 'assistant', content: greeting }]
      : current);
  }, [greeting]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, services, isLoading]);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;

    setInput('');
    setError(null);

    const updatedMessages: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(updatedMessages);
    setServices([]);
    setIsLoading(true);

    try {
      const response = await api.post<ChatResponse>('/ai/chat', {
        messages: updatedMessages,
        destination,
        maxBudget: budget,
        locale,
      });

      const data = response.data;
      setMessages([...updatedMessages, { role: 'assistant', content: data.reply }]);
      setServices(data.services || []);

      if (data.extractedInfo?.destination) {
        setDestination(data.extractedInfo.destination);
      }
      if (data.extractedInfo?.budget && typeof data.extractedInfo.budget === 'number') {
        setBudget(data.extractedInfo.budget);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || (locale === 'bn' ? 'একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।' : 'Something went wrong. Please try again.'));
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content: locale === 'bn' ? 'দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। একটু পরে আবার চেষ্টা করুন। 🙏' : 'Sorry, I can’t reply right now. Please try again in a moment. 🙏',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const formatCurrency = (amount?: number, currency: string = 'BDT') => {
    if (typeof amount !== 'number') return '';
    return new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(amount);
  };

  const localizedServiceDescription: Record<string, string> = {
    bus: 'বাসের টিকিট ও যাতায়াতের বিকল্প দেখুন',
    hotel: 'থাকার জন্য হোটেল ও রিসোর্ট খুঁজুন',
    restaurant: 'খাবারের জায়গা ও রেস্তোরাঁ দেখুন',
    flight: 'ফ্লাইটের বিকল্প খুঁজুন',
    car: 'গাড়ি ভাড়ার ব্যবস্থা দেখুন',
    activity: 'ঘোরার জায়গা ও কী কী করা যায় দেখুন',
    boat: 'নৌকা ও লঞ্চে যাওয়ার বিকল্প দেখুন',
    local_transport: 'গন্তব্যে স্থানীয় যাতায়াতের ব্যবস্থা দেখুন',
    student_deal: 'শিক্ষার্থীদের জন্য ছাড় ও অফার দেখুন',
    local_guide: 'এলাকার গাইড খুঁজুন',
    cng: 'সিএনজি ভাড়ার ব্যবস্থা দেখুন',
    private_car: 'ব্যক্তিগত গাড়ি ভাড়ার ব্যবস্থা দেখুন',
  };

  const suggestionChips = locale === 'bn' ? [
    'আমার বাজেট ৫০০০ টাকা, ২ জন, ৩ দিন — ৫ তারিখে কক্সবাজার যাব',
    'খাবারের জায়গা দেখাও', 'ফ্লাইটে গেলে কত খরচ হবে?', 'গাড়ি ভাড়া চাই',
    'ঘোরার জায়গা দেখাও', 'কক্সবাজারে স্থানীয় গাইড চাই', 'সিএনজি লাগবে', 'প্রাইভেট গাড়ি লাগবে',
  ] : [
    'My budget is BDT 5,000 for 2 people and 3 days in Cox’s Bazar',
    'Show me places to eat', 'How much would a flight cost?', 'I need a rental car',
    'Show me places to visit', 'I need a local guide in Cox’s Bazar', 'I need a CNG', 'I need a private car',
  ];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-r from-etp-600 to-indigo-600 rounded-2xl mb-4">
              <MessageCircle className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{locale === 'bn' ? 'ETP AI সহকারী' : 'ETP AI Chat'}</h1>
            <p className="text-gray-600">
              {locale === 'bn' ? 'আপনার প্রয়োজন বুঝে শুধু দরকারি সেবাগুলো দেখানো হবে—যেমন বাস, হোটেল বা রেস্তোরাঁ।' : 'Get helpful travel options based on what you ask for, such as buses, hotels, and restaurants.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-[70vh] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 bg-gradient-to-r from-etp-50 to-indigo-50">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-etp-600 to-indigo-700 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">ETP AI</div>
                <div className="text-xs text-green-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  {locale === 'bn' ? 'অনলাইনে' : 'Online'}
                </div>
              </div>
              {(destination || budget) && (
                <div className="ml-auto hidden sm:flex items-center gap-2 bg-white bg-opacity-70 rounded-lg px-2 py-1 text-xs text-gray-600">
                  {destination && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-etp-600" />
                      {destination}
                    </span>
                  )}
                  {typeof budget === 'number' && (
                    <span className="flex items-center gap-1">
                      <Wallet className="w-3 h-3 text-etp-600" />
                      {formatCurrency(budget)}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-etp-600 to-indigo-700 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-etp-600 to-indigo-600 text-white rounded-br-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex items-end gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-etp-600 to-indigo-700 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce [animation-delay:0.15s]" />
                    <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              )}

              {services.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-etp-600" />
                    {locale === 'bn' ? 'আপনার প্রয়োজন অনুযায়ী সেবা' : 'Services based on your needs'}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {services.map((service, serviceIdx) => {
                      const IconComp = iconMap[service.icon] || Bus;
                      return (
                        <div
                          key={`${service.intent || service.category}-${serviceIdx}`}
                          className="bg-white border border-gray-200 rounded-xl p-4 hover:border-etp-300 hover:shadow-md transition-all flex flex-col"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-etp-50 flex items-center justify-center flex-shrink-0">
                              <IconComp className="w-5 h-5 text-etp-600" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 text-sm">{locale === 'bn' ? service.labelBn : service.label}</div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 mb-3">{locale === 'bn' ? (localizedServiceDescription[service.intent] || 'আপনার প্রয়োজন অনুযায়ী সেবার তথ্য দেখুন') : service.description}</p>

                          {service.liveData && service.liveData.length > 0 && (
                            <div className="mb-3 space-y-2">
                              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                {locale === 'bn' ? 'এখন পাওয়া যাচ্ছে' : 'Live options'}
                              </div>
                              {service.liveData.map((item, itemIdx) => (
                                <div
                                  key={`${service.intent}-live-${itemIdx}`}
                                  className="bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="text-xs font-medium text-gray-800">{item.name}</div>
                                    {typeof item.price === 'number' && (
                                      <div className="text-xs font-bold text-etp-700 shrink-0">
                                        {formatCurrency(item.price, item.currency)}
                                      </div>
                                    )}
                                  </div>
                                  {item.detail && (
                                    <div className="text-[11px] text-gray-500 mt-0.5">{item.detail}</div>
                                  )}
                                  {item.availabilityNote && (
                                    <div className="text-[11px] text-amber-600 mt-0.5 flex items-center gap-1">
                                      <ShieldAlert className="w-3 h-3 shrink-0" />
                                      {item.availabilityNote}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {service.availabilityNote && (!service.liveData || service.liveData.length === 0) && (
                            <div className="mb-3 flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                              <span className="text-[11px] text-amber-700">{service.availabilityNote}</span>
                            </div>
                          )}

                          {service.subServices && service.subServices.length > 0 && (
                            <div className="mb-3">
                              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                {locale === 'bn' ? 'আরও দেখুন' : 'Explore more'}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {service.subServices.map((sub, subIdx) => {
                                  const SubIcon = iconMap[sub.icon] || Sparkles;
                                  return (
                                    <a
                                      key={`${service.intent}-sub-${subIdx}`}
                                      href={sub.link}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-etp-50 border border-etp-100 hover:border-etp-300 transition-colors"
                                    >
                                      <SubIcon className="w-3.5 h-3.5 text-etp-600" />
                                      <span className="text-xs text-gray-700 font-medium">
                                        {locale === 'bn' ? sub.labelBn : sub.label}
                                      </span>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <a
                            href={service.link}
                            className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-etp-700 hover:text-etp-800"
                          >
                            {locale === 'bn' ? 'সব দেখুন' : 'View all'}
                            <ArrowRight className="w-3 h-3" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            {messages.length <= 1 && (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {suggestionChips.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleSend(chip)}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-xs rounded-full border border-gray-300 bg-white text-gray-600 hover:border-etp-400 hover:text-etp-700 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={locale === 'bn' ? 'কোথায় যেতে চান, বাজেট কত, কী দরকার—লিখুন...' : 'Where would you like to go? What is your budget and what do you need?'}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:ring-2 focus:ring-etp-400 focus:border-etp-400 outline-none text-sm transition-all"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-etp-600 to-indigo-600 hover:from-etp-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 text-white flex items-center justify-center transition-all flex-shrink-0"
                  aria-label={locale === 'bn' ? 'পাঠান' : 'Send'}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-4 text-center text-xs text-gray-400">
            ETP AI আপনাকে সেবা সুপারিশ করতে সাহায্য করে — আপনার ভ্রমণ, আপনার সিদ্ধান্ত।
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}