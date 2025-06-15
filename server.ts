import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import useragent from 'useragent';

// import musixmatch from './search_engine/musixmatch/router';
import genius from './search_engine/genius/router';
// import youtube from './search_engine/youtube/router';
import log from "./utils/logger";



const app = express();
const PORT = process.env.PORT || 3000;

function logDetails(req: Request, res: Response, next: NextFunction) {
    const currentTime = new Date().toISOString();
    const agent = useragent.parse(req.headers['user-agent']);
    const browserDetails = `${agent.toAgent()} on ${agent.os}`;
    const ipAddress = req.ip;

    const realIP = req.headers['x-forwarded-for'] || req.ip;
    const origin = req.headers.origin || 'Direct/No Origin';
    const referer = req.headers.referer || 'Direct/No Referer';

    log.success(`[${currentTime}] Request: ${req.method} ${req.originalUrl}`);
    // log.warn(`[${currentTime}] User-Agent: ${browserDetails} | IP: ${ipAddress}`);
    log.warn(`[${currentTime}] User-Agent: ${browserDetails}`);
    log.info(`[${currentTime}] IP: ${ipAddress} | Real IP: ${realIP}`);
    log.info(`[${currentTime}] Origin: ${origin} | Referer: ${referer}`);
    next();
}

app.use(logDetails);
// app.use(musixmatch);
app.use(genius);
// app.use(youtube);

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'documentation', 'index.html'));
});

export const startServer = () => {
    app.listen(PORT, () => {
        log.info(`Lyrics API Server is now running on port: ${PORT}`);
    });
};
