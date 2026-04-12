
import 'package:uuid/uuid.dart';

const uuid = Uuid();

// Enums
enum CalculationMode { tinBundle, runningFoot, fixedPiece }
enum SaleStatus { delivered, pending }

// --- Inventory Models ---

class ProductGroup {
  final String id;
  final String productType;
  final String brand;
  final String color;
  final String thickness;
  final CalculationMode type;
  final List<ProductVariant> variants;

  ProductGroup({
    required this.id,
    required this.productType,
    required this.brand,
    required this.color,
    required this.thickness,
    required this.type,
    this.variants = const [],
  });

  ProductGroup copyWith({List<ProductVariant>? variants}) {
    return ProductGroup(
      id: id,
      productType: productType,
      brand: brand,
      color: color,
      thickness: thickness,
      type: type,
      variants: variants ?? this.variants,
    );
  }
}

class ProductVariant {
  final String id;
  final double lengthFeet;
  final double? calculationBase; // 72 or 70
  final int stockPieces;
  final double averageCost;

  ProductVariant({
    required this.id,
    required this.lengthFeet,
    this.calculationBase,
    required this.stockPieces,
    required this.averageCost,
  });
}

// --- Sales Models ---

class CartItem {
  final String groupId;
  final String variantId;
  final String name;
  final double lengthFeet;
  final int quantityPieces;
  final String formattedQty;
  final double priceUnit; // Selling Price
  final double buyPriceUnit; // Cost Price
  final double subtotal;
  final String unitType; // 'bundle' or 'piece'

  CartItem({
    required this.groupId,
    required this.variantId,
    required this.name,
    required this.lengthFeet,
    required this.quantityPieces,
    required this.formattedQty,
    required this.priceUnit,
    required this.buyPriceUnit,
    required this.subtotal,
    required this.unitType,
  });
}

class Sale {
  final String id;
  final String invoiceId;
  final String customerName;
  final String customerPhone;
  final String? customerAddress;
  final List<CartItem> items;
  final double subTotal;
  final double discount;
  final double finalAmount;
  final double paidAmount;
  final double dueAmount;
  final int timestamp;
  final SaleStatus deliveryStatus;

  Sale({
    required this.id,
    required this.invoiceId,
    required this.customerName,
    required this.customerPhone,
    this.customerAddress,
    required this.items,
    required this.subTotal,
    required this.discount,
    required this.finalAmount,
    required this.paidAmount,
    required this.dueAmount,
    required this.timestamp,
    required this.deliveryStatus,
  });
}

// --- Sample Data Generator for Testing ---
class MockData {
  static List<ProductGroup> get initialInventory {
    return [
      ProductGroup(
        id: '1',
        productType: 'ঢেউ টিন',
        brand: 'AKS',
        color: 'Master Green',
        thickness: '0.32mm',
        type: CalculationMode.tinBundle,
        variants: [
          ProductVariant(id: 'v1', lengthFeet: 6, calculationBase: 72, stockPieces: 50, averageCost: 450),
          ProductVariant(id: 'v2', lengthFeet: 8, calculationBase: 72, stockPieces: 30, averageCost: 600),
        ],
      ),
      ProductGroup(
        id: '2',
        productType: 'ঢেউ টিন',
        brand: 'PHP',
        color: 'Blue',
        thickness: '0.42mm',
        type: CalculationMode.tinBundle,
        variants: [
          ProductVariant(id: 'v3', lengthFeet: 10, calculationBase: 72, stockPieces: 100, averageCost: 800),
        ],
      ),
      ProductGroup(
        id: '3',
        productType: 'ঢালা (Ridge)',
        brand: 'AKS',
        color: 'Red',
        thickness: 'Standard',
        type: CalculationMode.runningFoot,
        variants: [
          ProductVariant(id: 'v4', lengthFeet: 10, stockPieces: 20, averageCost: 40),
        ],
      ),
    ];
  }
}
