import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'views/home_view.dart';

void main() {
  runApp(
    const ProviderScope(
      child: ExtraTravelApp(),
    ),
  );
}

class ExtraTravelApp extends StatelessWidget {
  const ExtraTravelApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Extra Travel Point',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0284C7)),
        useMaterial3: true,
      ),
      home: const HomeView(),
    );
  }
}
