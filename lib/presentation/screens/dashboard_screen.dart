
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/app_state.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sales = ref.watch(salesProvider);
    final inventory = ref.watch(inventoryProvider);

    final totalRevenue = sales.fold(0.0, (sum, s) => sum + s.finalAmount);
    final totalDue = sales.fold(0.0, (sum, s) => sum + s.dueAmount);
    final totalStock = inventory.fold(0, (sum, g) => sum + g.variants.fold(0, (s, v) => s + v.stockPieces));

    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        // Header
        const Text("ড্যাশবোর্ড ওভারভিউ", style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
        const SizedBox(height: 24),

        // Summary Cards Grid
        LayoutBuilder(builder: (context, constraints) {
          final width = constraints.maxWidth;
          int crossAxisCount = width > 1100 ? 3 : (width > 700 ? 2 : 1);
          
          return GridView.count(
            crossAxisCount: crossAxisCount,
            crossAxisSpacing: 24,
            mainAxisSpacing: 24,
            childAspectRatio: 2.2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              _SummaryCard(
                title: "মোট বিক্রি",
                value: "৳${totalRevenue.toStringAsFixed(0)}",
                icon: LucideIcons.trendingUp,
                color: Colors.indigo,
              ),
              _SummaryCard(
                title: "ক্যাশ কালেকশন",
                value: "৳${(totalRevenue - totalDue).toStringAsFixed(0)}",
                icon: LucideIcons.wallet,
                color: Colors.emerald,
              ),
              _SummaryCard(
                title: "মার্কেটে বাকি",
                value: "৳${totalDue.toStringAsFixed(0)}",
                icon: LucideIcons.alertCircle,
                color: Colors.red,
              ),
            ],
          );
        }),

        const SizedBox(height: 32),

        // Charts & Tables Section
        Container(
          height: 400,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text("স্টক স্ট্যাটাস (ব্র্যান্ড অনুযায়ী)", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 24),
              Expanded(
                child: BarChart(
                  BarChartData(
                    borderData: FlBorderData(show: false),
                    gridData: const FlGridData(drawVerticalLine: false),
                    titlesData: FlTitlesData(
                      leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 40)),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          getTitlesWidget: (value, meta) {
                            // Mock mapping for demo
                            final brands = ['AKS', 'PHP', 'TK', 'KDS'];
                            if (value.toInt() < brands.length) {
                              return Padding(padding: const EdgeInsets.only(top: 8), child: Text(brands[value.toInt()]));
                            }
                            return const SizedBox();
                          },
                        ),
                      ),
                      rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    ),
                    barGroups: [
                      BarChartGroupData(x: 0, barRods: [BarChartRodData(toY: 50, color: Colors.blue, width: 20, borderRadius: BorderRadius.circular(4))]),
                      BarChartGroupData(x: 1, barRods: [BarChartRodData(toY: 100, color: Colors.blue, width: 20, borderRadius: BorderRadius.circular(4))]),
                      BarChartGroupData(x: 2, barRods: [BarChartRodData(toY: 30, color: Colors.blue, width: 20, borderRadius: BorderRadius.circular(4))]),
                      BarChartGroupData(x: 3, barRods: [BarChartRodData(toY: 80, color: Colors.blue, width: 20, borderRadius: BorderRadius.circular(4))]),
                    ],
                  ),
                ),
              ),
            ],
          ),
        )
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _SummaryCard({required this.title, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: color.withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.bold)),
              Icon(icon, color: Colors.white70),
            ],
          ),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
