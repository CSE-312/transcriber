import type { Request, Response, NextFunction } from 'express';

// API token for authentication
const API_TOKEN = "sk_transcribe_312_f8a92j3012fadsi321";

/**
 * Middleware to require authentication for routes
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.status(401).json({ error: 'No authorization header' });
        return;
    }

    try {
        // Check if it's a Bearer token and validate it
        const [authType, token] = authHeader.split(' ');

        if (authType.toLowerCase() !== 'bearer') {
            res.status(401).json({ error: 'Invalid authorization type' });
            return;
        }

        if (token !== API_TOKEN) {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }

        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid authorization format' });
        return;
    }
}; 