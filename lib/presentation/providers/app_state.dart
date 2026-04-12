
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/models.dart';

// --- Inventory Provider ---
class InventoryNotifier extends StateNotifier<List<ProductGroup>> {
  InventoryNotifier() : super(MockData.initialInventory);

  void updateStock(String groupId, String variantId, int qtyChange) {
    state = [
      for (final group in state)
        if (group.id == groupId)
          group.copyWith(
            variants: [
              for (final variant in group.variants)
                if (variant.id == variantId)
                  ProductVariant(
                    id: variant.id,
                    lengthFeet: variant.lengthFeet,
                    calculationBase: variant.calculationBase,
                    stockPieces: variant.stockPieces + qtyChange,
                    averageCost: variant.averageCost,
                  )
                else
                  variant
            ],
          )
        else
          group
    ];
  }
}

final inventoryProvider = StateNotifierProvider<InventoryNotifier, List<ProductGroup>>((ref) {
  return InventoryNotifier();
});

// --- Cart Provider ---
class CartNotifier extends StateNotifier<List<CartItem>> {
  CartNotifier() : super([]);

  void addItem(CartItem item) {
    state = [...state, item];
  }

  void removeItem(int index) {
    List<CartItem> newState = [...state];
    newState.removeAt(index);
    state = newState;
  }

  void clearCart() {
    state = [];
  }
}

final cartProvider = StateNotifierProvider<CartNotifier, List<CartItem>>((ref) {
  return CartNotifier();
});

// --- Sales Provider ---
class SalesNotifier extends StateNotifier<List<Sale>> {
  SalesNotifier() : super([]);

  void addSale(Sale sale) {
    state = [sale, ...state];
  }
}

final salesProvider = StateNotifierProvider<SalesNotifier, List<Sale>>((ref) {
  return SalesNotifier();
});

// --- Settings Provider (Simple Strings for now) ---
final brandsProvider = Provider<List<String>>((ref) => ['AKS', 'PHP', 'TK', 'KDS', 'Appollo']);
final productTypesProvider = Provider<List<String>>((ref) => ['ঢেউ টিন', 'ঢালা (Ridge)', 'ঝালট (Flashing)', 'স্ক্রু/নাট', 'অন্যান্য']);
