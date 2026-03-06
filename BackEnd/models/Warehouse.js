import mongoose from 'mongoose';

const warehouseSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Warehouse code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^WH-[A-Z0-9]+$/, 'Warehouse code must start with WH- followed by alphanumeric characters']
  },
  name: {
    type: String,
    required: [true, 'Warehouse name is required'],
    trim: true
  },
  location: {
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      default: 'USA'
    },
    zipCode: {
      type: String,
      required: [true, 'Zip code is required'],
      trim: true
    }
  },
  contactPerson: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  capacity: {
    type: Number,
    default: 0,
    min: [0, 'Capacity cannot be negative']
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
warehouseSchema.index({ status: 1 });
warehouseSchema.index({ 'location.city': 1 });
warehouseSchema.index({ 'location.state': 1 });

// Virtual for full address
warehouseSchema.virtual('fullAddress').get(function() {
  return `${this.location.address}, ${this.location.city}, ${this.location.state} ${this.location.zipCode}, ${this.location.country}`;
});

// Enable virtuals in JSON
warehouseSchema.set('toJSON', { virtuals: true });
warehouseSchema.set('toObject', { virtuals: true });

const Warehouse = mongoose.model('Warehouse', warehouseSchema);

export default Warehouse;
