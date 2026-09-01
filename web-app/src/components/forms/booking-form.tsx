'use client';

import { useState, useCallback } from 'react';
import { User, Mail, Phone, Calendar, CreditCard } from 'lucide-react';

export interface PassengerFormData {
  passengers: Array<{
    name: string;
    email: string;
    phone: string;
    age?: number;
    gender?: 'male' | 'female' | 'other';
    seatNumber?: string;
  }>;
  contactPhone: string;
  contactEmail: string;
  specialRequests?: string;
}

interface BookingFormProps {
  initialData?: Partial<PassengerFormData>;
  selectedSeats?: Array<{ seatNumber: string; price: number }>;
  totalPrice: number;
  onSubmit: (data: PassengerFormData) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export default function BookingForm({
  initialData = {},
  selectedSeats = [],
  totalPrice,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Continue to Payment'
}: BookingFormProps) {
  const [formData, setFormData] = useState<PassengerFormData>({
    passengers: initialData.passengers?.length
      ? initialData.passengers
      : selectedSeats.map((_, i) => ({
          name: '',
          email: '',
          phone: '',
          seatNumber: selectedSeats[i]?.seatNumber,
        })),
    contactPhone: initialData.contactPhone || '',
    contactEmail: initialData.contactEmail || '',
    specialRequests: initialData.specialRequests || '',
  });

  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const validate = useCallback(() => {
    const newErrors: Partial<Record<string, string>> = {};
    let hasErrors = false;

    formData.passengers.forEach((p, i) => {
      const prefix = `passengers.${i}.`;
      const passengerErrors: string[] = [];
      if (!p.name.trim()) passengerErrors.push('Name is required');
      if (!p.email.trim()) passengerErrors.push('Email is required');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) passengerErrors.push('Invalid email');
      if (!p.phone.trim()) passengerErrors.push('Phone is required');
      else if (!/^01[3-9]\d{8}$/.test(p.phone)) passengerErrors.push('Invalid BD phone (01X-XXXXXXXX)');

      if (passengerErrors.length > 0) {
        newErrors[`${prefix}error`] = passengerErrors.join(', ');
        hasErrors = true;
      }
    });

    if (!formData.contactPhone.trim()) {
      newErrors['contactPhoneError'] = 'Contact phone is required';
      hasErrors = true;
    } else if (!/^01[3-9]\d{8}$/.test(formData.contactPhone)) {
      newErrors['contactPhoneError'] = 'Invalid BD phone format';
      hasErrors = true;
    }

    if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      newErrors['contactEmailError'] = 'Invalid email format';
      hasErrors = true;
    }

    setErrors(newErrors);
    return !hasErrors;
  }, [formData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  const updatePassenger = useCallback((index: number, field: string, value: string | number | undefined) => {
    setFormData(prev => {
      const newPassengers = [...prev.passengers];
      newPassengers[index] = { ...newPassengers[index], [field]: value };
      return { ...prev, passengers: newPassengers };
    });
    // Clear error for this field
    const errorKey = `passengers.${index}.${field}Error`;
    if (errors[errorKey]) {
      setErrors(prev => ({
        ...prev,
        [errorKey]: undefined,
      }));
    }
  }, [errors]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Passenger Details */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-gray-500" />
          Passenger Details
        </h3>

        {formData.passengers.map((passenger, index) => (
          <div
            key={index}
            className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-700">
                Passenger {index + 1}
                {passenger.seatNumber && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    Seat {passenger.seatNumber}
                  </span>
                )}
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={passenger.name}
                    onChange={(e) => updatePassenger(index, 'name', e.target.value)}
                    placeholder="Full name"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={passenger.email}
                    onChange={(e) => updatePassenger(index, 'email', e.target.value)}
                    placeholder="Email address"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={passenger.phone}
                    onChange={(e) => updatePassenger(index, 'phone', e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Age
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    value={passenger.age || ''}
                    onChange={(e) => updatePassenger(index, 'age', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Age"
                    min="1"
                    max="120"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Contact Information */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Phone className="w-5 h-5 text-gray-500" />
          Contact Information (for booking confirmation)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                placeholder="01XXXXXXXXX"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                placeholder="Email for receipt"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Special Requests */}
      <div className="border-t border-gray-200 pt-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Special Requests (Optional)
        </label>
        <textarea
          value={formData.specialRequests || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, specialRequests: e.target.value }))}
          rows={3}
          placeholder="Any special requirements (wheelchair, meal preference, etc.)"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Submit Button */}
      <div className="border-t border-gray-200 pt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-4 px-6 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 transition-colors"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {submitLabel}
              <CreditCard className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
