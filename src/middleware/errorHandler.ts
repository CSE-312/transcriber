import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors.js';
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

    // Log the error
    logger.error('Error occurred:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    // Handle validation errors
    if (err instanceof ValidationError) {
        res.status(400).json({
            error: err.message
        });
        return;
    }

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