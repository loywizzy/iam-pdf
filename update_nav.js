const fs = require('fs');
const path = require('path');

const directoryPath = __dirname;

const files = fs.readdirSync(directoryPath).filter(file => file.endsWith('.html'));

files.forEach(file => {
    let content = fs.readFileSync(path.join(directoryPath, file), 'utf8');

    // Determine which file is active
    const isIndex = file === 'index.html';
    const isPdfToJpg = file === 'pdf-to-jpg.html';
    const isJpgToPdf = file === 'jpg-to-pdf.html';
    const isMergePdf = file === 'merge-pdf.html';
    const isSplitPdf = file === 'split-pdf.html';
    const isOrganizePdf = file === 'organize-pdf.html';
    const isWatermarkPdf = file === 'watermark-pdf.html';
    const isCompressPdf = file === 'compress-pdf.html';

    const newNav = `            <nav>
                <ul class="nav-list">
                    <li><a href="/" ${isIndex ? 'class="active"' : ''}>หน้าแรก</a></li>
                    <li class="dropdown">
                        <button class="nav-link ${(!isIndex) ? 'active' : ''}" aria-haspopup="true" aria-expanded="false">
                            เครื่องมือ PDF
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-left:2px;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                        <ul class="dropdown-menu">
                            <li><a href="pdf-to-jpg.html" ${isPdfToJpg ? 'class="active"' : ''}>PDF to JPG</a></li>
                            <li><a href="jpg-to-pdf.html" ${isJpgToPdf ? 'class="active"' : ''}>JPG to PDF</a></li>
                            <li><a href="merge-pdf.html" ${isMergePdf ? 'class="active"' : ''}>รวม PDF</a></li>
                            <li><a href="split-pdf.html" ${isSplitPdf ? 'class="active"' : ''}>แยก PDF</a></li>
                            <li><a href="organize-pdf.html" ${isOrganizePdf ? 'class="active"' : ''}>จัดการหน้า</a></li>
                            <li><a href="watermark-pdf.html" ${isWatermarkPdf ? 'class="active"' : ''}>ใส่ลายน้ำ</a></li>
                            <li><a href="compress-pdf.html" ${isCompressPdf ? 'class="active"' : ''}>บีบอัด PDF</a></li>
                        </ul>
                    </li>
                </ul>
            </nav>`;

    const newMobileNav = `        <div class="mobile-nav" id="mobile-nav">
            <a href="/" ${isIndex ? 'class="active"' : ''}>หน้าแรก</a>
            <a href="pdf-to-jpg.html" ${isPdfToJpg ? 'class="active"' : ''}>PDF to JPG</a>
            <a href="jpg-to-pdf.html" ${isJpgToPdf ? 'class="active"' : ''}>JPG to PDF</a>
            <a href="merge-pdf.html" ${isMergePdf ? 'class="active"' : ''}>รวม PDF</a>
            <a href="split-pdf.html" ${isSplitPdf ? 'class="active"' : ''}>แยก PDF</a>
            <a href="organize-pdf.html" ${isOrganizePdf ? 'class="active"' : ''}>จัดการหน้า</a>
            <a href="watermark-pdf.html" ${isWatermarkPdf ? 'class="active"' : ''}>ใส่ลายน้ำ</a>
            <a href="compress-pdf.html" ${isCompressPdf ? 'class="active"' : ''}>บีบอัด PDF</a>
        </div>`;

    // Replace desktop nav
    content = content.replace(/<nav>[\s\S]*?<\/nav>/, newNav);

    // Replace mobile nav
    content = content.replace(/<div class="mobile-nav" id="mobile-nav">[\s\S]*?<\/div>/, newMobileNav);

    fs.writeFileSync(path.join(directoryPath, file), content, 'utf8');
    console.log(`Updated ${file}`);
});
