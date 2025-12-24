const { getShareInfo } = require('./_lib/terabox');
const { sendSuccess, sendError, handleCors, validateParams } = require('./_lib/utils');

module.exports = async (req, res) => {
    // Handle CORS
    if (handleCors(req, res)) return;
    
    try {
        const { url } = req.query;
        
        // Validate
        const error = validateParams(req.query, ['url']);
        if (error) {
            return sendError(res, error, 400);
        }
        
        const result = await getShareInfo(url);
        sendSuccess(res, result);
        
    } catch (error) {
        console.error('Info Error:', error.message);
        sendError(res, error.message);
    }
};
