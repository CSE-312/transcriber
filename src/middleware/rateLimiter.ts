import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import logger from '../utils/logger';

// Rate limiter for general API endpoints
export const apiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            method: req.method
        });
        res.status(429).json({
            error: 'Too many requests from this IP, please try again later'
        });
    }
});