import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class QrScannerView extends StatefulWidget {
  const QrScannerView({super.key});

  @override
  State<QrScannerView> createState() => _QrScannerViewState();
}

class _QrScannerViewState extends State<QrScannerView> {
  bool isScanning = true;
  String scanResult = '';

  void _onDetect(BarcodeCapture capture) async {
    if (!isScanning) return;
    final List<Barcode> barcodes = capture.barcodes;
    for (final barcode in barcodes) {
      if (barcode.rawValue != null) {
        setState(() {
          isScanning = false;
          scanResult = 'Verifying Code: ${barcode.rawValue}';
        });

        try {
          final response = await http.post(
            Uri.parse('http://localhost:5000/api/v1/qr/verify'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'qrToken': barcode.rawValue}),
          );

          if (response.statusCode == 200) {
            final data = jsonDecode(response.body);
            _showResultDialog('সফল', 'QR কোড সঠিকভাবে ভেরিফাই হয়েছে!\nডিসকাউন্ট: ${data['discountValue']}');
          } else {
            _showResultDialog('ত্রুটি', 'অবৈধ বা মেয়ার্দোত্তীর্ণ QR কোড');
          }
        } catch (e) {
          _showResultDialog('কানেকশন ত্রুটি', 'ব্যাকএন্ড সার্ভারে সংযুক্ত হতে পারেনি');
        }
        break;
      }
    }
  }

  void _showResultDialog(String title, String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              setState(() {
                isScanning = true;
              });
            },
            child: const Text('ঠিক আছে'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('ভেন্ডর QR স্ক্যানার'),
        backgroundColor: const Color(0xFF0284C7),
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          Expanded(
            flex: 5,
            child: MobileScanner(
              onDetect: _onDetect,
            ),
          ),
          Expanded(
            flex: 1,
            child: Center(
              child: Text(
                scanResult.isEmpty ? 'QR কোডটি ফ্রেমের মাঝে রাখুন' : scanResult,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
