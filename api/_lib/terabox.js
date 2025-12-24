const axios = require('axios');

const BASE_URL = 'https://www.1024terabox.com';

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.terabox.com/',
    'Origin': 'https://www.terabox.com',
    'Connection': 'keep-alive',
    'Cookie': process.env.TERABOX_COOKIE || ''
};

/**
 * Extract share code from TeraBox URL
 */
function extractShareCode(url) {
    if (!url) throw new Error('URL is required');
    
    const patterns = [
        /terabox\.com\/s\/([a-zA-Z0-9_-]+)/,
        /teraboxapp\.com\/s\/([a-zA-Z0-9_-]+)/,
        /1024tera\.com\/s\/([a-zA-Z0-9_-]+)/,
        /terabox\.com\/wap\/share\/filelist\?surl=([a-zA-Z0-9_-]+)/,
        /freeterabox\.com\/s\/([a-zA-Z0-9_-]+)/,
        /terabox\.fun\/s\/([a-zA-Z0-9_-]+)/,
        /surl=([a-zA-Z0-9_-]+)/,
        /\/s\/1([a-zA-Z0-9_-]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            let code = match[1];
            // Remove leading '1' if present (some URLs have it)
            if (code.startsWith('1') && code.length > 20) {
                code = code.substring(1);
            }
            return code;
        }
    }
    
    // If it's just the code
    if (/^[a-zA-Z0-9_-]+$/.test(url)) {
        return url;
    }
    
    throw new Error('Invalid TeraBox URL format');
}

/**
 * Format file size
 */
function formatSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Get share info from short URL
 */
async function getShareInfo(shareUrl) {
    const surl = extractShareCode(shareUrl);
    
    const response = await axios.get(`${BASE_URL}/api/shorturlinfo`, {
        params: {
            shorturl: surl,
            root: 1
        },
        headers: DEFAULT_HEADERS
    });

    const data = response.data;
    
    if (data.errno !== 0) {
        throw new Error(data.errmsg || `API Error: ${data.errno}`);
    }

    return {
        shareid: data.shareid,
        uk: data.uk,
        sign: data.sign,
        timestamp: data.timestamp,
        surl: surl,
        title: data.title,
        description: data.description
    };
}

/**
 * Get file list from shared folder
 */
async function getFileList(shareUrl, path = '/', page = 1, limit = 100) {
    const shareInfo = await getShareInfo(shareUrl);
    
    const response = await axios.get(`${BASE_URL}/share/list`, {
        params: {
            shorturl: shareInfo.surl,
            dir: path,
            root: path === '/' ? 1 : 0,
            page: page,
            num: limit,
            order: 'time',
            desc: 1
        },
        headers: DEFAULT_HEADERS
    });

    const data = response.data;
    
    if (data.errno !== 0) {
        throw new Error(data.errmsg || `API Error: ${data.errno}`);
    }

    const files = (data.list || []).map(file => ({
        fs_id: file.fs_id?.toString(),
        filename: file.server_filename,
        path: file.path,
        size: file.size,
        sizeFormatted: formatSize(file.size),
        isDir: file.isdir === 1,
        category: file.category,
        md5: file.md5,
        thumbs: file.thumbs,
        dlink: file.dlink,
        createdAt: file.server_ctime ? new Date(file.server_ctime * 1000).toISOString() : null,
        modifiedAt: file.server_mtime ? new Date(file.server_mtime * 1000).toISOString() : null
    }));

    return {
        files,
        shareInfo,
        hasMore: files.length === limit,
        total: data.total || files.length
    };
}

/**
 * Get download link for a file
 */
async function getDownloadLink(shareUrl, fsId) {
    const shareInfo = await getShareInfo(shareUrl);
    
    // Method 1: Try share/download endpoint
    try {
        const response = await axios.get(`${BASE_URL}/share/download`, {
            params: {
                shareid: shareInfo.shareid,
                uk: shareInfo.uk,
                sign: shareInfo.sign,
                timestamp: shareInfo.timestamp,
                fid_list: JSON.stringify([fsId]),
                primaryid: shareInfo.shareid,
                product: 'share',
                nozip: 0
            },
            headers: DEFAULT_HEADERS
        });

        if (response.data.errno === 0 && response.data.dlink) {
            return {
                downloadUrl: response.data.dlink,
                filename: response.data.filename || 'download',
                size: response.data.size || 0
            };
        }
    } catch (e) {
        // Continue to next method
    }

    // Method 2: Get from file list
    const fileList = await getFileList(shareUrl);
    const file = fileList.files.find(f => f.fs_id === fsId.toString());
    
    if (!file) {
        throw new Error('File not found');
    }

    if (file.dlink) {
        return {
            downloadUrl: file.dlink,
            filename: file.filename,
            size: file.size
        };
    }

    // Method 3: Try filemetas endpoint
    const metaResponse = await axios.get(`${BASE_URL}/api/filemetas`, {
        params: {
            dlink: 1,
            target: JSON.stringify([file.path]),
            shorturl: shareInfo.surl,
            shareid: shareInfo.shareid,
            uk: shareInfo.uk
        },
        headers: DEFAULT_HEADERS
    });

    if (metaResponse.data.errno === 0 && metaResponse.data.info?.[0]?.dlink) {
        return {
            downloadUrl: metaResponse.data.info[0].dlink,
            filename: file.filename,
            size: file.size
        };
    }

    throw new Error('Could not retrieve download link');
}

/**
 * Get direct/resolved download link
 */
async function getDirectLink(shareUrl, fsId) {
    const { downloadUrl, filename, size } = await getDownloadLink(shareUrl, fsId);
    
    // Follow redirects to get final URL
    const response = await axios.head(downloadUrl, {
        headers: {
            ...DEFAULT_HEADERS,
            'Range': 'bytes=0-1'
        },
        maxRedirects: 10,
        validateStatus: (status) => status < 400
    });

    const finalUrl = response.request?.res?.responseUrl || 
                     response.request?._redirectable?._currentUrl ||
                     downloadUrl;

    return {
        directUrl: finalUrl,
        downloadUrl: downloadUrl,
        filename,
        size,
        sizeFormatted: formatSize(size),
        contentType: response.headers['content-type']
    };
}

/**
 * Stream file with range support
 */
async function streamFile(shareUrl, fsId, rangeHeader = null) {
    const { downloadUrl, filename, size } = await getDownloadLink(shareUrl, fsId);
    
    const headers = { ...DEFAULT_HEADERS };
    
    if (rangeHeader) {
        headers['Range'] = rangeHeader;
    }

    const response = await axios.get(downloadUrl, {
        headers,
        responseType: 'stream',
        maxRedirects: 10,
        validateStatus: (status) => status < 400
    });

    return {
        stream: response.data,
        statusCode: response.status,
        headers: {
            'Content-Type': response.headers['content-type'] || 'application/octet-stream',
            'Content-Length': response.headers['content-length'],
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            'Accept-Ranges': 'bytes',
            'Content-Range': response.headers['content-range'],
            'Cache-Control': 'public, max-age=3600'
        }
    };
}

module.exports = {
    extractShareCode,
    formatSize,
    getShareInfo,
    getFileList,
    getDownloadLink,
    getDirectLink,
    streamFile,
    DEFAULT_HEADERS
};
