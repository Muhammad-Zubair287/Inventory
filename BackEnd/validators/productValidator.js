import Joi from 'joi';
import { PRODUCT_CATEGORIES, PRODUCT_STATUS } from '../config/constants.js';

/**
 * Product validation schemas
 */

export const createProductSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(2).max(200).required().messages({
      'string.empty': 'Product name is required',
      'string.min': 'Product name must be at least 2 characters',
      'string.max': 'Product name cannot exceed 200 characters',
    }),
    sku: Joi.string()
      .pattern(/^[A-Z0-9-]+$/)
      .required()
      .messages({
        'string.empty': 'SKU is required',
        'string.pattern.base': 'SKU must contain only uppercase letters, numbers, and hyphens',
      }),
    description: Joi.string().allow('').max(1000),
    category: Joi.string()
      .valid(...Object.values(PRODUCT_CATEGORIES))
      .required()
      .messages({
        'string.empty': 'Category is required',
        'any.only': 'Invalid category',
      }),
    quantity: Joi.number().min(0).default(0),
    minStockLevel: Joi.number().min(0).default(10),
    maxStockLevel: Joi.number().min(0),
    unitPrice: Joi.number().min(0).required().messages({
      'number.base': 'Unit price must be a number',
      'number.min': 'Unit price cannot be negative',
      'any.required': 'Unit price is required',
    }),
    warehouseStock: Joi.array().items(
      Joi.object({
        warehouse: Joi.string().required(),
        quantity: Joi.number().min(0).default(0),
        minStockLevel: Joi.number().min(0).default(10),
        location: Joi.string().allow('').max(200),
      })
    ).optional(),
    supplier: Joi.string(),
    location: Joi.string().max(200),
    barcode: Joi.string(),
    imageUrl: Joi.string().uri(),
    manufacturer: Joi.string().max(200),
    warranty: Joi.string().max(200),
  }).custom((value, helpers) => {
    // Cross-field validation: sum of warehouse quantities must not exceed total product quantity
    if (value.warehouseStock && value.warehouseStock.length > 0) {
      const totalWarehouseQty = value.warehouseStock.reduce(
        (sum, ws) => sum + (ws.quantity || 0),
        0
      );
      if (totalWarehouseQty > (value.quantity || 0)) {
        return helpers.message(
          'Assigned warehouse quantity exceeds total product quantity.'
        );
      }
    }
    return value;
  }),
});

export const updateProductSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(2).max(200),
    description: Joi.string().allow('').max(1000),
    category: Joi.string().valid(...Object.values(PRODUCT_CATEGORIES)),
    status: Joi.string().valid(...Object.values(PRODUCT_STATUS)),
    quantity: Joi.number().min(0),
    minStockLevel: Joi.number().min(0),
    maxStockLevel: Joi.number().min(0),
    unitPrice: Joi.number().min(0),
    warehouseStock: Joi.array().items(
      Joi.object({
        warehouse: Joi.string().required(),
        quantity: Joi.number().min(0).default(0),
        minStockLevel: Joi.number().min(0).default(10),
        location: Joi.string().allow('').max(200),
      })
    ).optional(),
    supplier: Joi.string(),
    location: Joi.string().max(200),
    barcode: Joi.string(),
    imageUrl: Joi.string().uri(),
    manufacturer: Joi.string().max(200),
    warranty: Joi.string().max(200),
  }).custom((value, helpers) => {
    // Cross-field validation: sum of warehouse quantities must not exceed total product quantity
    if (value.warehouseStock && value.warehouseStock.length > 0 && value.quantity !== undefined) {
      const totalWarehouseQty = value.warehouseStock.reduce(
        (sum, ws) => sum + (ws.quantity || 0),
        0
      );
      if (totalWarehouseQty > value.quantity) {
        return helpers.message(
          'Assigned warehouse quantity exceeds total product quantity.'
        );
      }
    }
    return value;
  }),
  params: Joi.object({
    id: Joi.string().required(),
  }),
});

export const getProductSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required(),
  }),
});

export const deleteProductSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().required(),
  }),
});

export const listProductsSchema = Joi.object({
  query: Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(10),
    category: Joi.string().valid(...Object.values(PRODUCT_CATEGORIES)),
    status: Joi.string().valid(...Object.values(PRODUCT_STATUS)),
    search: Joi.string(),
    sortBy: Joi.string().valid('name', 'createdAt', 'quantity', 'unitPrice'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),
});

export const updateStockSchema = Joi.object({
  body: Joi.object({
    quantity: Joi.number().integer().min(1).required().messages({
      'number.base': 'Quantity must be a number',
      'number.min': 'Quantity must be at least 1',
      'any.required': 'Quantity is required',
    }),
    type: Joi.string().valid('add', 'subtract', 'set').required().messages({
      'any.only': 'Type must be one of: add, subtract, or set',
      'any.required': 'Type is required',
    }),
  }),
  params: Joi.object({
    id: Joi.string().required(),
  }),
});
