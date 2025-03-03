import type { Request, Response, NextFunction } from 'express';
import logger from './logger.js';
import fs from 'fs';



const TOKEN_MAP: { [key: string]: string } = JSON.parse(fs.readFileSync('./tokens.json', 'utf-8'));

// Create reverse lookup map for tokens to emails
const TOKEN_TO_EMAIL = Object.entries(TOKEN_MAP).reduce((acc, [email, token]) => {
    acc[token] = email;
    return acc;
}, {} as { [key: string]: string });

// sanity check for how many tokens are in the file
console.log(`Number of tokens in the file: ${Object.keys(TOKEN_MAP).length}`);

/**
 * Middleware to require authentication for routes
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const path = req.path;
    const method = req.method;

    if (!authHeader) {
        logger.warn('Authentication failed: No authorization header provided', {
            method,
            path
        });
        res.status(401).json({ error: 'No authorization header' });
        return;
    }

    try {
        // Check if it's a Bearer token and validate it
        const [authType, token] = authHeader.split(' ');

        if (authType.toLowerCase() !== 'bearer') {
            logger.warn('Authentication failed: Invalid authorization type', {
                method,
                path,
                authType
            });
            res.status(401).json({ error: 'Invalid authorization type' });
            return;
        }

        const userEmail = TOKEN_TO_EMAIL[token];
        if (!userEmail) {
            logger.warn('Authentication failed: Invalid token provided', {
                method,
                path
            });
            res.status(401).json({ error: 'Invalid token' });
            return;
        }

        // Add user email to request for use in route handlers
        req.user = userEmail;

        logger.info('Successfully authenticated request', {
            method,
            path,
            user: userEmail
        });
        next();
    } catch (error) {
        logger.error('Authentication error:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            path,
            method
        });
        res.status(401).json({ error: 'Invalid authorization format' });
        return;
    }
};

// Add user property to Express Request type
declare global {
    namespace Express {
        interface Request {
            user: string;
        }
    }
} 