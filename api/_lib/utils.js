/**
 * Send JSON response
 */
function sendJson(res, statusCode, data) {
    res.status(statusCode).json(data);
}

/**
 * Send success response
 */
function sendSuccess(res, data, statusCode = 200) {
    sendJson(res, statusCode, {
        success: true,
        data,
        timestamp: new Date().toISOString()
    });
}

/**
 * Send error response
 */
function sendError(res, message, statusCode = 500) {
    sendJson(res, statusCode, {
        success: false,
        error: message,
        timestamp: new Date().toISOString()
    });
}

/**
 * Handle CORS preflight
 */
function handleCors(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Range');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true;
    }
    return false;
}

/**
 * Validate required parameters
 */
function validateParams(params, required) {
    const missing = required.filter(key => !params[key]);
    if (missing.length > 0) {
        return `Missing required parameters: ${missing.join(', ')}`;
    }
    return null;
}

module.exports = {
    sendJson,
    sendSuccess,
    sendError,
    handleCors,
    validateParams
};
