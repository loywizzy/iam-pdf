const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.xml': 'application/xml; charset=utf-8'
};

const server = http.createServer((req, res) => {
    // Parse URL and clean query strings
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/') reqUrl = '/index.html';

    // Support clean URLs (e.g. /edit-pdf -> /edit-pdf.html)
    let filePath = path.join(__dirname, reqUrl);
    if (!path.extname(filePath) && fs.existsSync(filePath + '.html')) {
        filePath += '.html';
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 Not Found</h1><p>ไม่พบหน้าที่ต้องการ</p>');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`<h1>500 Server Error</h1><p>${err.code}</p>`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 i-am pdf Local Server กำลังทำงานที่:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`👉 http://localhost:${PORT}/edit-pdf`);
    console.log(`========================================\n`);
    console.log(`กด Ctrl + C เพื่อหยุดการทำงาน`);
});
