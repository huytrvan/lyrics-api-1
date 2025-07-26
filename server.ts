// server.ts
import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import useragent from 'useragent';

// import musixmatch from './search_engine/musixmatch/router';
import genius from './search_engine/genius/router';
// import youtube from './search_engine/youtube/router';
import log from "./utils/logger";
import { alertManager } from './utils/alerter';

const app = express();
const PORT = process.env.PORT || 3000;

function logDetails(req: Request, res: Response, next: NextFunction) {
    const currentTime = new Date().toISOString();
    const agent = useragent.parse(req.headers['user-agent']);
    const browserDetails = `${agent.toAgent()} on ${agent.os}`;
    const ipAddress = req.ip;

    log.success(`[${currentTime}] Request: ${req.method} ${req.originalUrl}`);
    log.warn(`[${currentTime}] User-Agent: ${browserDetails} | IP: ${ipAddress}`);
    next();
}

app.use(logDetails);
// app.use(musixmatch);
app.use(genius);
// app.use(youtube);

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'documentation', 'index.html'));
});

// Add crash detection handlers
process.on('uncaughtException', async (error) => {
    log.error(`Uncaught Exception: ${error.message}`);
    log.error(`Stack: ${error.stack}`);
    await alertManager.sendCrashAlert(error.message, 'Uncaught Exception');
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    const errorMsg = reason instanceof Error ? reason.message : String(reason);
    log.error(`Unhandled Rejection at: ${promise}, reason: ${errorMsg}`);
    await alertManager.sendCrashAlert(errorMsg, 'Unhandled Promise Rejection');
    process.exit(1);
});

process.on('SIGTERM', async () => {
    log.info('SIGTERM signal received - server shutting down gracefully');
    await alertManager.sendCrashAlert('Server received SIGTERM signal', 'Graceful shutdown initiated');
    process.exit(0);
});

process.on('SIGINT', async () => {
    log.info('SIGINT signal received - server shutting down gracefully');
    await alertManager.sendCrashAlert('Server received SIGINT signal', 'Manual shutdown');
    process.exit(0);
});

export const startServer = async () => {
    // Test email setup on server start
    log.info('Testing email configuration...');
    const emailWorking = await alertManager.testConnection();

    if (!emailWorking) {
        log.warn('Email alerts may not work properly - check your configuration');
    }

    const server = app.listen(PORT, () => {
        log.info(`Lyrics API Server is now running on port: ${PORT}`);
    });

    // Handle graceful shutdown
    const gracefulShutdown = async () => {
        log.info('Received shutdown signal, closing server...');
        server.close(() => {
            log.info('HTTP server closed');
            process.exit(0);
        });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    return server;
};