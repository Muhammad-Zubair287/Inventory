import transactionService from '../services/transactionService.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * Transaction Controller
 * Handles HTTP requests for inventory transactions
 */

/**
 * @route   POST /api/transactions
 * @desc    Create a new transaction (stock in/out)
 * @access  Private (Admin, Manager)
 */
export const createTransaction = asyncHandler(async (req, res) => {
  const transaction = await transactionService.createTransaction(req.body, req.user.id);

  res.status(HTTP_STATUS.CREATED).json(
    new ApiResponse(HTTP_STATUS.CREATED, transaction, 'Transaction created successfully')
  );
});

/**
 * @route   GET /api/transactions
 * @desc    Get all transactions with filters
 * @access  Private
 */
export const getAllTransactions = asyncHandler(async (req, res) => {
  const result = await transactionService.getAllTransactions(req.query);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, 'Transactions fetched successfully')
  );
});

/**
 * @route   GET /api/transactions/stats
 * @desc    Get transaction statistics
 * @access  Private
 */
export const getTransactionStats = asyncHandler(async (req, res) => {
  const stats = await transactionService.getTransactionStats(req.query);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, stats, 'Transaction stats fetched successfully')
  );
});

/**
 * @route   GET /api/transactions/:id
 * @desc    Get transaction by ID
 * @access  Private
 */
export const getTransactionById = asyncHandler(async (req, res) => {
  const transaction = await transactionService.getTransactionById(req.params.id);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, transaction, 'Transaction fetched successfully')
  );
});

/**
 * @route   GET /api/transactions/product-summary
 * @desc    Get product-level transaction summary (unique products with totals)
 * @access  Private (Admin)
 */
export const getProductTransactionSummary = asyncHandler(async (req, res) => {
  const result = await transactionService.getProductTransactionSummary(req.query);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, 'Product transaction summary fetched successfully')
  );
});

/**
 * @route   GET /api/transactions/product/:productId
 * @desc    Get transactions by product with optional date filters
 * @access  Private
 */
export const getTransactionsByProduct = asyncHandler(async (req, res) => {
  const result = await transactionService.getTransactionsByProduct(req.params.productId, req.query);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, result, 'Product transactions fetched successfully')
  );
});

/**
 * @route   DELETE /api/transactions/:id
 * @desc    Delete transaction (with stock reversal)
 * @access  Private (Admin only)
 */
export const deleteTransaction = asyncHandler(async (req, res) => {
  await transactionService.deleteTransaction(req.params.id);

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse(HTTP_STATUS.OK, null, 'Transaction deleted successfully')
  );
});
