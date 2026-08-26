import 'package:flutter/material.dart';
import 'qr_display_view.dart';
import 'qr_scanner_view.dart';

class HomeView extends StatelessWidget {
  const HomeView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('এক্সট্রাভেল পয়েন্ট'),
        backgroundColor: const Color(0xFF0284C7),
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const QrScannerView()),
              );
            },
            tooltip: 'QR স্ক্যানার (ভেন্ডর)',
          )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Banner Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0284C7), Color(0xFF0369A1)],
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'কম্বো ডিসকাউন্ট ও সিকিউরড QR',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'হোটেল, বাস ও ট্যুর বুকিং করে পেয়ে যান ১৫% পর্যন্ত বিশেষ ছাড়!',
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const QrDisplayView(
                            bookingCode: 'BKG-2024-0001',
                            discountDetails: 'হোটেল + রেস্তোরাঁ ১০% ডিসকাউন্ট',
                          ),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF0284C7),
                    ),
                    child: const Text('আমার QR কোড দেখুন'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'আমাদের সেবাসমূহ',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.3,
              children: [
                _buildServiceCard(context, Icons.hotel, 'হোটেল বুকিং', '১০% ছাড়'),
                _buildServiceCard(context, Icons.directions_bus, 'বাস টিকিট', 'ইনস্ট্যান্ট পয়েন্ট'),
                _buildServiceCard(context, Icons.flight, 'ফ্লাইট টিকিট', 'সেরা অফার'),
                _buildServiceCard(context, Icons.restaurant, 'রেস্তোরাঁ অফার', '১৫% কম্বো ডিসকাউন্ট'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildServiceCard(BuildContext context, IconData icon, String title, String subtitle) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 36, color: const Color(0xFF0284C7)),
            const SizedBox(height: 8),
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 4),
            Text(subtitle, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}
