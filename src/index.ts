import express, { type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import fs from "fs";
import {
    S3Client,
    PutObjectCommand,
    HeadObjectCommand
} from "@aws-sdk/client-s3";
import {
    TranscribeClient,
    StartTranscriptionJobCommand
} from "@aws-sdk/client-transcribe";
import { requireAuth } from "./utils/auth";
import { upload, checkDuration, cleanupFile } from "./utils/fileHandler";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(express.json());

// AWS Configuration
const S3_BUCKET = '312-transcriptions';
const AWS_REGION = 'us-east-1';

// Initialize AWS clients
const s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
});

const transcribeClient = new TranscribeClient({
    region: AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
});

// Transcribe route
app.post("/transcribe",
    requireAuth,
    upload.single('file'),
    async (req: Request, res: Response) => {
        if (!req.file) {
            res.status(400).json({ error: 'No file part' });
            return;
        }

        const filePath = req.file.path;

        // Check file duration
        const isValidDuration = await checkDuration(filePath);
        if (!isValidDuration) {
            cleanupFile(filePath);
            res.status(400).json({ error: 'Failed to get duration, either longer than 1 min or ffmpeg not working.' });
            return;
        }

        const uniqueId = uuidv4();
        const s3Key = `transcriptions/${uniqueId}.mp3`;

        try {
            // Upload the MP3 file to S3
            const fileContent = await fs.promises.readFile(filePath);

            await s3Client.send(new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: s3Key,
                Body: fileContent
            }));

            // Start the transcription job
            await transcribeClient.send(new StartTranscriptionJobCommand({
                TranscriptionJobName: `transcription-job-${uniqueId}`,
                Media: {
                    MediaFileUri: `s3://${S3_BUCKET}/${s3Key}`
                },
                MediaFormat: 'mp3',
                LanguageCode: 'en-US',
                OutputBucketName: S3_BUCKET,
                Subtitles: {
                    Formats: ['srt'],
                    OutputStartIndex: 1
                },
                OutputKey: `transcriptions/${uniqueId}`,
                Settings: {
                    ShowSpeakerLabels: false,
                    ShowAlternatives: false
                }
            }));

            cleanupFile(filePath);
            res.json({ unique_id: uniqueId });
            return;
        } catch (error) {
            console.error('Error in transcription process:', error);
            cleanupFile(filePath);
            res.status(500).json({ error: 'Failed to process transcription' });
            return;
        }
    });

// Get transcription status route
app.get('/transcriptions/:id',
    requireAuth,
    async (req: Request, res: Response) => {
        const uniqueId = req.params.id;
        const s3Key = `transcriptions/${uniqueId}.srt`;

        try {
            // Check if the transcription file exists in S3
            await s3Client.send(new HeadObjectCommand({
                Bucket: S3_BUCKET,
                Key: s3Key
            }));

            // If it exists, return the S3 URL
            const s3Url = `https://${S3_BUCKET}.s3.amazonaws.com/${s3Key}`;
            res.json({ s3_url: s3Url });
            return;
        } catch (error) {
            res.status(420).json({ error: 'Transcription not found' });
            return;
        }
    });

// Start the server
app.listen(5000, () => {
    console.log("Server is running on port 5000");
});