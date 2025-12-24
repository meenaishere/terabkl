module.exports = (req, res) => {
    res.json({
        name: 'TeraBox API',
        version: '1.0.0',
        endpoints: {
            'GET /api/info': {
                description: 'Get share information',
                params: { url: 'TeraBox share URL (required)' }
            },
            'GET /api/list': {
                description: 'Get file list from shared folder',
                params: {
                    url: 'TeraBox share URL (required)',
                    path: 'Folder path (default: /)',
                    page: 'Page number (default: 1)',
                    limit: 'Items per page (default: 100)'
                }
            },
            'GET /api/download': {
                description: 'Get download link',
                params: {
                    url: 'TeraBox share URL (required)',
                    fs_id: 'File system ID (required)'
                }
            },
            'GET /api/direct': {
                description: 'Get resolved direct download link',
                params: {
                    url: 'TeraBox share URL (required)',
                    fs_id: 'File system ID (required)'
                }
            },
            'GET /api/stream': {
                description: 'Stream file (proxy download)',
                params: {
                    url: 'TeraBox share URL (required)',
                    fs_id: 'File system ID (required)'
                },
                headers: { Range: 'Supports range requests for video seeking' }
            },
            'GET /api/redirect': {
                description: 'Redirect to download URL',
                params: {
                    url: 'TeraBox share URL (required)',
                    fs_id: 'File system ID (required)'
                }
            }
        },
        example: {
            getList: '/api/list?url=https://terabox.com/s/1xxxxx',
            getDownload: '/api/download?url=https://terabox.com/s/1xxxxx&fs_id=123456'
        }
    });
};
