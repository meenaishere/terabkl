module.exports = (req, res) => {
    const cookie = process.env.TERABOX_COOKIE || 'NOT SET';
    
    res.json({
        hasCookie: cookie !== 'NOT SET',
        cookieLength: cookie.length,
        startsWithNdus: cookie.startsWith('ndus='),
        first50Chars: cookie.substring(0, 50) + '...'
    });
};
