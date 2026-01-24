/**
 * i-am pdf - PDF to JPG Converter
 * Client-side PDF to Image conversion using PDF.js
 * Supports multiple files at once
 */

(function () {
    'use strict';

    // ========================================
    // Configuration
    // ========================================
    const CONFIG = {
        maxFileSize: 50 * 1024 * 1024, // 50MB per file
        maxFiles: 20, // Maximum number of files
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
    const addFileInput = document.getElementById('add-file-input');
    const addMoreFilesBtn = document.getElementById('add-more-files');
    const converterSection = document.getElementById('converter-section');
    const fileList = document.getElementById('file-list');
    const convertBtn = document.getElementById('convert-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const resultsGrid = document.getElementById('results-grid');
    const downloadSection = document.getElementById('download-section');
    const downloadAllBtn = document.getElementById('download-all-btn');
    const actionButtons = document.getElementById('action-buttons');

    // State
    let selectedFiles = [];
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
        if (e.target.files && e.target.files.length > 0) {
            handleFilesSelect(Array.from(e.target.files));
        }
    });

    // Add more files button
    if (addMoreFilesBtn && addFileInput) {
        addMoreFilesBtn.addEventListener('click', function () {
            addFileInput.click();
        });

        addFileInput.addEventListener('change', function (e) {
            if (e.target.files && e.target.files.length > 0) {
                addFiles(Array.from(e.target.files));
                addFileInput.value = '';
            }
        });
    }

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
            handleFilesSelect(Array.from(e.dataTransfer.files));
        }
    });

    // Convert button
    if (convertBtn) {
        convertBtn.addEventListener('click', function () {
            if (selectedFiles.length > 0) {
                convertAllPdfs();
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

    function handleFilesSelect(files) {
        selectedFiles = [];
        addFiles(files);
    }

    function addFiles(files) {
        const validFiles = files.filter(function (file) {
            // Validate file type
            if (file.type !== 'application/pdf') {
                console.warn('Skipping non-PDF file:', file.name);
                return false;
            }

            // Validate file size
            if (file.size > CONFIG.maxFileSize) {
                alert('ไฟล์ ' + file.name + ' มีขนาดใหญ่เกินไป (สูงสุด 50MB)');
                return false;
            }

            // Check for duplicate
            const isDuplicate = selectedFiles.some(function (f) {
                return f.name === file.name && f.size === file.size;
            });
            if (isDuplicate) {
                console.warn('Skipping duplicate file:', file.name);
                return false;
            }

            return true;
        });

        // Check max files limit
        const totalFiles = selectedFiles.length + validFiles.length;
        if (totalFiles > CONFIG.maxFiles) {
            alert('สามารถเลือกได้สูงสุด ' + CONFIG.maxFiles + ' ไฟล์');
            validFiles.splice(CONFIG.maxFiles - selectedFiles.length);
        }

        if (validFiles.length === 0 && selectedFiles.length === 0) {
            alert('กรุณาเลือกไฟล์ PDF');
            return;
        }

        selectedFiles = selectedFiles.concat(validFiles);
        showFileList();
    }

    function removeFile(index) {
        selectedFiles.splice(index, 1);

        if (selectedFiles.length === 0) {
            resetConverter();
        } else {
            showFileList();
        }
    }

    function showFileList() {
        uploadArea.classList.add('hidden');
        converterSection.classList.remove('hidden');

        // Reset previous results
        resultsGrid.innerHTML = '';
        resultsGrid.classList.add('hidden');
        downloadSection.classList.add('hidden');
        progressContainer.classList.add('hidden');
        actionButtons.classList.remove('hidden');
        convertBtn.disabled = false;
        convertedImages = [];

        // Render file list
        fileList.innerHTML = '';

        selectedFiles.forEach(function (file, index) {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-info';
            fileItem.innerHTML =
                '<div class="file-icon">PDF</div>' +
                '<div class="file-details">' +
                '<h4>' + escapeHtml(file.name) + '</h4>' +
                '<p>' + formatFileSize(file.size) + '</p>' +
                '</div>' +
                '<button class="remove-file" data-index="' + index + '" aria-label="ลบไฟล์">×</button>';

            fileList.appendChild(fileItem);
        });

        // Add event listeners for remove buttons
        fileList.querySelectorAll('.remove-file').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const index = parseInt(this.dataset.index);
                removeFile(index);
            });
        });

        // Update convert button text
        convertBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' +
            ' แปลง PDF เป็น JPG (' + selectedFiles.length + ' ไฟล์)';
    }

    function resetConverter() {
        selectedFiles = [];
        convertedImages = [];
        fileInput.value = '';
        if (addFileInput) addFileInput.value = '';

        uploadArea.classList.remove('hidden');
        converterSection.classList.add('hidden');
        fileList.innerHTML = '';
        resultsGrid.innerHTML = '';
        progressFill.style.width = '0%';
        progressText.textContent = 'กำลังแปลงไฟล์... 0%';
    }

    // ========================================
    // PDF Conversion
    // ========================================

    async function convertAllPdfs() {
        if (typeof pdfjsLib === 'undefined') {
            alert('เกิดข้อผิดพลาด: ไม่สามารถโหลด PDF.js library ได้');
            return;
        }

        try {
            // Show progress
            actionButtons.classList.add('hidden');
            progressContainer.classList.remove('hidden');

            convertedImages = [];
            let totalPages = 0;
            let processedPages = 0;

            // First pass: count total pages
            updateProgress(0, 'กำลังอ่านไฟล์ PDF...');

            const pdfInfos = [];
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                totalPages += pdf.numPages;
                pdfInfos.push({ file, pdf, pageCount: pdf.numPages });
            }

            updateProgress(5, 'พบทั้งหมด ' + totalPages + ' หน้า จาก ' + selectedFiles.length + ' ไฟล์');

            // Second pass: convert all pages
            for (let fileIdx = 0; fileIdx < pdfInfos.length; fileIdx++) {
                const { file, pdf, pageCount } = pdfInfos[fileIdx];

                for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const imageData = await renderPageToImage(page);

                    convertedImages.push({
                        name: generateFileName(file.name, 'jpg', pageNum - 1),
                        data: imageData,
                        pageNum: pageNum,
                        fileName: file.name
                    });

                    processedPages++;
                    const progress = 5 + Math.round((processedPages / totalPages) * 90);
                    updateProgress(progress, 'กำลังแปลง ' + processedPages + '/' + totalPages + ' หน้า');
                }
            }

            // Show results
            updateProgress(100, 'แปลงไฟล์สำเร็จ! (' + totalPages + ' หน้า จาก ' + selectedFiles.length + ' ไฟล์)');
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
                '<img src="' + img.data + '" alt="' + escapeHtml(img.fileName) + ' หน้า ' + img.pageNum + '" loading="lazy">' +
                '<div class="result-item-info">' +
                '<span title="' + escapeHtml(img.fileName) + '">' + truncateFileName(img.fileName, 15) + ' - หน้า ' + img.pageNum + '</span>' +
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

        // Update download button text
        downloadAllBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
            ' ดาวน์โหลดทั้งหมด (' + convertedImages.length + ' รูป)';
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

            // Group images by source file
            const fileGroups = {};
            convertedImages.forEach(function (img) {
                const baseName = img.fileName.replace(/\.pdf$/i, '');
                if (!fileGroups[baseName]) {
                    fileGroups[baseName] = [];
                }
                fileGroups[baseName].push(img);
            });

            // Create folders for each source file if multiple files
            const multipleFiles = Object.keys(fileGroups).length > 1;

            for (const baseName in fileGroups) {
                const images = fileGroups[baseName];
                const folder = multipleFiles ? zip.folder(baseName) : zip;

                images.forEach(function (img, idx) {
                    const base64Data = img.data.split(',')[1];
                    const fileName = baseName + '_page_' + (idx + 1) + '.jpg';
                    folder.file(fileName, base64Data, { base64: true });
                });
            }

            const content = await zip.generateAsync({ type: 'blob' });

            // Download ZIP
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);

            // Name based on number of files
            const zipName = selectedFiles.length === 1
                ? selectedFiles[0].name.replace('.pdf', '') + '_images.zip'
                : 'pdf_images_' + selectedFiles.length + '_files.zip';

            link.download = zipName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            downloadAllBtn.disabled = false;
            downloadAllBtn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
                ' ดาวน์โหลดทั้งหมด (' + convertedImages.length + ' รูป)';

        } catch (error) {
            console.error('Error creating ZIP:', error);
            alert('เกิดข้อผิดพลาดในการสร้างไฟล์ ZIP');

            downloadAllBtn.disabled = false;
            downloadAllBtn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
                ' ดาวน์โหลดทั้งหมด (' + convertedImages.length + ' รูป)';
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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function truncateFileName(name, maxLength) {
        if (name.length <= maxLength) return name;
        const ext = name.split('.').pop();
        const baseName = name.substring(0, name.length - ext.length - 1);
        return baseName.substring(0, maxLength - 3 - ext.length) + '...' + ext;
    }

    console.log('PDF Converter (Multi-file) initialized');

})();
