
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:uuid/uuid.dart';
import '../../data/models/models.dart';
import '../providers/app_state.dart';

class POSScreen extends ConsumerStatefulWidget {
  const POSScreen({super.key});

  @override
  ConsumerState<POSScreen> createState() => _POSScreenState();
}

class _POSScreenState extends ConsumerState<POSScreen> {
  // Selection State
  String? _selectedType;
  String? _selectedBrand;
  String? _selectedThickness;
  String? _selectedColor;
  
  // Input State
  final _qtyController = TextEditingController();
  final _rateController = TextEditingController();
  
  // Checkout State
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _paidController = TextEditingController();
  final _discountController = TextEditingController();

  @override
  void initState() {
    super.initState();
    // Default select first type
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final types = ref.read(productTypesProvider);
      if(types.isNotEmpty) setState(() => _selectedType = types.first);
    });
  }

  void _addToCart() {
    final inventory = ref.read(inventoryProvider);
    // Find matching group
    final group = inventory.firstWhere(
      (g) => g.productType == _selectedType && g.brand == _selectedBrand && g.color == _selectedColor && g.thickness == _selectedThickness,
      orElse: () => inventory.first, // Fallback/Unsafe for brevity, real app needs better error handling
    );

    // Assume first variant for demo simple selection
    final variant = group.variants.first;
    
    final qty = int.tryParse(_qtyController.text) ?? 0;
    final rate = double.tryParse(_rateController.text) ?? 0.0;

    if (qty <= 0 || rate <= 0) return;

    double subtotal = 0;
    // Logic: Bundle Calculation
    if (group.type == CalculationMode.tinBundle) {
        // Simple logic for demo: rate is per piece for now
        subtotal = qty * rate;
    } else {
        subtotal = qty * rate;
    }

    final item = CartItem(
      groupId: group.id,
      variantId: variant.id,
      name: "${group.brand} ${group.thickness} ${group.color} ${variant.lengthFeet}'",
      lengthFeet: variant.lengthFeet,
      quantityPieces: qty,
      formattedQty: "$qty pcs",
      priceUnit: rate,
      buyPriceUnit: variant.averageCost,
      subtotal: subtotal,
      unitType: 'piece',
    );

    ref.read(cartProvider.notifier).addItem(item);
    _qtyController.clear();
    // Keep rate for faster entry
  }

  void _checkout() {
    final cart = ref.read(cartProvider);
    if(cart.isEmpty) return;

    final subTotal = cart.fold(0.0, (sum, item) => sum + item.subtotal);
    final discount = double.tryParse(_discountController.text) ?? 0.0;
    final paid = double.tryParse(_paidController.text) ?? 0.0;
    final finalAmount = subTotal - discount;

    final sale = Sale(
      id: const Uuid().v4(),
      invoiceId: "${DateTime.now().millisecondsSinceEpoch}",
      customerName: _nameController.text,
      customerPhone: _phoneController.text,
      items: cart,
      subTotal: subTotal,
      discount: discount,
      finalAmount: finalAmount,
      paidAmount: paid,
      dueAmount: finalAmount - paid,
      timestamp: DateTime.now().millisecondsSinceEpoch,
      deliveryStatus: SaleStatus.delivered
    );

    ref.read(salesProvider.notifier).addSale(sale);
    ref.read(cartProvider.notifier).clearCart();
    
    // Clear Form
    _nameController.clear();
    _phoneController.clear();
    _paidController.clear();
    _discountController.clear();
    
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("বিক্রয় সম্পন্ন হয়েছে!"), backgroundColor: Colors.green));
  }

  @override
  Widget build(BuildContext context) {
    final isDesktop = MediaQuery.of(context).size.width >= 1024;
    final inventory = ref.watch(inventoryProvider);
    final types = ref.watch(productTypesProvider);
    final cart = ref.watch(cartProvider);

    // Derived Lists for Filters
    final brands = inventory.where((g) => g.productType == _selectedType).map((g) => g.brand).toSet().toList();
    final thicknesses = inventory.where((g) => g.productType == _selectedType && g.brand == _selectedBrand).map((g) => g.thickness).toSet().toList();
    final colors = inventory.where((g) => g.productType == _selectedType && g.brand == _selectedBrand && g.thickness == _selectedThickness).map((g) => g.color).toSet().toList();

    return isDesktop
        ? Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(flex: 7, child: _buildProductSelector(types, brands, thicknesses, colors)),
              Expanded(flex: 5, child: _buildCart(cart)),
            ],
          )
        : DefaultTabController(
            length: 2,
            child: Scaffold(
              appBar: AppBar(
                toolbarHeight: 0,
                bottom: const TabBar(tabs: [Tab(text: "পণ্য নির্বাচন"), Tab(text: "কার্ট & বিল")]),
              ),
              body: TabBarView(
                children: [
                  _buildProductSelector(types, brands, thicknesses, colors),
                  _buildCart(cart),
                ],
              ),
            ),
          );
  }

  Widget _buildProductSelector(List<String> types, List<String> brands, List<String> thicknesses, List<String> colors) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Types
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: types.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final isSelected = _selectedType == types[index];
                return ChoiceChip(
                  label: Text(types[index]),
                  selected: isSelected,
                  onSelected: (val) => setState(() { _selectedType = types[index]; _selectedBrand = null; _selectedThickness = null; _selectedColor = null; }),
                );
              },
            ),
          ),
          const SizedBox(height: 24),
          
          if (brands.isNotEmpty) ...[
            const Text("ব্র্যান্ড", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: brands.map((b) => ChoiceChip(
                label: Text(b),
                selected: _selectedBrand == b,
                onSelected: (val) => setState(() { _selectedBrand = b; _selectedThickness = null; _selectedColor = null; }),
              )).toList(),
            ),
            const SizedBox(height: 16),
          ],

          if (thicknesses.isNotEmpty && _selectedBrand != null) ...[
            const Text("মিলি (Thickness)", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: thicknesses.map((t) => ChoiceChip(
                label: Text(t),
                selected: _selectedThickness == t,
                onSelected: (val) => setState(() { _selectedThickness = t; _selectedColor = null; }),
              )).toList(),
            ),
            const SizedBox(height: 16),
          ],

          if (colors.isNotEmpty && _selectedThickness != null) ...[
            const Text("কালার", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: colors.map((c) => ChoiceChip(
                label: Text(c),
                selected: _selectedColor == c,
                onSelected: (val) => setState(() { _selectedColor = c; }),
              )).toList(),
            ),
            const SizedBox(height: 24),
          ],

          // Input Section
          if (_selectedColor != null)
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.blue.shade100)),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _rateController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: "দর (Rate)"),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: TextField(
                      controller: _qtyController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: "পরিমাণ (Pcs)"),
                    ),
                  ),
                  const SizedBox(width: 16),
                  ElevatedButton.icon(
                    onPressed: _addToCart,
                    icon: const Icon(LucideIcons.plus),
                    label: const Text("যোগ"),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                    ),
                  )
                ],
              ),
            )
        ],
      ),
    );
  }

  Widget _buildCart(List<CartItem> cart) {
    final subTotal = cart.fold(0.0, (sum, item) => sum + item.subtotal);

    return Container(
      color: Colors.white,
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.grey.shade200))),
            child: Row(
              children: [
                const Icon(LucideIcons.shoppingCart, color: Color(0xFF2563EB)),
                const SizedBox(width: 8),
                const Text("কার্ট লিস্ট", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const Spacer(),
                Chip(label: Text("${cart.length} items"))
              ],
            ),
          ),
          
          // List
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: cart.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final item = cart[index];
                return ListTile(
                  tileColor: Colors.grey.shade50,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
                  title: Text(item.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  subtitle: Text("${item.formattedQty} x ৳${item.priceUnit}"),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text("৳${item.subtotal.toStringAsFixed(0)}", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      IconButton(
                        icon: const Icon(LucideIcons.trash2, color: Colors.red, size: 18),
                        onPressed: () => ref.read(cartProvider.notifier).removeItem(index),
                      )
                    ],
                  ),
                );
              },
            ),
          ),

          // Footer Checkout
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -4))],
            ),
            child: Column(
              children: [
                Row(children: [
                  Expanded(child: TextField(controller: _nameController, decoration: const InputDecoration(labelText: "কাস্টমার নাম *"))),
                  const SizedBox(width: 16),
                  Expanded(child: TextField(controller: _phoneController, decoration: const InputDecoration(labelText: "মোবাইল"))),
                ]),
                const SizedBox(height: 16),
                Row(children: [
                  Expanded(child: TextField(controller: _discountController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "ছাড় (-)"))),
                  const SizedBox(width: 16),
                  Expanded(child: TextField(controller: _paidController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "জমা (Paid)"))),
                ]),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text("সর্বমোট:", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                    Text("৳${subTotal.toStringAsFixed(0)}", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 24, color: Color(0xFF2563EB))),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: cart.isEmpty ? null : _checkout,
                    icon: const Icon(LucideIcons.checkCircle),
                    label: const Text("অর্ডার কনফার্ম করুন", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.all(20),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                )
              ],
            ),
          )
        ],
      ),
    );
  }
}
