
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

class ResponsiveScaffold extends StatefulWidget {
  final Widget child;
  const ResponsiveScaffold({super.key, required this.child});

  @override
  State<ResponsiveScaffold> createState() => _ResponsiveScaffoldState();
}

class _ResponsiveScaffoldState extends State<ResponsiveScaffold> {
  int _selectedIndex = 0;
  bool _isSidebarCollapsed = false;

  final List<Map<String, dynamic>> _menuItems = [
    {'icon': LucideIcons.layoutDashboard, 'label': 'ড্যাশবোর্ড', 'route': '/'},
    {'icon': LucideIcons.shoppingBag, 'label': 'বিক্রয় (POS)', 'route': '/pos'},
    {'icon': LucideIcons.shoppingCart, 'label': 'ক্রয় (Purchase)', 'route': '/purchase'},
    {'icon': LucideIcons.package, 'label': 'স্টক খাতা', 'route': '/inventory'},
    {'icon': LucideIcons.bookOpen, 'label': 'বাকি খাতা', 'route': '/ledger'},
    {'icon': LucideIcons.fileText, 'label': 'ইনভয়েস', 'route': '/history'},
    {'icon': LucideIcons.users, 'label': 'কাস্টমার', 'route': '/customers'},
    {'icon': LucideIcons.settings, 'label': 'সেটিংস', 'route': '/settings'},
  ];

  void _onDestinationSelected(int index) {
    setState(() {
      _selectedIndex = index;
    });
    context.go(_menuItems[index]['route']);
  }

  @override
  Widget build(BuildContext context) {
    final isDesktop = MediaQuery.of(context).size.width >= 1024;

    return Scaffold(
      appBar: !isDesktop
          ? AppBar(
              title: const Text("Tinghor.com"),
              backgroundColor: Colors.white,
              surfaceTintColor: Colors.transparent,
            )
          : null,
      drawer: !isDesktop
          ? NavigationDrawer(
              selectedIndex: _selectedIndex,
              onDestinationSelected: (index) {
                Navigator.pop(context);
                _onDestinationSelected(index);
              },
              children: [
                const Padding(
                  padding: EdgeInsets.all(24.0),
                  child: Text("Tinghor.com", style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.blue)),
                ),
                ..._menuItems.map((item) => NavigationDrawerDestination(
                      icon: Icon(item['icon']),
                      label: Text(item['label']),
                    )),
              ],
            )
          : null,
      body: Row(
        children: [
          if (isDesktop)
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: _isSidebarCollapsed ? 80 : 260,
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border(right: BorderSide(color: Colors.grey.shade200)),
              ),
              child: Column(
                children: [
                  Container(
                    height: 64,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    alignment: Alignment.centerLeft,
                    child: Row(
                      children: [
                        if (!_isSidebarCollapsed)
                          const Text("Tinghor", style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
                        if (_isSidebarCollapsed)
                          const Text("TG", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  Expanded(
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
                      itemCount: _menuItems.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 4),
                      itemBuilder: (context, index) {
                        final item = _menuItems[index];
                        final isSelected = _selectedIndex == index;
                        return InkWell(
                          onTap: () => _onDestinationSelected(index),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                            decoration: BoxDecoration(
                              color: isSelected ? const Color(0xFF2563EB) : Colors.transparent,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisAlignment: _isSidebarCollapsed ? MainAxisAlignment.center : MainAxisAlignment.start,
                              children: [
                                Icon(item['icon'], color: isSelected ? Colors.white : Colors.grey.shade600, size: 22),
                                if (!_isSidebarCollapsed) ...[
                                  const SizedBox(width: 12),
                                  Text(
                                    item['label'],
                                    style: TextStyle(
                                      color: isSelected ? Colors.white : Colors.grey.shade600,
                                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                                    ),
                                  ),
                                ]
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  IconButton(
                    onPressed: () => setState(() => _isSidebarCollapsed = !_isSidebarCollapsed),
                    icon: Icon(_isSidebarCollapsed ? LucideIcons.chevronRight : LucideIcons.chevronLeft),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          Expanded(child: widget.child),
        ],
      ),
    );
  }
}
