import { Suspense } from 'react';
import BookingNewView from './ViewContent';

export const dynamic = 'force-dynamic';

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="h-64 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingNewPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <BookingNewView />
    </Suspense>
  );
}