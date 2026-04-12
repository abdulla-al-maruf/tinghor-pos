
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/theme/app_theme.dart';
import 'presentation/widgets/responsive_scaffold.dart';
import 'presentation/screens/dashboard_screen.dart';
import 'presentation/screens/pos_screen.dart';

void main() {
  runApp(const ProviderScope(child: TinghorApp()));
}

// Router Configuration
final _router = GoRouter(
  initialLocation: '/',
  routes: [
    ShellRoute(
      builder: (context, state, child) {
        return ResponsiveScaffold(child: child);
      },
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const DashboardScreen(),
        ),
        GoRoute(
          path: '/pos',
          builder: (context, state) => const POSScreen(),
        ),
        GoRoute(
          path: '/inventory',
          builder: (context, state) => const Center(child: Text("Inventory Screen Placeholder")),
        ),
        GoRoute(
          path: '/purchase',
          builder: (context, state) => const Center(child: Text("Purchase Screen Placeholder")),
        ),
        // Add other routes here...
      ],
    ),
  ],
);

class TinghorApp extends StatelessWidget {
  const TinghorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Tinghor.com',
      theme: AppTheme.lightTheme,
      routerConfig: _router,
      debugShowCheckedModeBanner: false,
    );
  }
}
