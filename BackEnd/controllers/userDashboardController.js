import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS, USER_ROLES } from '../config/constants.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Transaction from '../models/Transaction.js';

/**
 * User Dashboard Controller
 * Handles requests for operational user dashboard
 */

/**
 * @route   GET /api/user-dashboard/stats
 * @desc    Get dashboard stats for logged-in user (warehouse-specific)
 * @access  Private (Staff/Manager)
 */
export const getUserDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const requestedWarehouseId = req.query.warehouseId;

  // Get user with warehouse(s)
  const user = await User.findById(userId)
    .populate('warehouse', 'code name location capacity')
    .populate('warehouses', 'code name location capacity');

  if (!user) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
  }

  // Admin users don't have warehouse restriction
  if (user.role === USER_ROLES.ADMIN) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Admin users should use admin dashboard');
  }

  if (!user.warehouse && (!user.warehouses || user.warehouses.length === 0)) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'No warehouse assigned to this user');
  }

  // Determine which warehouse to use:
  // 1. If a warehouseId was passed in the query and the user has access to it, use it
  // 2. Otherwise fall back to user.warehouse (primary warehouse)
  let selectedWarehouse = user.warehouse;

  if (requestedWarehouseId) {
    // Check if the requested warehouse is the user's primary warehouse
    const primaryMatch = user.warehouse && user.warehouse._id.toString() === requestedWarehouseId;
    // Check if it's in the user's warehouses array (for managers)
    const multiMatch = user.warehouses && user.warehouses.find(
      w => w._id.toString() === requestedWarehouseId
    );

    if (primaryMatch) {
      selectedWarehouse = user.warehouse;
    } else if (multiMatch) {
      selectedWarehouse = multiMatch;
    } else {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access to the requested warehouse is not permitted');
    }
  } else if (!selectedWarehouse && user.warehouses && user.warehouses.length > 0) {
    // No primary warehouse but has multi-warehouses; use the first one as fallback
    selectedWarehouse = user.warehouses[0];
  }

  const warehouseId = selectedWarehouse._id;

  // Get warehouse-specific stats
  const [
    totalProducts,
    lowStockProductsResult,
    recentTransactions,
    warehouseStock,
  ] = await Promise.all([
    // Total products in user's warehouse
    Product.countDocuments({
      'warehouseStock.warehouse': warehouseId,
    }),

    // Low stock products in user's warehouse using aggregation
    Product.aggregate([
      { $unwind: '$warehouseStock' },
      { 
        $match: { 
          'warehouseStock.warehouse': warehouseId 
        } 
      },
      {
        $addFields: {
          isLowStock: {
            $lte: ['$warehouseStock.quantity', '$warehouseStock.minStockLevel']
          }
        }
      },
      { $match: { isLowStock: true } },
      { $limit: 5 },
      {
        $project: {
          _id: 1,
          name: 1,
          sku: 1,
          warehouseQuantity: '$warehouseStock.quantity',
          minStockLevel: '$warehouseStock.minStockLevel'
        }
      }
    ]),

    // Recent transactions for this warehouse
    Transaction.find({ warehouse: warehouseId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('product', 'name sku')
      .populate('performedBy', 'name'),

    // Calculate total stock value in warehouse
    Product.aggregate([
      { $unwind: '$warehouseStock' },
      { $match: { 'warehouseStock.warehouse': warehouseId } },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$warehouseStock.quantity' },
          totalValue: { $sum: { $multiply: ['$unitPrice', '$warehouseStock.quantity'] } },
        },
      },
    ]),
  ]);

  const stockValue = warehouseStock[0] || { totalQuantity: 0, totalValue: 0 };

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(
      HTTP_STATUS.OK,
      {
        user: {
          name: user.name,
          email: user.email,
          role: user.role,
        },
        warehouse: selectedWarehouse,
        stats: {
          totalProducts,
          lowStockCount: lowStockProductsResult.length,
          totalQuantity: stockValue.totalQuantity,
          totalValue: stockValue.totalValue,
        },
        lowStockProducts: lowStockProductsResult,
        recentTransactions,
      },
      'User dashboard stats fetched successfully'
    )
  );
});

/**
 * @route   GET /api/user-dashboard/warehouse-products
 * @desc    Get all products in user's assigned warehouse
 * @access  Private (Staff/Manager)
 */
export const getWarehouseProducts = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10, search, warehouseId: requestedWarehouseId } = req.query;

  const user = await User.findById(userId)
    .populate('warehouse', 'code name location')
    .populate('warehouses', 'code name location');

  if (!user) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
  }

  // Determine warehouse to use (same logic as stats endpoint)
  let selectedWarehouseId;

  if (requestedWarehouseId) {
    const primaryMatch = user.warehouse && user.warehouse._id.toString() === requestedWarehouseId;
    const multiMatch = user.warehouses && user.warehouses.find(
      w => w._id.toString() === requestedWarehouseId
    );
    if (primaryMatch || multiMatch) {
      selectedWarehouseId = requestedWarehouseId;
    } else {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Access to the requested warehouse is not permitted');
    }
  } else if (user.warehouse) {
    selectedWarehouseId = user.warehouse._id;
  } else if (user.warehouses && user.warehouses.length > 0) {
    selectedWarehouseId = user.warehouses[0]._id;
  } else {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'No warehouse assigned');
  }

  const filter = {
    'warehouseStock.warehouse': selectedWarehouseId,
  };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ name: 1 }),
    Product.countDocuments(filter),
  ]);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(
      HTTP_STATUS.OK,
      {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
      'Warehouse products fetched successfully'
    )
  );
});
