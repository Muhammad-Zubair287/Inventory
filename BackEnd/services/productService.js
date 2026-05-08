import Product from '../models/Product.js';
import Transaction from '../models/Transaction.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS, PRODUCT_STATUS, TRANSACTION_TYPES, TRANSACTION_STATUS } from '../config/constants.js';
import logger from '../utils/logger.js';

/**
 * Product Service
 * Business logic for product management operations
 */

class ProductService {
  /**
   * Create a new product
   */
  async createProduct(productData) {
    try {
      // Check if product with same SKU already exists
      const existingProduct = await Product.findOne({ sku: productData.sku });
      if (existingProduct) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Product with this SKU already exists');
      }

      // Validate that total warehouse quantities do not exceed product quantity
      if (productData.warehouseStock && productData.warehouseStock.length > 0) {
        const totalWarehouseQty = productData.warehouseStock.reduce(
          (sum, ws) => sum + (ws.quantity || 0),
          0
        );
        const productQty = productData.quantity || 0;
        if (totalWarehouseQty > productQty) {
          throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            `Assigned warehouse quantity (${totalWarehouseQty}) exceeds total product quantity (${productQty}).`
          );
        }
      }

      const product = await Product.create(productData);
      logger.info(`Product created: ${product._id}`);

      // Auto-create a STOCK_IN transaction for every warehouse that received stock
      if (productData.warehouseStock && productData.warehouseStock.length > 0) {
        const stockInWarehouses = productData.warehouseStock.filter(ws => (ws.quantity || 0) > 0);

        for (const ws of stockInWarehouses) {
          try {
            const transactionNumber = await Transaction.generateTransactionNumber(
              TRANSACTION_TYPES.STOCK_IN
            );
            await Transaction.create({
              transactionNumber,
              type: TRANSACTION_TYPES.STOCK_IN,
              status: TRANSACTION_STATUS.COMPLETED,
              product: product._id,
              quantity: ws.quantity,
              unitPrice: product.unitPrice,
              totalPrice: ws.quantity * product.unitPrice,
              warehouse: ws.warehouse,
              supplier: product.supplier || null,
              notes: 'Initial stock assigned during product creation',
              performedBy: productData.createdBy,
              transactionDate: new Date(),
            });
          } catch (txErr) {
            // Log but don't fail the whole request — product is already saved
            logger.error(`Failed to create stock_in transaction for warehouse ${ws.warehouse} during product creation:`, txErr);
          }
        }
      }

