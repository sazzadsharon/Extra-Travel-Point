'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Seat {
  seatNumber: string;
  isAvailable: boolean;
  price: number;
  type: 'Window' | 'Aisle';
  isLocked?: boolean;
}

interface SeatMapProps {
  seats: Seat[];
  maxSeats: number;
  onSelectionChange: (selectedSeats: Seat[], totalPrice: number) => void;
  selectedSeats: Seat[];
  isLoading?: boolean;
}

export default function SeatMap({ seats, maxSeats, onSelectionChange, selectedSeats, isLoading = false }: SeatMapProps) {
  const [localSelected, setLocalSelected] = useState<Seat[]>(selectedSeats);

  useEffect(() => {
    setLocalSelected(selectedSeats);
  }, [selectedSeats]);

  const handleSeatClick = useCallback((seat: Seat) => {
    if (!seat.isAvailable || seat.isLocked || isLoading) return;

    setLocalSelected(prev => {
      const isSelected = prev.find(s => s.seatNumber === seat.seatNumber);
      if (isSelected) {
        return prev.filter(s => s.seatNumber !== seat.seatNumber);
      } else {
        if (prev.length >= maxSeats) {
          alert(`You can only select up to ${maxSeats} seats`);
          return prev;
        }
        return [...prev, seat];
      }
    });
  }, [maxSeats, isLoading]);

  useEffect(() => {
    const totalPrice = localSelected.reduce((sum, s) => sum + s.price, 0);
    onSelectionChange(localSelected, totalPrice);
  }, [localSelected, onSelectionChange]);

  // Group seats by row
  const seatsByRow: Record<string, Seat[]> = {};
  seats.forEach(seat => {
    const row = seat.seatNumber.charAt(0);
    if (!seatsByRow[row]) seatsByRow[row] = [];
    seatsByRow[row].push(seat);
  });

  const rows = Object.keys(seatsByRow).sort();

  return (
    <div className="w-full">
      {/* Driver section indicator */}
      <div className="flex justify-end mb-6">
        <div className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 5.636a9 9 0 1012.728 0M12 3v9m0 0l-2-2m2 2l2-2" />
          </svg>
          Driver
        </div>
      </div>

      {/* Seat grid */}
      <div className="space-y-3">
        {rows.map(row => {
          const rowSeats = seatsByRow[row].sort((a, b) => {
            const colA = parseInt(a.seatNumber.slice(1));
            const colB = parseInt(b.seatNumber.slice(1));
            return colA - colB;
          });

          return (
            <div key={row} className="flex items-center gap-3">
              <div className="w-8 text-center font-medium text-gray-500">{row}</div>
              <div className="flex-1 grid grid-cols-5 gap-2">
                {rowSeats.map((seat, idx) => {
                  const isSelected = localSelected.find(s => s.seatNumber === seat.seatNumber);
                  // Add aisle gap after seat 2
                  const showAisle = idx === 1;

                  return (
                    <>
                      {showAisle && <div key={`aisle-${row}`} className="w-6" />}
                      <button
                        key={seat.seatNumber}
                        onClick={() => handleSeatClick(seat)}
                        disabled={!seat.isAvailable || seat.isLocked || isLoading}
                        className={`
                          aspect-square rounded-lg font-medium text-sm flex flex-col items-center justify-center
                          transition-all duration-200
                          ${isSelected
                            ? 'bg-blue-600 text-white border-2 border-blue-700 shadow-md scale-105'
                            : seat.isAvailable
                            ? 'bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer'
                            : 'bg-gray-100 text-gray-400 border-2 border-gray-200 cursor-not-allowed'
                          }
                          ${seat.isLocked ? 'bg-yellow-100 border-yellow-400 text-yellow-700' : ''}
                        `}
                        title={
                          seat.isLocked
                            ? 'Locked'
                            : !seat.isAvailable
                            ? 'Unavailable'
                            : `${seat.seatNumber} - ${seat.type} - BDT ${seat.price}`
                        }
                      >
                        <span>{seat.seatNumber.slice(1)}</span>
                        {isSelected && <span className="text-[10px]">✓</span>}
                      </button>
                    </>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-white border-2 border-gray-300 rounded" />
          <span className="text-gray-700">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-blue-600 border-2 border-blue-700 rounded" />
          <span className="text-gray-700">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gray-100 border-2 border-gray-200 rounded" />
          <span className="text-gray-700">Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-yellow-100 border-2 border-yellow-400 rounded" />
          <span className="text-gray-700">Locked</span>
        </div>
      </div>
    </div>
  );
}
