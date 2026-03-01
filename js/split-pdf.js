/**
 * i-am pdf - Split PDF
 * Client-side PDF splitting using pdf-lib and rendering thumbnails with pdf.js
 */

(function () {
    'use strict';

    // Check if we're on the right page
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    if (!uploadArea || !fileInput || !document.querySelector('h1')?.textContent.includes('แยก PDF')) {
        return;
    }

    // ========================================
    // Configuration
    // ========================================
    const CONFIG = {
        maxFileSize: 100 * 1024 * 1024, // 100MB per file
        thumbnailScale: 0.5 // Scale for rendering preview thumbnails
    };

    // ========================================
    // DOM Elements
    // ========================================
    const converterSection = document.getElementById('converter-section');
    const fileNameDisplay = document.getElementById('file-name-display');
    const splitModeSelect = document.getElementById('split-mode');
    const pageSelectionInput = document.getElementById('page-selection');
    const pageGrid = document.getElementById('page-grid');
    const splitBtn = document.getElementById('split-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const downloadSection = document.getElementById('download-section');
    const downloadBtn = document.getElementById('download-btn');
    const actionButtons = document.getElementById('action-buttons');

    // State
    let selectedFile = null;
    let selectedFileArrayBuffer = null;
    let totalPages = 0;
    let selectedPages = new Set();
    let resultBlob = null;
    let resultFileName = '';

    // ========================================
    // Event Listeners
    // ========================================

    uploadArea.addEventListener('click', function () {
        fileInput.click();
    });

    fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    // Drag and drop
    uploadArea.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function (e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    if (splitBtn) {
        splitBtn.addEventListener('click', function () {
            if (selectedPages.size > 0) {
                splitPdf();
            } else {
                alert('กรุณาเลือกอย่างน้อย 1 หน้า');
            }
        });
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', function () {
            if (resultBlob) {
                downloadResult();
            }
        });
    }

    pageSelectionInput.addEventListener('change', function() {
        parsePageSelection(this.value);
        updateThumbnailsState();
    });

    // ========================================
    // File Handling
    // ========================================

    async function handleFileSelect(file) {
        if (file.type !== 'application/pdf') {
            alert('กรุณาเลือกไฟล์ PDF');
            return;
        }

        if (file.size > CONFIG.maxFileSize) {
            alert('ไฟล์ ' + file.name + ' มีขนาดใหญ่เกินไป (สูงสุด 100MB)');
            return;
        }

        selectedFile = file;
        fileNameDisplay.textContent = 'ไฟล์: ' + file.name;

        // Reset state
        selectedPages.clear();
        pageSelectionInput.value = '';
        pageGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">กำลังโหลดหน้ากระดาษ...</div>';
        
        uploadArea.classList.add('hidden');
        converterSection.classList.remove('hidden');
        downloadSection.classList.add('hidden');
        actionButtons.classList.remove('hidden');

        try {
            selectedFileArrayBuffer = await file.arrayBuffer();
            
            // Render thumbnails using pdf.js
            await renderThumbnails(selectedFileArrayBuffer);
            
            // Default select all pages
            for (let i = 1; i <= totalPages; i++) {
                selectedPages.add(i);
            }
            updatePageSelectionInput();
            updateThumbnailsState();
            
        } catch (error) {
            console.error('Error reading PDF:', error);
            alert('ไม่สามารถอ่านไฟล์ ' + file.name + ' ได้');
            resetConverter();
        }
    }

    async function renderThumbnails(arrayBuffer) {
        if (typeof pdfjsLib === 'undefined') {
            alert('เกิดข้อผิดพลาด: ไม่สามารถโหลด PDF.js library ได้');
            return;
        }

        try {
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            totalPages = pdf.numPages;
            
            pageGrid.innerHTML = '';
            pageGrid.style.display = 'grid';
            pageGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
            pageGrid.style.gap = '15px';
            
            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: CONFIG.thumbnailScale });
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                
                const pageItem = document.createElement('div');
                pageItem.className = 'page-thumbnail';
                pageItem.style.cursor = 'pointer';
                pageItem.style.border = '2px solid transparent';
                pageItem.style.borderRadius = '4px';
                pageItem.style.padding = '5px';
                pageItem.style.textAlign = 'center';
                pageItem.style.transition = 'all 0.2s';
                pageItem.dataset.page = pageNum;
                
                const img = document.createElement('img');
                img.src = canvas.toDataURL('image/jpeg', 0.8);
                img.style.width = '100%';
                img.style.height = 'auto';
                img.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
                img.style.display = 'block';
                
                const label = document.createElement('div');
                label.textContent = 'หน้า ' + pageNum;
                label.style.marginTop = '8px';
                label.style.fontSize = '0.9rem';
                
                pageItem.appendChild(img);
                pageItem.appendChild(label);
                
                pageItem.addEventListener('click', function() {
                    togglePageSelection(pageNum);
                });
                
                pageGrid.appendChild(pageItem);
            }
        } catch (error) {
            console.error('Error rendering thumbnails:', error);
            pageGrid.innerHTML = '<div style="grid-column: 1 / -1; color: red;">เกิดข้อผิดพลาดในการโหลดหน้ากระดาษ</div>';
        }
    }

    function togglePageSelection(pageNum) {
        if (selectedPages.has(pageNum)) {
            selectedPages.delete(pageNum);
        } else {
            selectedPages.add(pageNum);
        }
        updatePageSelectionInput();
        updateThumbnailsState();
    }
    
    function updateThumbnailsState() {
        const thumbnails = pageGrid.querySelectorAll('.page-thumbnail');
        thumbnails.forEach(thumb => {
            const pageNum = parseInt(thumb.dataset.page);
            if (selectedPages.has(pageNum)) {
                thumb.style.borderColor = 'var(--primary-color)';
                thumb.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
            } else {
                thumb.style.borderColor = 'transparent';
                thumb.style.backgroundColor = 'transparent';
            }
        });
    }
    
    function updatePageSelectionInput() {
        const sortedPages = Array.from(selectedPages).sort((a, b) => a - b);
        let ranges = [];
        let i = 0;
        
        while (i < sortedPages.length) {
            let start = sortedPages[i];
            let end = start;
            while (i + 1 < sortedPages.length && sortedPages[i + 1] === end + 1) {
                end = sortedPages[i + 1];
                i++;
            }
            if (start === end) {
                ranges.push(start.toString());
            } else {
                ranges.push(start + '-' + end);
            }
            i++;
        }
        
        pageSelectionInput.value = ranges.join(', ');
    }
    
    function parsePageSelection(inputStr) {
        selectedPages.clear();
        if (!inputStr.trim()) return;
        
        const parts = inputStr.split(',');
        for (const part of parts) {
            const range = part.trim().split('-');
            if (range.length === 1) {
                const num = parseInt(range[0]);
                if (!isNaN(num) && num >= 1 && num <= totalPages) {
                    selectedPages.add(num);
                }
            } else if (range.length === 2) {
                const start = parseInt(range[0]);
                const end = parseInt(range[1]);
                if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= totalPages && start <= end) {
                    for (let i = start; i <= end; i++) {
                        selectedPages.add(i);
                    }
                }
            }
        }
    }

    function resetConverter() {
        selectedFile = null;
        selectedFileArrayBuffer = null;
        totalPages = 0;
        selectedPages.clear();
        resultBlob = null;
        fileInput.value = '';

        uploadArea.classList.remove('hidden');
        converterSection.classList.add('hidden');
        progressFill.style.width = '0%';
    }

    // ========================================
    // PDF Splitting
    // ========================================

    async function splitPdf() {
        if (typeof PDFLib === 'undefined') {
            alert('เกิดข้อผิดพลาด: ไม่สามารถโหลด PDF-lib library ได้');
            return;
        }

        try {
            actionButtons.classList.add('hidden');
            progressContainer.classList.remove('hidden');

            updateProgress(10, 'กำลังโหลดไฟล์ PDF...');

            // Read the file again to get a fresh ArrayBuffer
            const freshArrayBuffer = await selectedFile.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.load(freshArrayBuffer);
            const mode = splitModeSelect.value;
            
            const sortedPagesToExtract = Array.from(selectedPages).sort((a, b) => a - b);
            // pdf-lib uses 0-based indexing
            const indicesToExtract = sortedPagesToExtract.map(p => p - 1);

            if (mode === 'extract') {
                updateProgress(50, 'กำลังแยกหน้า PDF...');
                
                const newPdf = await PDFLib.PDFDocument.create();
                const copiedPages = await newPdf.copyPages(pdfDoc, indicesToExtract);
                
                copiedPages.forEach((page) => {
                    newPdf.addPage(page);
                });
                
                updateProgress(80, 'กำลังบันทึกไฟล์ PDF...');
                const pdfBytes = await newPdf.save();
                resultBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                resultFileName = selectedFile.name.replace('.pdf', '') + '_extracted.pdf';
                
            } else if (mode === 'individual') {
                if (typeof JSZip === 'undefined') {
                    alert('เกิดข้อผิดพลาด: ไม่สามารถโหลด JSZip library ได้');
                    actionButtons.classList.remove('hidden');
                    progressContainer.classList.add('hidden');
                    return;
                }
                
                updateProgress(30, 'กำลังเตรียมไฟล์ ZIP...');
                const zip = new JSZip();
                const baseName = selectedFile.name.replace('.pdf', '');
                
                for (let i = 0; i < indicesToExtract.length; i++) {
                    const pageIndex = indicesToExtract[i];
                    updateProgress(30 + Math.round((i / indicesToExtract.length) * 50), `กำลังแยกหน้า ${pageIndex + 1}...`);
                    
                    const singlePagePdf = await PDFLib.PDFDocument.create();
                    const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [pageIndex]);
                    singlePagePdf.addPage(copiedPage);
                    
                    const pdfBytes = await singlePagePdf.save();
                    zip.file(`${baseName}_page_${pageIndex + 1}.pdf`, pdfBytes);
                }
                
                updateProgress(85, 'กำลังบีบอัดไฟล์ ZIP...');
                const zipContent = await zip.generateAsync({ type: 'blob' });
                resultBlob = zipContent;
                resultFileName = baseName + '_split.zip';
            }

            updateProgress(100, 'แยกไฟล์สำเร็จ!');

            progressContainer.classList.add('hidden');
            downloadSection.classList.remove('hidden');

            // Update download button text
            const sizeStr = formatFileSize(resultBlob.size);
            downloadBtn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
                ' ดาวน์โหลดไฟล์ (' + sizeStr + ')';

        } catch (error) {
            console.error('Error splitting PDFs:', error);
            alert('เกิดข้อผิดพลาดในการแยกไฟล์ PDF: ' + error.message);
            actionButtons.classList.remove('hidden');
            progressContainer.classList.add('hidden');
        }
    }

    function downloadResult() {
        if (!resultBlob) return;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(resultBlob);
        link.download = resultFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    // ========================================
    // UI Updates
    // ========================================

    function updateProgress(percent, message) {
        progressFill.style.width = percent + '%';
        progressText.textContent = message;
    }

    // ========================================
    // Utility Functions
    // ========================================

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    console.log('Split PDF initialized');

})();