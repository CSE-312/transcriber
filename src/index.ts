import express, { type Request, type Response, type NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import fs from "fs";
import {
    S3Client,
    PutObjectCommand,
    HeadObjectCommand,
    type PutObjectCommandInput,
    type HeadObjectCommandInput
} from "@aws-sdk/client-s3";
import {
    TranscribeClient,
    StartTranscriptionJobCommand,
    type StartTranscriptionJobCommandInput
} from "@aws-sdk/client-transcribe";
import { requireAuth } from "./utils/auth.js";
import trackEvent from "./utils/umami.js";
import { upload, checkDuration, cleanupFile } from "./utils/fileHandler.js";
import logger from "./utils/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import "./instrument.js";
import * as Sentry from "@sentry/node";

// Load environment variables
dotenv.config();


const app = express();

app.set('trust proxy', true);

// Add request ID to each request
app.use((req: Request, _res: Response, next: NextFunction) => {
    req.headers['x-request-id'] = uuidv4();
    next();
});

// Apply rate limiters
app.use(apiLimiter); // Apply general rate limiting to all routes
app.use(express.json({
    limit: '1mb' // Limit JSON payload size
}));

// AWS Configuration
const S3_BUCKET = '312-transcriptions';
const AWS_REGION = 'us-east-1';

// Validate required environment variables
const requiredEnvVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] as const;
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        logger.error(`Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

// Initialize AWS clients
const s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
});

const transcribeClient = new TranscribeClient({
    region: AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
});

// Transcribe route
app.post("/transcribe",
    requireAuth,
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
        const startTime = Date.now();
        const requestId = req.headers['x-request-id'];

        logger.info('Starting transcription request', {
            requestId,
            user: req.user,
            contentType: req.get('Content-Type'),
            fileSize: req.get('Content-Length')
        });

        if (!req.file) {
            logger.warn('No file provided in request', {
                requestId,
                user: req.user
            });
            res.status(400).json({ error: 'No file provided' });
            return;
        }

        const filePath = req.file.path;
        logger.debug('File uploaded successfully', {
            requestId,
            user: req.user,
            filename: req.file.originalname,
            path: filePath,
            size: req.file.size
        });

        try {
            // Check file duration
            await checkDuration(filePath);

            const uniqueId = uuidv4();
            const s3Key = `transcriptions/${uniqueId}.mp3`;

            // Upload the MP3 file to S3
            const fileContent = await fs.promises.readFile(filePath);

            const putObjectParams: PutObjectCommandInput = {
                Bucket: S3_BUCKET,
                Key: s3Key,
                Body: fileContent
            };

            logger.debug('Uploading file to S3', {
                requestId,
                user: req.user,
                bucket: S3_BUCKET,
                key: s3Key
            });

            await s3Client.send(new PutObjectCommand(putObjectParams));
            logger.info('File uploaded to S3 successfully', {
                requestId,
                user: req.user,
                bucket: S3_BUCKET,
                key: s3Key
            });

            // Start the transcription job
            const transcriptionParams: StartTranscriptionJobCommandInput = {
                TranscriptionJobName: `transcription-job-${uniqueId}`,
                Media: {
                    MediaFileUri: `s3://${S3_BUCKET}/${s3Key}`
                },
                MediaFormat: 'mp3',
                LanguageCode: 'en-US',
                OutputBucketName: S3_BUCKET,
                Subtitles: {
                    Formats: ['vtt'],
                    OutputStartIndex: 1
                },
                OutputKey: `transcriptions/${uniqueId}`,
                Settings: {
                    ShowSpeakerLabels: false,
                    ShowAlternatives: false
                }
            };

            logger.debug('Starting transcription job', {
                requestId,
                user: req.user,
                jobName: transcriptionParams.TranscriptionJobName
            });

            await transcribeClient.send(new StartTranscriptionJobCommand(transcriptionParams));
            logger.info('Transcription job started successfully', {
                requestId,
                user: req.user,
                jobName: transcriptionParams.TranscriptionJobName,
                uniqueId
            });

            cleanupFile(filePath);
            const processingTime = Date.now() - startTime;
            logger.info('Transcription request completed successfully', {
                requestId,
                user: req.user,
                processingTimeMs: processingTime,
                uniqueId
            });

            await trackEvent("transcription_created", {
                user: req.user,
                requestId,
                processingTimeMs: processingTime,
                uniqueId
            });

            res.json({ unique_id: uniqueId });
        } catch (error) {
            cleanupFile(filePath);

            // Add tracking for failures
            await trackEvent("transcription_failed", {
                user: req.user,
                requestId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // Handle known error cases with appropriate status codes
            if (error instanceof Error) {
                if (error.message.includes('duration exceeds')) {
                    logger.warn('File duration too long', {
                        requestId,
                        user: req.user,
                        error: error.message
                    });
                    res.status(400).json({ error: error.message });
                    return;
                }
                if (error.message.includes('Could not determine audio file duration')) {
                    logger.warn('Could not process audio file', {
                        requestId,
                        user: req.user,
                        error: error.message
                    });
                    res.status(400).json({ error: error.message });
                    return;
                }
            }

            // Pass unknown errors to the global error handler
            next(error);
        }
    });

// Get transcription status route
app.get('/transcriptions/:id',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
        const requestId = req.headers['x-request-id'];
        const uniqueId = req.params.id;
        const s3Key = `transcriptions/${uniqueId}.vtt`;

        await trackEvent("transcription_requested", {
            user: req.user,
            requestId,
            uniqueId
        });

        logger.debug('Checking transcription status', {
            requestId,
            user: req.user,
            uniqueId
        });

        try {
            // Check if the transcription file exists in S3
            const headObjectParams: HeadObjectCommandInput = {
                Bucket: S3_BUCKET,
                Key: s3Key
            };

            await s3Client.send(new HeadObjectCommand(headObjectParams));
            logger.debug('Transcription file found in S3', {
                requestId,
                user: req.user,
                bucket: S3_BUCKET,
                key: s3Key
            });

            // If it exists, return the S3 URL
            const s3Url = `https://${S3_BUCKET}.s3.amazonaws.com/${s3Key}`;
            logger.info('Transcription status request completed', {
                requestId,
                user: req.user,
                uniqueId,
                status: 'completed'
            });
            await trackEvent("transcription_completed", {
                user: req.user,
                requestId,
                uniqueId
            });

            res.json({ s3_url: s3Url });
        } catch (error) {
            logger.debug('Transcription file not found', {
                requestId,
                user: req.user,
                error: error instanceof Error ? error.message : 'Unknown error',
                uniqueId
            });

            await trackEvent("transcription_not_ready", {
                user: req.user,
                requestId,
                uniqueId
            });

            res.status(420).json({ error: 'Transcription not found' });
        }
    });

app.post("/test-error", () => {
    throw new Error("Test error");
});

if (process.env.SENTRY_DSN) {
    console.log("Setting up Sentry");
    Sentry.setupExpressErrorHandler(app);
}

// Error handler middleware (must be last)
app.use(errorHandler);

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});