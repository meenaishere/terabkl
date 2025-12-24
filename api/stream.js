const { streamFile } = require('./_lib/terabox');
const { sendError, handleCors, validateParams } = require('./_lib/utils');

module.exports = async (req, res) => {
    if (handleCors(req, res)) return;
    
    try {
        const { url, fs_id } = req.query;
        
        const error = validateParams(req.query, ['url', 'fs_id']);
        if (error) {
            return sendError(res, error, 400);
        }
        
        const rangeHeader = req.headers.range;
        const { stream, statusCode, headers } = await streamFile(url, fs_id, rangeHeader);
        
        // Set response headers
        Object.entries(headers).forEach(([key, value]) => {
            if (value) res.setHeader(key, value);
        });
        
        res.status(statusCode);
        
        // Pipe stream to response
        stream.pipe(res);
        
        // Handle errors
        stream.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent) {
                sendError(res, 'Stream error');
            }
        });
        
    } catch (error) {
        console.error('Stream Error:', error.message);
        if (!res.headersSent) {
            sendError(res, error.message);
        }
    }
};
