# Transcriber TS

A TypeScript implementation of an audio transcription service using AWS Transcribe.

## Features

- Upload MP3 audio files for transcription
- Limit file duration to 1 minute
- Authentication using API token
- AWS S3 for file storage
- AWS Transcribe for audio-to-text conversion

## Prerequisites

- Node.js or Bun runtime
- AWS account with S3 and Transcribe permissions
- ffmpeg installed on your system (for audio duration checking)

## Installation

To install dependencies:

```bash
bun install
```

## Configuration

1. Copy the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

2. Edit the `.env` file with your AWS credentials:

```
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
```

## Running the Application

```bash
bun run src/index.ts
```

The server will start on port 5000.

## API Endpoints

### Transcribe Audio

```
POST /transcribe
```

**Headers:**

- Authorization: Bearer sk_transcribe_312_f8a92j3012fadsi321

**Body:**

- Form data with a file field containing an MP3 file (max 1 minute duration)

**Response:**

```json
{
  "unique_id": "generated-uuid"
}
```

### Get Transcription

```
GET /transcriptions/:id
```

**Headers:**

- Authorization: Bearer sk_transcribe_312_f8a92j3012fadsi321

**Response:**

```json
{
  "s3_url": "https://312-transcriptions.s3.amazonaws.com/transcriptions/your-id.srt"
}
```

## License

This project was created using `bun init` in bun v1.2.0. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
