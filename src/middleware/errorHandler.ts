import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

// Global error handler middleware for unhandled errors
export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: NextFunction
): void => {
    const requestId = req.headers['x-request-id'] || 'unknown';

    // Handle multer errors
    if (err.name === 'MulterError') {
        logger.warn(`File Upload Error: ${err.message}`, {
            requestId,
            path: req.path,
            method: req.method
        });

        res.status(400).json({
            error: 'File upload error',
            details: err.message
        });
        return;
    }

    // Log all unhandled errors
    logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        requestId,
        path: req.path,
        method: req.method
    });

    // Don't expose internal error details in production
    res.status(500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message
    });
}; 