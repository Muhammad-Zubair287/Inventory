import mongoose from 'mongoose';
import { PRODUCT_CATEGORIES, PRODUCT_STATUS } from '../config/constants.js';

/**
 * Product Model Schema
 * Represents inventory products
 */
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters'],
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9-]+$/, 'SKU must contain only uppercase letters, numbers, and hyphens'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    category: {
      type: String,
      enum: Object.values(PRODUCT_CATEGORIES),
      required: [true, 'Category is required'],
    },
    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.AVAILABLE,
      required: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      default: 0,
    },
    minStockLevel: {
      type: Number,
      required: [true, 'Minimum stock level is required'],
      min: [0, 'Minimum stock level cannot be negative'],
      default: 10,
    },
    maxStockLevel: {
      type: Number,
      min: [0, 'Maximum stock level cannot be negative'],
    },
    // Warehouse-specific inventory tracking
    warehouseStock: [{
      warehouse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Warehouse',
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: [0, 'Warehouse quantity cannot be negative'],
        default: 0
      },
      minStockLevel: {
        type: Number,
        min: [0, 'Minimum stock level cannot be negative'],
        default: 10
      },
      location: {
        type: String,
        trim: true,
        description: 'Specific location within warehouse (e.g., Aisle A, Shelf 3)'
      },
      lastRestocked: {
        type: Date
      }
    }],
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative'],
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
    },
    location: {
      type: String,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // Allow null values to be non-unique
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    manufacturer: {
      type: String,
      trim: true,
    },
    warranty: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to auto-update status based on quantity
productSchema.pre('save', function() {
  // Auto-update status based on quantity
  if (this.quantity === 0) {
    this.status = PRODUCT_STATUS.OUT_OF_STOCK;
  } else if (this.quantity <= this.minStockLevel) {
    this.status = PRODUCT_STATUS.LOW_STOCK;
  } else if (this.status === PRODUCT_STATUS.OUT_OF_STOCK || this.status === PRODUCT_STATUS.LOW_STOCK) {
    // Only reset to AVAILABLE if it was previously low/out of stock
    this.status = PRODUCT_STATUS.AVAILABLE;
  }
});

// Pre-update middleware for findOneAndUpdate, findByIdAndUpdate, etc.
productSchema.pre('findOneAndUpdate', async function() {
  const update = this.getUpdate();
  
  // Check if quantity is being updated
  if (update.$set && update.$set.quantity !== undefined) {
    const quantity = update.$set.quantity;
    const doc = await this.model.findOne(this.getQuery());
    
    if (doc) {
      const minStockLevel = update.$set.minStockLevel !== undefined 
        ? update.$set.minStockLevel 
        : doc.minStockLevel;
      
      if (quantity === 0) {
        update.$set.status = PRODUCT_STATUS.OUT_OF_STOCK;
      } else if (quantity <= minStockLevel) {
        update.$set.status = PRODUCT_STATUS.LOW_STOCK;
      } else if (doc.status === PRODUCT_STATUS.OUT_OF_STOCK || doc.status === PRODUCT_STATUS.LOW_STOCK) {
        update.$set.status = PRODUCT_STATUS.AVAILABLE;
      }
    }
  } else if (update.quantity !== undefined) {
    // Handle updates without $set
    const quantity = update.quantity;
    const doc = await this.model.findOne(this.getQuery());
    
    if (doc) {
      const minStockLevel = update.minStockLevel !== undefined 
        ? update.minStockLevel 
        : doc.minStockLevel;
      
      if (quantity === 0) {
        update.status = PRODUCT_STATUS.OUT_OF_STOCK;
      } else if (quantity <= minStockLevel) {
        update.status = PRODUCT_STATUS.LOW_STOCK;
      } else if (doc.status === PRODUCT_STATUS.OUT_OF_STOCK || doc.status === PRODUCT_STATUS.LOW_STOCK) {
        update.status = PRODUCT_STATUS.AVAILABLE;
      }
    }
  }
});

// Indexes for better query performance
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ name: 'text', description: 'text' }); // Text search
productSchema.index({ supplier: 1 });

// Virtual for checking if stock is low
productSchema.virtual('isLowStock').get(function () {
  return this.quantity <= this.minStockLevel;
});

// Virtual for total warehouse stock
productSchema.virtual('totalWarehouseStock').get(function () {
  if (!this.warehouseStock || this.warehouseStock.length === 0) {
    return this.quantity;
  }
  return this.warehouseStock.reduce((total, ws) => total + ws.quantity, 0);
});

// Method to update stock level (legacy - maintains backward compatibility)
productSchema.methods.updateStock = function (quantity, operation = 'add') {
  if (operation === 'add') {
    this.quantity += quantity;
  } else if (operation === 'subtract') {
    this.quantity = Math.max(0, this.quantity - quantity);
  }

  // Update status based on quantity
  if (this.quantity === 0) {
    this.status = PRODUCT_STATUS.OUT_OF_STOCK;
  } else if (this.quantity <= this.minStockLevel) {
    this.status = PRODUCT_STATUS.LOW_STOCK;
  } else {
    this.status = PRODUCT_STATUS.AVAILABLE;
  }

  return this.save();
};

// Method to update warehouse-specific stock
productSchema.methods.updateWarehouseStock = function (warehouseId, quantity, operation = 'add') {
  const warehouseStock = this.warehouseStock.find(ws => ws.warehouse.toString() === warehouseId.toString());
  
  if (!warehouseStock) {
    throw new Error('Warehouse not found for this product');
  }

  if (operation === 'add') {
    warehouseStock.quantity += quantity;
    warehouseStock.lastRestocked = new Date();
  } else if (operation === 'subtract') {
    warehouseStock.quantity = Math.max(0, warehouseStock.quantity - quantity);
  } else if (operation === 'set') {
    warehouseStock.quantity = quantity;
    warehouseStock.lastRestocked = new Date();
  }

  // Update total quantity
  this.quantity = this.warehouseStock.reduce((total, ws) => total + ws.quantity, 0);

  // Update status based on total quantity
  if (this.quantity === 0) {
    this.status = PRODUCT_STATUS.OUT_OF_STOCK;
  } else if (this.quantity <= this.minStockLevel) {
    this.status = PRODUCT_STATUS.LOW_STOCK;
  } else {
    this.status = PRODUCT_STATUS.AVAILABLE;
  }

  return this.save();
};

// Method to get stock by warehouse
productSchema.methods.getWarehouseStock = function (warehouseId) {
  return this.warehouseStock.find(ws => ws.warehouse.toString() === warehouseId.toString());
};

const Product = mongoose.model('Product', productSchema);

export default Product;
