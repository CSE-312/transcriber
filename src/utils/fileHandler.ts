import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import multer from 'multer';
import type { Request } from 'express';
import logger from './logger.js';

// Constants
const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300MB
const MAX_DURATION = 60; // 60 seconds
const UPLOAD_DIR = path.join(os.tmpdir(), 'transcribe_uploads');
const ALLOWED_EXTENSIONS = ['mp3'] as const;
type AllowedExtension = typeof ALLOWED_EXTENSIONS[number];

// Create upload directory
try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    logger.info(`Created upload directory at ${UPLOAD_DIR}`);
} catch (error) {
    logger.error('Failed to create upload directory:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: UPLOAD_DIR
    });
    throw error;
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        logger.debug('Storing file in upload directory', { path: UPLOAD_DIR });
        cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        logger.debug('Using original filename for upload', { filename: file.originalname });
        cb(null, file.originalname);
    }
});

// File filter for multer
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
    const isValid = allowedFile(file.originalname);
    if (isValid) {
        logger.debug('File type accepted', { filename: file.originalname });
        cb(null, true);
    } else {
        logger.warn('Invalid file type rejected', { filename: file.originalname });
        cb(new Error('Invalid file type - only MP3 files are allowed'));
    }
};

// Create multer upload middleware
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE
    }
});

/**
 * Check if the file has an allowed extension
 */
export const allowedFile = (filename: string): boolean => {
    const extension = filename.split('.').pop()?.toLowerCase();
    const isAllowed = !!extension && ALLOWED_EXTENSIONS.includes(extension as AllowedExtension);

    logger.debug('Checking file extension', {
        filename,
        extension: extension || 'none',
        isAllowed
    });

    return isAllowed;
};

/**
 * Check if the audio file duration is within limits
 */
export const checkDuration = async (filePath: string): Promise<void> => {
    const execPromise = promisify(exec);
    logger.debug('Checking audio duration', { filePath });

    try {
        const { stdout } = await execPromise(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`);
        const duration = parseFloat(stdout.trim());

        if (isNaN(duration)) {
            logger.error('Could not parse duration from ffprobe output', { filePath, stdout });
            throw new Error('Could not determine audio file duration');
        }

        const isWithinLimit = duration <= MAX_DURATION;
        logger.info('Audio duration check complete', {
            filePath,
            duration: `${duration} seconds`,
            isWithinLimit,
            limit: `${MAX_DURATION} seconds`
        });

        if (!isWithinLimit) {
            throw new Error(`Audio file duration exceeds the ${MAX_DURATION} second limit`);
        }
    } catch (error) {
        logger.error('Error checking audio duration:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            filePath
        });
        throw error;
    }
};

/**
 * Clean up a file after processing
 */
export const cleanupFile = (filePath: string): void => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.debug('Successfully cleaned up file', { filePath });
        } else {
            logger.debug('No file to clean up', { filePath });
        }
    } catch (error) {
        logger.error('Error cleaning up file:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            filePath
        });
        // We don't throw here as this is cleanup code
    }
}; 