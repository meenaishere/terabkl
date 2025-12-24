const { getDownloadLink } = require('./_lib/terabox');
const { sendError, handleCors, validateParams } = require('./_lib/utils');

module.exports = async (req, res) => {
    if (handleCors(req, res)) return;
    
    try {
        const { url, fs_id } = req.query;
        
        const error = validateParams(req.query, ['url', 'fs_id']);
        if (error) {
            return sendError(res, error, 400);
        }
        
        const result = await getDownloadLink(url, fs_id);
        res.redirect(302, result.downloadUrl);
        
    } catch (error) {
        console.error('Redirect Error:', error.message);
        sendError(res, error.message);
    }
};
