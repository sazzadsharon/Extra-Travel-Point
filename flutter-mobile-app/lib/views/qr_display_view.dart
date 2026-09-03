import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class QrDisplayView extends ConsumerStatefulWidget {
  final String bookingCode;
  final String discountDetails;
  final String authToken;

  const QrDisplayView({
    super.key,
    required this.bookingCode,
    required this.discountDetails,
    this.authToken = '',
  });

  @override
  ConsumerState<QrDisplayView> createState() => _QrDisplayViewState();
}

class _QrDisplayViewState extends ConsumerState<QrDisplayView> {
  String? _qrDataUrl;
  String? _error;
  bool _loading = true;

  static const _baseUrl = 'http://localhost:5000/api/v1';

  @override
  void initState() {
    super.initState();
    _loadFromBackend();
  }

  Future<void> _loadFromBackend() async {
    try {
      final res = await http.get(
        Uri.parse('$_baseUrl/travel-passes/${widget.bookingCode}'),
        headers: widget.authToken.isNotEmpty
            ? {'Authorization': 'Bearer ${widget.authToken}'}
            : {},
      );
      if (res.statusCode != 200) {
        setState(() {
          _error = 'Backend returned ${res.statusCode}';
          _loading = false;
        });
        return;
      }
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      setState(() {
        _qrDataUrl = data['qrCode'] as String?;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load Travel Pass from backend';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('সিকিউরড Travel Pass'),
        backgroundColor: const Color(0xFF0284C7),
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Card(
                elevation: 4,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    children: [
                      const Text(
                        'এক্সট্রাভেল Travel Pass',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'আইডি: ${widget.bookingCode}',
                        style: const TextStyle(color: Colors.grey, fontSize: 13),
                      ),
                      const SizedBox(height: 20),
                      if (_loading)
                        const CircularProgressIndicator()
                      else if (_qrDataUrl != null)
                        // Backend returns a data URL; we display it as image.
                        Image.network(
                          _qrDataUrl!,
                          width: 200,
                          height: 200,
                          errorBuilder: (_, __, ___) => QrImageView(
                            data: 'EXTRATRAVEL:${widget.bookingCode}',
                            version: QrVersions.auto,
                            size: 200.0,
                          ),
                        )
                      else
                        QrImageView(
                          data: 'EXTRATRAVEL:${widget.bookingCode}',
                          version: QrVersions.auto,
                          size: 200.0,
                        ),
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12)),
                      ],
                      const SizedBox(height: 20),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE0F2FE),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          widget.discountDetails,
                          style: const TextStyle(
                            color: Color(0xFF0369A1),
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'ভেন্ডর আউটলেটে এই QR কোডটি স্ক্যান করান',
                style: TextStyle(color: Colors.grey, fontSize: 13),
              ),
            ],
          ),
        ),
      ),
    );
  }
}