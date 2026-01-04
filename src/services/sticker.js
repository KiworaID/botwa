import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const createStickerFromMedia = async (mediaBuffer, pack, author) => {
    try {
        let finalBuffer = mediaBuffer;

        const tempInput = path.join(os.tmpdir(), `input_${Date.now()}.mp4`);
        const tempOutput = path.join(os.tmpdir(), `output_${Date.now()}.mp4`);

        fs.writeFileSync(tempInput, mediaBuffer);

        try {
            await new Promise((resolve, reject) => {
                ffmpeg(tempInput)
                    .outputOptions([
                        '-an',
                        '-vcodec libx264',
                        '-pix_fmt yuv420p',
                        '-crf 30',
                        '-preset fast',
                        '-vf scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=0x00000000',
                        '-fs 0.9M'
                    ])
                    .toFormat('mp4')
                    .on('end', resolve)
                    .on('error', (err) => {
                        console.log('FFMPEG info (maybe not a video):', err.message);
                        resolve();
                    })
                    .save(tempOutput);
            });

            if (fs.existsSync(tempOutput)) {
                finalBuffer = fs.readFileSync(tempOutput);
            }
        } catch (e) {
            console.error('FFMPEG processing error:', e);
        } finally {
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
            if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
        }

        const sticker = new Sticker(finalBuffer, {
            pack: pack || '',
            author: author || '',
            type: StickerTypes.FULL,
            quality: 50
        });
        
        return await sticker.toBuffer();
    } catch (error) {
        console.error('Sticker creation error:', error);
        throw error;
    }
};
