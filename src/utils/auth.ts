import type { Request, Response, NextFunction } from 'express';
import logger from './logger';

// API token for authentication
const API_TOKEN = "sk_transcribe_312_f8a92j3012fadsi321";

/**
 * Middleware to require authentication for routes
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const path = req.path;
    const method = req.method;

    logger.debug(`Authentication attempt for ${method} ${path}`);

    if (!authHeader) {
        logger.warn(`Authentication failed: No authorization header provided for ${method} ${path}`);
        res.status(401).json({ error: 'No authorization header' });
        return;
    }

    try {
        // Check if it's a Bearer token and validate it
        const [authType, token] = authHeader.split(' ');

        if (authType.toLowerCase() !== 'bearer') {
            logger.warn(`Authentication failed: Invalid authorization type '${authType}' for ${method} ${path}`);
            res.status(401).json({ error: 'Invalid authorization type' });
            return;
        }

        if (token !== API_TOKEN) {
            logger.warn(`Authentication failed: Invalid token provided for ${method} ${path}`);
            res.status(401).json({ error: 'Invalid token' });
            return;
        }

        logger.info(`Successfully authenticated request to ${method} ${path}`);
        next();
    } catch (error) {
        logger.error('Authentication error:', { error: error instanceof Error ? error.message : 'Unknown error', path, method });
        res.status(401).json({ error: 'Invalid authorization format' });
        return;
    }
}; 