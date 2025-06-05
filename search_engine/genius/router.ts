// search_engine/genius/router.ts
import express, { Request, Response, Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import Genius, { LyricsResponse, ErrorResponse } from './Genius';
import log from '../../utils/logger';

const genius = new Genius();
const router: Router = express.Router();

router.use(express.json());

// Type guard functions
function isLyricsResponse(response: any): response is LyricsResponse {
    return response && 'title' in response && 'artist' in response && 'slug' in response && 'lyrics' in response;
}

function isErrorResponse(response: any): response is ErrorResponse {
    return response && 'message' in response && 'response' in response;
}

// Helper function to sanitize filename
const sanitizeFilename = (filename: string): string => {
    return filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
};

// Helper function to check if file is less than 1 month old
const isFileRecent = async (filePath: string): Promise<boolean> => {
    try {
        const stats = await fs.stat(filePath);
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        return stats.birthtime > oneMonthAgo;
    } catch (error: unknown) {
        return false;
    }
};

// Helper function to ensure directory exists
const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
    try {
        await fs.access(dirPath);
    } catch (error: unknown) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (mkdirError: unknown) {
            const errorMsg = mkdirError instanceof Error ? mkdirError.message : JSON.stringify(mkdirError);
            log.error(`Failed to create directory ${dirPath}: ${errorMsg}`);
            throw mkdirError;
        }
    }
};

// Helper function to read cached lyrics
const readCachedLyrics = async (filePath: string): Promise<LyricsResponse> => {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(data);

        if (!isLyricsResponse(parsed)) {
            throw new Error('Invalid cached lyrics format');
        }

        return parsed;
    } catch (error: unknown) {
        throw new Error(`Failed to read cached lyrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

// Helper function to save lyrics to cache
const saveLyricsToCache = async (filePath: string, lyrics: LyricsResponse): Promise<void> => {
    try {
        const dirPath = path.dirname(filePath);
        await ensureDirectoryExists(dirPath);
        await fs.access(dirPath, fs.constants.W_OK);
        await fs.writeFile(filePath, JSON.stringify(lyrics, null, 2), 'utf-8');
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
        log.error(`Failed to save lyrics to cache: ${errorMsg}`);
        throw error;
    }
};

router.get('/genius', async (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

router.get('/genius/lyrics', async (req: Request, res: Response) => {
    const title = req.query.title as string | undefined;
    const artist = req.query.artist as string | undefined;
    const slug = req.query.slug as string | undefined;

    if (!(title && artist && slug)) {
        return res.status(400).send({
            message: "These parameters are required: ['title', 'artist', 'slug']",
            response: '400 Bad Request',
        });
    }

    try {
        // Create cache file path
        const sanitizedTitle = sanitizeFilename(title);
        const sanitizedArtist = sanitizeFilename(artist);
        const fileName = `${sanitizedTitle}_${sanitizedArtist}.json`; // Changed to .json
        const cacheDir = path.join(process.cwd(), 'genius_store');
        const filePath = path.join(cacheDir, fileName);

        // Check if cached file exists and is recent
        if (await isFileRecent(filePath)) {
            try {
                const cachedLyrics = await readCachedLyrics(filePath);
                log.info(`Using cached lyrics from '${filePath}'.`);
                return res.send(cachedLyrics);
            } catch (readError: unknown) {
                const errorMsg = readError instanceof Error ? readError.message : JSON.stringify(readError);
                log.warn(`Failed to read cached lyrics, fetching new: ${errorMsg}`);
            }
        }

        // Fetch new lyrics
        log.info(`No cache exists. Fetching data for title='${title}', artist='${artist}' and save to cache.`);

        const result = await genius.getLyrics(title, artist, slug);

        // Handle result based on type
        if (isLyricsResponse(result)) {
            // Successfully got lyrics - cache them
            try {
                await saveLyricsToCache(filePath, result);
                log.info(`Successfully cached lyrics for ${title} by ${artist}`);
            } catch (cacheSaveError: unknown) {
                const errorMsg = cacheSaveError instanceof Error ? cacheSaveError.message : JSON.stringify(cacheSaveError);
                log.error(`Failed to cache lyrics: ${errorMsg}`);
                // Don't throw - we still want to return the lyrics even if caching fails
            }
        } else if (isErrorResponse(result)) {
            log.error(`Unable to fetch lyrics for ${title} by ${artist}: ${result.message}`);
        } else {
            log.error(`Unexpected response format for ${title} by ${artist}`);
        }

        res.send(result);

    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
        const stackTrace = error instanceof Error ? error.stack : 'No stack trace';

        log.error(`Error in /genius/lyrics route: ${errorMsg}`);
        log.error(`Stack: ${stackTrace}`);

        res.status(500).send({
            message: 'An error has occurred while fetching lyrics.',
            response: `500 Internal Server Error. Error: ${errorMsg}`,
        });
    }
});

export default router;