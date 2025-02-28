import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import multer from 'multer';
import type { Request } from 'express';

// Create a temporary directory for file uploads
const UPLOAD_DIR = path.join(os.tmpdir(), 'transcribe_uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['mp3'];

// Configure multer storage
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        cb(null, file.originalname);
    }
});

// File filter for multer
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (allowedFile(file.originalname)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'));
    }
};

// Create multer upload middleware
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
    }
});

/**
 * Check if the file has an allowed extension
 */
export const allowedFile = (filename: string): boolean => {
    const extension = filename.split('.').pop()?.toLowerCase();
    return !!extension && ALLOWED_EXTENSIONS.includes(extension);
};

/**
 * Check if the audio file duration is within limits (60 seconds)
 */
export const checkDuration = async (filePath: string): Promise<boolean> => {
    const execPromise = promisify(exec);

    try {
        const { stderr } = await execPromise(`ffmpeg -i "${filePath}"`);

        // Look for Duration in the output
        const durationLine = stderr.split('\n').find(line => line.includes('Duration'));

        if (!durationLine) {
            return false;
        }

        // Extract the time part
        const durationMatch = durationLine.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);

        if (!durationMatch) {
            return false;
        }

        const hours = parseFloat(durationMatch[1]);
        const minutes = parseFloat(durationMatch[2]);
        const seconds = parseFloat(durationMatch[3]);

        const totalSeconds = hours * 3600 + minutes * 60 + seconds;

        return totalSeconds <= 60;
    } catch (error) {
        console.error('Error checking duration:', error);
        return false;
    }
};

/**
 * Clean up a file after processing
 */
export const cleanupFile = (filePath: string): void => {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}; 