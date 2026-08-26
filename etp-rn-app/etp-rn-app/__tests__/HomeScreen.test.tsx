import 'react-native';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from '../src/screens/HomeScreen';

describe('HomeScreen', () => {
  it('renders correctly', () => {
    const { getByText, getByPlaceholderText } = render(<HomeScreen />);
    expect(getByText('এক্সট্রাভেল পয়েন্ট')).toBeTruthy();
    expect(getByPlaceholderText('From')).toBeTruthy();
    expect(getByPlaceholderText('To')).toBeTruthy();
  });

  it('performs trip search and shows results', async () => {
    const { getByText, getByPlaceholderText } = render(<HomeScreen />);
    const searchBtn = getByText('Search');
    fireEvent.press(searchBtn);
    await waitFor(() => {
      expect(getByText('Sakura Paribahan')).toBeTruthy();
      expect(getByText('Departure: 07:00 AM')).toBeTruthy();
    });
  });

  it('handles booking button press', () => {
    const { getByText } = render(<HomeScreen />);
    const searchBtn = getByText('Search');
    fireEvent.press(searchBtn);
    const bookBtn = getByText('Book Now');
    expect(bookBtn).toBeTruthy();
  });
});
