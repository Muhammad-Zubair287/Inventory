import mongoose from 'mongoose';
import { TRANSACTION_TYPES, TRANSACTION_STATUS } from '../config/constants.js';

/**
 * Transaction Model Schema
 * Represents stock movements (in/out/adjustments)
 */
const transactionSchema = new mongoose.Schema(
  {
    transactionNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(TRANSACTION_TYPES),
      required: [true, 'Transaction type is required'],
    },
    status: {
      type: String,
      enum: Object.values(TRANSACTION_STATUS),
      default: TRANSACTION_STATUS.PENDING,
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative'],
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: [true, 'Warehouse is required'],
    },
    referenceNumber: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    transactionDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
transactionSchema.index({ type: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ product: 1 });
transactionSchema.index({ transactionDate: -1 });
transactionSchema.index({ performedBy: 1 });

// Pre-save hook to calculate total price
transactionSchema.pre('save', function () {
  this.totalPrice = this.quantity * this.unitPrice;
});

// Static method to generate transaction number
transactionSchema.statics.generateTransactionNumber = async function (type) {
  const prefix = {
    [TRANSACTION_TYPES.STOCK_IN]: 'SI',
    [TRANSACTION_TYPES.STOCK_OUT]: 'SO',
    [TRANSACTION_TYPES.ADJUSTMENT]: 'ADJ',
    [TRANSACTION_TYPES.RETURN]: 'RET',
    [TRANSACTION_TYPES.DAMAGED]: 'DMG',
  };

  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  const count = await this.countDocuments({
    type,
    createdAt: {
      $gte: new Date(date.getFullYear(), date.getMonth(), 1),
      $lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
    },
  });

  const sequence = (count + 1).toString().padStart(4, '0');
  return `${prefix[type]}-${year}${month}-${sequence}`;
};

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
