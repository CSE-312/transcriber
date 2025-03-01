import winston, { Logger } from 'winston';
const { combine, timestamp, printf, colorize } = winston.format;

// Custom log format with better metadata formatting
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    if (Object.keys(metadata).length > 0) {
        // Pretty print the metadata with 2 space indentation
        const prettyMetadata = JSON.stringify(metadata, null, 2);
        msg += `\n${prettyMetadata}`;
    }

    return msg;
});

// Create the logger instance
const logger: Logger = winston.createLogger({
    // Always include all log levels
    level: 'debug',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        colorize({ all: true }),
        logFormat
    ),
    transports: [
        // Console transport with all levels
        new winston.transports.Console({
            level: 'debug'
        }),
        // Error log file with only error level
        new winston.transports.File({
            filename: 'error.log',
            level: 'error',
            format: combine(
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                logFormat
            )
        }),
        // Combined log file with all levels
        new winston.transports.File({
            filename: 'combined.log',
            level: 'debug',
            format: combine(
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                logFormat
            )
        })
    ]
});

export default logger; 