const axios = require('axios');

const BASE_URL = 'https://www.1024terabox.com';

function getHeaders() {
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': BASE_URL + '/',
        'Origin': BASE_URL,
        'Cookie': process.env.TERABOX_COOKIE || ''
    };
}

/**
 * Extract share code from TeraBox URL - FIXED VERSION
 */
function extractShareCode(url) {
    if (!url) throw new Error('URL is required');
    
    // Pattern to match share code (keep the full code including leading 1)
    const patterns = [
        /\/s\/(1[a-zA-Z0-9_-]+)/i,
        /surl=(1[a-zA-Z0-9_-]+)/i,
        /\/s\/([a-zA-Z0-9_-]+)/i,
        /surl=([a-zA-Z0-9_-]+)/i,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return match[1];
        }
    }
    
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
 * Get share info
 */
async function getShareInfo(shareUrl) {
    const surl = extractShareCode(shareUrl);
    
    const response = await axios.get(`${BASE_URL}/api/shorturlinfo`, {
        params: {
            shorturl: surl,
            root: 1
        },
        headers: getHeaders(),
        timeout: 15000
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
        title: data.title
    };
}

/**
 * Get file list
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
        headers: getHeaders(),
        timeout: 15000
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
 * Get download link
 */
async function getDownloadLink(shareUrl, fsId) {
    const shareInfo = await getShareInfo(shareUrl);
    
    // Method 1: Download endpoint
    try {
        const response = await axios.get(`${BASE_URL}/share/download`, {
            params: {
                shareid: shareInfo.shareid,
                uk: shareInfo.uk,
                sign: shareInfo.sign,
                timestamp: shareInfo.timestamp,
                fid_list: JSON.stringify([Number(fsId)]),
                primaryid: shareInfo.shareid,
                product: 'share',
                nozip: 0
            },
            headers: getHeaders(),
            timeout: 15000
        });

        if (response.data.errno === 0 && response.data.dlink) {
            return {
                downloadUrl: response.data.dlink,
                filename: response.data.filename || 'download',
                size: response.data.size || 0,
                sizeFormatted: formatSize(response.data.size || 0)
            };
        }
    } catch (e) {
        // Continue
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
            size: file.size,
            sizeFormatted: file.sizeFormatted
        };
    }

    // Method 3: Filemetas
    try {
        const metaResponse = await axios.get(`${BASE_URL}/api/filemetas`, {
            params: {
                dlink: 1,
                target: JSON.stringify([file.path]),
                shorturl: shareInfo.surl,
                shareid: shareInfo.shareid,
                uk: shareInfo.uk
            },
            headers: getHeaders(),
            timeout: 15000
        });

        if (metaResponse.data.errno === 0 && metaResponse.data.info?.[0]?.dlink) {
            return {
                downloadUrl: metaResponse.data.info[0].dlink,
                filename: file.filename,
                size: file.size,
                sizeFormatted: file.sizeFormatted
            };
        }
    } catch (e) {
        // Continue
    }

    throw new Error('Could not get download link');
}

/**
 * Get direct link
 */
async function getDirectLink(shareUrl, fsId) {
    const result = await getDownloadLink(shareUrl, fsId);
    
    try {
        const response = await axios.head(result.downloadUrl, {
            headers: {
                ...getHeaders(),
                'Range': 'bytes=0-1'
            },
            maxRedirects: 10,
            validateStatus: (status) => status < 400,
            timeout: 15000
        });

        const finalUrl = response.request?.res?.responseUrl || 
                         response.request?._redirectable?._currentUrl ||
                         result.downloadUrl;

        return {
            directUrl: finalUrl,
            downloadUrl: result.downloadUrl,
            filename: result.filename,
            size: result.size,
            sizeFormatted: result.sizeFormatted,
            contentType: response.headers['content-type']
        };
    } catch (e) {
        return { directUrl: result.downloadUrl, ...result };
    }
}

/**
 * Stream file
 */
async function streamFile(shareUrl, fsId, rangeHeader = null) {
    const result = await getDownloadLink(shareUrl, fsId);
    
    const headers = getHeaders();
    if (rangeHeader) headers['Range'] = rangeHeader;

    const response = await axios.get(result.downloadUrl, {
        headers,
        responseType: 'stream',
        maxRedirects: 10,
        validateStatus: (status) => status < 400,
        timeout: 30000
    });

    return {
        stream: response.data,
        statusCode: response.status,
        headers: {
            'Content-Type': response.headers['content-type'] || 'application/octet-stream',
            'Content-Length': response.headers['content-length'],
            'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename)}"`,
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
    getHeaders
};
