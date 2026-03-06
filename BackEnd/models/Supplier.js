import mongoose from 'mongoose';
import { SUPPLIER_STATUS } from '../config/constants.js';

/**
 * Supplier Model Schema
 * Represents product suppliers
 */
const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      minlength: [2, 'Supplier name must be at least 2 characters'],
      maxlength: [200, 'Supplier name cannot exceed 200 characters'],
    },
    code: {
      type: String,
      required: [true, 'Supplier code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9-]+$/, 'Supplier code must contain only uppercase letters, numbers, and hyphens'],
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^\+?[\d\s-()]+$/, 'Please provide a valid phone number'],
    },
    address: {
      street: {
        type: String,
        trim: true,
      },
      city: {
        type: String,
        trim: true,
      },
      state: {
        type: String,
        trim: true,
      },
      country: {
        type: String,
        trim: true,
      },
      postalCode: {
        type: String,
        trim: true,
      },
    },
    status: {
      type: String,
      enum: Object.values(SUPPLIER_STATUS),
      default: SUPPLIER_STATUS.ACTIVE,
      required: true,
    },
    paymentTerms: {
      type: String,
      trim: true,
    },
    taxId: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
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

// Indexes
supplierSchema.index({ status: 1 });
supplierSchema.index({ email: 1 });
supplierSchema.index({ name: 'text' }); // Text search

const Supplier = mongoose.model('Supplier', supplierSchema);

export default Supplier;
