const axios = require('axios');

module.exports = async (req, res) => {
    const testUrl = 'https://1024terabox.com/s/1n9h8b63n7v6SxCaFMfOm2Q';
    const cookie = process.env.TERABOX_COOKIE || '';
    
    // Extract surl
    const match = testUrl.match(/\/s\/1?([a-zA-Z0-9_-]+)/);
    const surl = match ? match[1] : 'not found';
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.1024terabox.com/',
        'Origin': 'https://www.1024terabox.com',
        'Cookie': cookie
    };

    try {
        // Test API call
        const response = await axios.get('https://www.1024terabox.com/api/shorturlinfo', {
            params: {
                shorturl: surl,
                root: 1
            },
            headers: headers,
            timeout: 15000
        });

        res.json({
            success: true,
            surl: surl,
            cookieFirst50: cookie.substring(0, 50),
            apiResponse: response.data
        });

    } catch (error) {
        res.json({
            success: false,
            surl: surl,
            cookieFirst50: cookie.substring(0, 50),
            error: error.message,
            responseData: error.response?.data || null
        });
    }
};
