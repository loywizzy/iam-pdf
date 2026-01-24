/**
 * i-am pdf - Compress PDF
 * Client-side PDF compression by re-rendering pages as compressed images
 */

(function () {
    'use strict';

    // Check if we're on the right page
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    if (!uploadArea || !fileInput || !document.querySelector('h1')?.textContent.includes('บีบอัด PDF')) {
        return;
    }

    // Set PDF.js worker
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    // ========================================
    // Configuration
    // ========================================
    const CONFIG = {
        maxFileSize: 100 * 1024 * 1024, // 100MB
        compressionSettings: {
            low: { scale: 2, quality: 0.9 },      // High quality, ~20% reduction
            medium: { scale: 1.5, quality: 0.7 }, // Balanced, ~50% reduction
            high: { scale: 1, quality: 0.5 }      // Small size, ~70% reduction
        }
    };

    // ========================================
    // DOM Elements
    // ========================================
    const converterSection = document.getElementById('converter-section');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const removeFileBtn = document.getElementById('remove-file');
    const compressionLevel = document.getElementById('compression-level');
    const compressBtn = document.getElementById('compress-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const resultSection = document.getElementById('result-section');
    const compressionResult = document.getElementById('compression-result');
    const downloadBtn = document.getElementById('download-btn');
    const actionButtons = document.getElementById('action-buttons');

    // State
    let selectedFile = null;
    let compressedPdfBlob = null;
    let originalSize = 0;

    // ========================================
    // Event Listeners
    // ========================================

    uploadArea.addEventListener('click', function () {
        fileInput.click();
    });

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

    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', function () {
            resetConverter();
        });
    }

    if (compressBtn) {
        compressBtn.addEventListener('click', function () {
            if (selectedFile) {
                compressPdf();
            }
        });
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', function () {
            if (compressedPdfBlob) {
                downloadCompressedPdf();
            }
        });
    }

    // Compression level change - reset result if already compressed
    if (compressionLevel) {
        compressionLevel.addEventListener('change', function () {
            if (compressedPdfBlob) {
                // Reset to show compress button again
                compressedPdfBlob = null;
                resultSection.classList.add('hidden');
                actionButtons.classList.remove('hidden');
            }
        });
    }

    // ========================================
    // File Handling
    // ========================================

    function handleFileSelect(file) {
        if (file.type !== 'application/pdf') {
            alert('กรุณาเลือกไฟล์ PDF เท่านั้น');
            return;
        }

        if (file.size > CONFIG.maxFileSize) {
            alert('ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 100MB)');
            return;
        }

        selectedFile = file;
        originalSize = file.size;
        showFileInfo(file);
    }

    function showFileInfo(file) {
        uploadArea.classList.add('hidden');
        converterSection.classList.remove('hidden');

        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);

        resultSection.classList.add('hidden');
        progressContainer.classList.add('hidden');
        actionButtons.classList.remove('hidden');
        compressedPdfBlob = null;
    }

    function resetConverter() {
        selectedFile = null;
        compressedPdfBlob = null;
        originalSize = 0;
        fileInput.value = '';

        uploadArea.classList.remove('hidden');
        converterSection.classList.add('hidden');
        progressFill.style.width = '0%';
    }

    // ========================================
    // PDF Compression
    // ========================================

    async function compressPdf() {
        if (typeof pdfjsLib === 'undefined') {
            alert('เกิดข้อผิดพลาด: ไม่สามารถโหลด PDF.js library ได้');
            return;
        }

        if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
            alert('เกิดข้อผิดพลาด: ไม่สามารถโหลด jsPDF library ได้');
            return;
        }

        const { jsPDF } = window.jspdf;
        const level = compressionLevel.value;
        const settings = CONFIG.compressionSettings[level];

        try {
            actionButtons.classList.add('hidden');
            progressContainer.classList.remove('hidden');

            updateProgress(0, 'กำลังอ่านไฟล์ PDF...');

            const arrayBuffer = await selectedFile.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const totalPages = pdf.numPages;

            updateProgress(5, 'กำลังบีบอัด 0/' + totalPages + ' หน้า');

            let newPdf = null;

            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: settings.scale });

                // Create canvas
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // Render page to canvas
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                // Get image data
                const imgData = canvas.toDataURL('image/jpeg', settings.quality);

                // Calculate page dimensions in mm
                const widthMm = (viewport.width / settings.scale) * 0.264583;
                const heightMm = (viewport.height / settings.scale) * 0.264583;

                // Determine orientation
                const orientation = widthMm > heightMm ? 'landscape' : 'portrait';

                if (pageNum === 1) {
                    newPdf = new jsPDF({
                        orientation: orientation,
                        unit: 'mm',
                        format: [widthMm, heightMm]
                    });
                } else {
                    newPdf.addPage([widthMm, heightMm], orientation);
                }

                // Add image to page
                newPdf.addImage(imgData, 'JPEG', 0, 0, widthMm, heightMm);

                const progress = 5 + Math.round((pageNum / totalPages) * 90);
                updateProgress(progress, 'กำลังบีบอัด ' + pageNum + '/' + totalPages + ' หน้า');

                // Small delay
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            updateProgress(98, 'กำลังสร้างไฟล์ PDF...');

            compressedPdfBlob = newPdf.output('blob');

            updateProgress(100, 'บีบอัดสำเร็จ!');

            // Show result
            showResult();

        } catch (error) {
            console.error('Error compressing PDF:', error);
            alert('เกิดข้อผิดพลาดในการบีบอัดไฟล์ PDF: ' + error.message);
            actionButtons.classList.remove('hidden');
            progressContainer.classList.add('hidden');
        }
    }

    function showResult() {
        progressContainer.classList.add('hidden');
        resultSection.classList.remove('hidden');

        const newSize = compressedPdfBlob.size;
        const reduction = Math.round((1 - newSize / originalSize) * 100);

        let resultText;
        if (reduction > 0) {
            resultText = 'ลดขนาดจาก ' + formatFileSize(originalSize) +
                ' เหลือ ' + formatFileSize(newSize) +
                ' (ลดลง ' + reduction + '%)';
        } else {
            resultText = 'ขนาดไฟล์: ' + formatFileSize(newSize) +
                ' (ไฟล์นี้อาจบีบอัดได้ไม่มากนัก)';
        }

        compressionResult.textContent = resultText;

        downloadBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
            ' ดาวน์โหลด PDF (' + formatFileSize(newSize) + ')';
    }

    function downloadCompressedPdf() {
        if (!compressedPdfBlob) return;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(compressedPdfBlob);

        const baseName = selectedFile.name.replace(/\.pdf$/i, '');
        link.download = baseName + '_compressed.pdf';

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

    console.log('Compress PDF initialized');

})();