      return product;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error creating product:', error);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to create product');
    }
  }

  /**
   * Get all products with pagination, search, and filters
   */
  async getAllProducts(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        category = '',
        status = '',
        minPrice = 0,
        maxPrice = Number.MAX_SAFE_INTEGER,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        warehouseId = '',
        warehouse = '',
        includeZeroStock = false,
      } = options;

      const selectedWarehouseId = warehouseId || warehouse;
      const shouldIncludeZeroStock = String(includeZeroStock).toLowerCase() === 'true' || String(includeZeroStock) === '1';

      // Build query
      const query = {};

      // Search by name, SKU, or description
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      // Filter by category
      if (category) {
        query.category = category;
      }

      // Filter by status
      if (status) {
        query.status = status;
      }

      // Filter by price range (only apply if explicitly provided)
      if (minPrice > 0 || maxPrice < Number.MAX_SAFE_INTEGER) {
        query.unitPrice = { $gte: minPrice, $lte: maxPrice };
      }

      // Calculate pagination
      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

      // Execute query
      const [products, total] = await Promise.all([
        Product.find(query)
          .populate('supplier', 'name email phone')
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit)),
        Product.countDocuments(query),
      ]);

      const normalizedProducts = products
        .map((product) => {
          const productObj = product.toObject();

          if (!selectedWarehouseId) {
            return {
              ...productObj,
              warehouseQuantity: productObj.quantity || 0,
            };
          }

          const matchingWarehouseStock = (productObj.warehouseStock || []).find((stock) => {
            const stockWarehouseId = stock?.warehouse?._id || stock?.warehouse;
            return stockWarehouseId && String(stockWarehouseId) === String(selectedWarehouseId);
          });

          return {
            ...productObj,
            warehouseQuantity: matchingWarehouseStock?.quantity || 0,
          };
        })
        .filter((productObj) => {
          if (!selectedWarehouseId) {
            return true;
          }

          if (shouldIncludeZeroStock) {
            return true;
          }

          return Number(productObj.warehouseQuantity || 0) > 0;
        });

      return {
        products: normalizedProducts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error fetching products:', error);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to fetch products');
    }
  }

  /**
   * Get product by ID
   */
  async getProductById(productId) {
    try {
      const product = await Product.findById(productId)
        .populate('supplier', 'name email phone')
        .populate('warehouseStock.warehouse', 'name code location');

      if (!product) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Product not found');
      }

      return product;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error fetching product:', error);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to fetch product');
    }
  }

  /**
   * Update product
   */
  async updateProduct(productId, updateData) {
    try {
      // If SKU is being updated, check for duplicates
      if (updateData.sku) {
        const existingProduct = await Product.findOne({
          sku: updateData.sku,
          _id: { $ne: productId },
        });

        if (existingProduct) {
          throw new ApiError(HTTP_STATUS.CONFLICT, 'Product with this SKU already exists');
        }
      }

      // Validate warehouse quantity against total quantity when both are provided
      if (
        updateData.warehouseStock &&
        updateData.warehouseStock.length > 0 &&
        updateData.quantity !== undefined
      ) {
        const totalWarehouseQty = updateData.warehouseStock.reduce(
          (sum, ws) => sum + (ws.quantity || 0),
          0
        );
        if (totalWarehouseQty > updateData.quantity) {
          throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            `Assigned warehouse quantity (${totalWarehouseQty}) exceeds total product quantity (${updateData.quantity}).`
          );
        }
      }

      const product = await Product.findByIdAndUpdate(
        productId,
        { ...updateData, updatedAt: Date.now() },
        { new: true, runValidators: true }
      ).populate('supplier', 'name email phone');

      if (!product) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Product not found');
      }

      logger.info(`Product updated: ${product._id}`);
      return product;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error updating product:', error);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to update product');
    }
  }

  /**
   * Delete product
   */
  async deleteProduct(productId) {
    try {
      const product = await Product.findByIdAndDelete(productId);

      if (!product) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Product not found');
      }

      logger.info(`Product deleted: ${productId}`);
      return product;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error deleting product:', error);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to delete product');
    }
  }

  /**
   * Update product stock quantity
   */
  async updateStock(productId, quantity, type = 'add') {
    try {
      const product = await Product.findById(productId);

      if (!product) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Product not found');
      }

      if (type === 'add') {
        product.quantity += quantity;
      } else if (type === 'subtract') {
        if (product.quantity < quantity) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Insufficient stock quantity');
        }
        product.quantity -= quantity;
      } else {
        product.quantity = quantity;
      }

      // Update status based on quantity
      if (product.quantity === 0) {
        product.status = PRODUCT_STATUS.OUT_OF_STOCK;
      } else if (product.quantity <= product.minimumStock) {
        product.status = PRODUCT_STATUS.LOW_STOCK;
      } else {
        product.status = PRODUCT_STATUS.AVAILABLE;
      }

      await product.save();
      logger.info(`Product stock updated: ${productId}, new quantity: ${product.quantity}`);
      return product;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error updating stock:', error);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to update stock');
    }
  }

  /**
   * Update warehouse-specific stock quantity
   */
  async updateWarehouseStock(productId, warehouseId, quantity, type = 'add') {
    try {
      const product = await Product.findById(productId);

      if (!product) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Product not found');
      }

      // Find or create warehouse stock entry
      let warehouseStock = product.warehouseStock.find(
        ws => ws.warehouse.toString() === warehouseId.toString()
      );

      if (!warehouseStock) {
        // Create new warehouse stock entry
        product.warehouseStock.push({
          warehouse: warehouseId,
          quantity: 0,
          minStockLevel: product.minStockLevel || 10
        });
        warehouseStock = product.warehouseStock[product.warehouseStock.length - 1];
      }

      // Update warehouse quantity
      if (type === 'add') {
        warehouseStock.quantity += quantity;
        warehouseStock.lastRestocked = new Date();
      } else if (type === 'subtract') {
        if (warehouseStock.quantity < quantity) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Insufficient stock in this warehouse');
        }
        warehouseStock.quantity -= quantity;
      } else {
        warehouseStock.quantity = quantity;
        warehouseStock.lastRestocked = new Date();
      }

      await product.save();
      logger.info(`Warehouse stock updated: Product ${productId}, Warehouse ${warehouseId}, new quantity: ${warehouseStock.quantity}`);
      return product;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Error updating warehouse stock:', error);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to update warehouse stock');
    }
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts() {
    try {
      const products = await Product.find({
        $or: [
          { status: PRODUCT_STATUS.LOW_STOCK },
          { status: PRODUCT_STATUS.OUT_OF_STOCK },
        ],
      })
        .populate('supplier', 'name email phone')
        .sort({ quantity: 1 });

      return products;
    } catch (error) {
      logger.error('Error fetching low stock products:', error);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to fetch low stock products');
    }
  }

  /**
   * Get product categories
   */
  async getCategories() {
    try {
      const categories = await Product.distinct('category');
      return categories.filter(Boolean);
    } catch (error) {
      logger.error('Error fetching categories:', error);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to fetch categories');
    }
  }

  /**
   * Get products by supplier
   */
  async getProductsBySupplier(supplierId) {
    try {
      const products = await Product.find({ supplier: supplierId });
      return products;
    } catch (error) {
      logger.error('Error fetching products by supplier:', error);
      throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to fetch products');
    }
  }
}

export default new ProductService();
