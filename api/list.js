const { getFileList } = require('./_lib/terabox');
const { sendSuccess, sendError, handleCors, validateParams } = require('./_lib/utils');

module.exports = async (req, res) => {
    if (handleCors(req, res)) return;
    
    try {
        const { url, path = '/', page = '1', limit = '100' } = req.query;
        
        const error = validateParams(req.query, ['url']);
        if (error) {
            return sendError(res, error, 400);
        }
        
        const result = await getFileList(
            url, 
            path, 
            parseInt(page), 
            parseInt(limit)
        );
        
        sendSuccess(res, result);
        
    } catch (error) {
        console.error('List Error:', error.message);
        sendError(res, error.message);
    }
};
