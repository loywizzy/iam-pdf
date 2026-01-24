/**
 * i-am pdf - PDF to JPG Converter
 * Client-side PDF to Image conversion using PDF.js
 */

(function () {
    'use strict';

    // ========================================
    // Configuration
    // ========================================
    const CONFIG = {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        outputFormat: 'image/jpeg',
        outputQuality: 0.92,
        scale: 2, // Render at 2x for better quality
        workerSrc: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    };

    // Set PDF.js worker
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = CONFIG.workerSrc;
    }

    // ========================================
    // DOM Elements
    // ========================================
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const converterSection = document.getElementById('converter-section');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const removeFileBtn = document.getElementById('remove-file');
    const convertBtn = document.getElementById('convert-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const resultsGrid = document.getElementById('results-grid');
    const downloadSection = document.getElementById('download-section');
    const downloadAllBtn = document.getElementById('download-all-btn');
    const actionButtons = document.getElementById('action-buttons');

    // State
    let selectedFile = null;
    let convertedImages = [];

    // ========================================
    // Event Listeners
    // ========================================

    if (!uploadArea || !fileInput) {
        console.log('PDF converter elements not found on this page');
        return;
    }

    // Click to upload
    uploadArea.addEventListener('click', function () {
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
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

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    // Remove file button
    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', function () {
            resetConverter();
        });
    }

    // Convert button
    if (convertBtn) {
        convertBtn.addEventListener('click', function () {
            if (selectedFile) {
                convertPdfToImages(selectedFile);
            }
        });
    }

    // Download all button
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', function () {
            downloadAllAsZip();
        });
    }

    // ========================================
    // File Handling
    // ========================================

    function handleFileSelect(file) {
        // Validate file type
        if (file.type !== 'application/pdf') {
            alert('กรุณาเลือกไฟล์ PDF เท่านั้น');
            return;
        }

        // Validate file size
        if (file.size > CONFIG.maxFileSize) {
            alert('ไฟล์มีขนาดใหญ่เกินไป กรุณาเลือกไฟล์ขนาดไม่เกิน 50MB');
            return;
        }

        selectedFile = file;
        showFileInfo(file);
    }

    function showFileInfo(file) {
        uploadArea.classList.add('hidden');
        converterSection.classList.remove('hidden');

        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);

        // Reset previous results
        resultsGrid.innerHTML = '';
        resultsGrid.classList.add('hidden');
        downloadSection.classList.add('hidden');
        progressContainer.classList.add('hidden');
        actionButtons.classList.remove('hidden');
        convertBtn.disabled = false;
        convertedImages = [];
    }

    function resetConverter() {
        selectedFile = null;
        convertedImages = [];
        fileInput.value = '';

        uploadArea.classList.remove('hidden');
        converterSection.classList.add('hidden');
        resultsGrid.innerHTML = '';
        progressFill.style.width = '0%';
        progressText.textContent = 'กำลังแปลงไฟล์... 0%';
    }

    // ========================================
    // PDF Conversion
    // ========================================

    async function convertPdfToImages(file) {
        if (typeof pdfjsLib === 'undefined') {
            alert('เกิดข้อผิดพลาด: ไม่สามารถโหลด PDF.js library ได้');
            return;
        }

        try {
            // Show progress
            actionButtons.classList.add('hidden');
            progressContainer.classList.remove('hidden');
            updateProgress(0, 'กำลังอ่านไฟล์ PDF...');

            // Read file as ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();

            // Load PDF document
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const totalPages = pdf.numPages;

            updateProgress(5, 'กำลังแปลง 0/' + totalPages + ' หน้า');

            convertedImages = [];

            // Convert each page
            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const imageData = await renderPageToImage(page);

                convertedImages.push({
                    name: generateFileName(file.name, 'jpg', pageNum - 1),
                    data: imageData,
                    pageNum: pageNum
                });

                const progress = 5 + Math.round((pageNum / totalPages) * 90);
                updateProgress(progress, 'กำลังแปลง ' + pageNum + '/' + totalPages + ' หน้า');
            }

            // Show results
            updateProgress(100, 'แปลงไฟล์สำเร็จ!');
            showResults();

        } catch (error) {
            console.error('Error converting PDF:', error);
            alert('เกิดข้อผิดพลาดในการแปลงไฟล์: ' + error.message);
            resetConverter();
        }
    }

    async function renderPageToImage(page) {
        const viewport = page.getViewport({ scale: CONFIG.scale });

        // Create canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Render page
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        // Convert to image
        return canvas.toDataURL(CONFIG.outputFormat, CONFIG.outputQuality);
    }

    // ========================================
    // UI Updates
    // ========================================

    function updateProgress(percent, message) {
        progressFill.style.width = percent + '%';
        progressText.textContent = message;
    }

    function showResults() {
        progressContainer.classList.add('hidden');
        resultsGrid.classList.remove('hidden');
        downloadSection.classList.remove('hidden');

        resultsGrid.innerHTML = '';

        convertedImages.forEach(function (img, index) {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.innerHTML =
                '<img src="' + img.data + '" alt="หน้า ' + img.pageNum + '" loading="lazy">' +
                '<div class="result-item-info">' +
                '<span>หน้า ' + img.pageNum + '</span>' +
                '<button class="btn-download-single" data-index="' + index + '" style="margin-left: 8px; padding: 4px 8px; font-size: 12px; background: var(--primary-red); color: white; border: none; border-radius: 4px; cursor: pointer;">ดาวน์โหลด</button>' +
                '</div>';

            resultsGrid.appendChild(resultItem);
        });

        // Add click handlers for individual downloads
        document.querySelectorAll('.btn-download-single').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const index = parseInt(this.dataset.index);
                downloadSingleImage(index);
            });
        });
    }

    // ========================================
    // Download Functions
    // ========================================

    function downloadSingleImage(index) {
        const img = convertedImages[index];
        if (!img) return;

        const link = document.createElement('a');
        link.href = img.data;
        link.download = img.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function downloadAllAsZip() {
        if (typeof JSZip === 'undefined') {
            alert('เกิดข้อผิดพลาด: ไม่สามารถโหลด JSZip library ได้');
            return;
        }

        try {
            downloadAllBtn.disabled = true;
            downloadAllBtn.innerHTML = '<div class="loading-spinner" style="display: inline-block; margin-right: 8px;"></div> กำลังสร้างไฟล์ ZIP...';

            const zip = new JSZip();
            const folder = zip.folder('pdf-images');

            convertedImages.forEach(function (img) {
                // Remove data URL prefix
                const base64Data = img.data.split(',')[1];
                folder.file(img.name, base64Data, { base64: true });
            });

            const content = await zip.generateAsync({ type: 'blob' });

            // Download ZIP
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = selectedFile.name.replace('.pdf', '') + '_images.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            downloadAllBtn.disabled = false;
            downloadAllBtn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
                ' ดาวน์โหลดทั้งหมด (ZIP)';

        } catch (error) {
            console.error('Error creating ZIP:', error);
            alert('เกิดข้อผิดพลาดในการสร้างไฟล์ ZIP');

            downloadAllBtn.disabled = false;
            downloadAllBtn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
                ' ดาวน์โหลดทั้งหมด (ZIP)';
        }
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

    function generateFileName(baseName, extension, index) {
        const cleanName = baseName.replace(/\.[^/.]+$/, '');
        return cleanName + '_page_' + (index + 1) + '.' + extension;
    }

    console.log('PDF Converter initialized');

})();
