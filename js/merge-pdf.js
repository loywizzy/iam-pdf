/**
 * i-am pdf - Merge PDF
 * Client-side PDF merging using pdf-lib
 */

(function () {
    'use strict';

    // Check if we're on the right page
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    if (!uploadArea || !fileInput || !document.querySelector('h1')?.textContent.includes('รวม PDF')) {
        return;
    }

    // ========================================
    // Configuration
    // ========================================
    const CONFIG = {
        maxFileSize: 50 * 1024 * 1024, // 50MB per file
        maxFiles: 50
    };

    // ========================================
    // DOM Elements
    // ========================================
    const addFileInput = document.getElementById('add-file-input');
    const addMoreFilesBtn = document.getElementById('add-more-files');
    const converterSection = document.getElementById('converter-section');
    const fileList = document.getElementById('file-list');
    const mergeBtn = document.getElementById('merge-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const downloadSection = document.getElementById('download-section');
    const downloadBtn = document.getElementById('download-btn');
    const actionButtons = document.getElementById('action-buttons');

    // State
    let selectedFiles = [];
    let mergedPdfBlob = null;

    // ========================================
    // Event Listeners
    // ========================================

    uploadArea.addEventListener('click', function () {
        fileInput.click();
    });

    fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files.length > 0) {
            handleFilesSelect(Array.from(e.target.files));
        }
    });

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

    if (mergeBtn) {
        mergeBtn.addEventListener('click', function () {
            if (selectedFiles.length >= 2) {
                mergePdfs();
            } else {
                alert('กรุณาเลือกอย่างน้อย 2 ไฟล์');
            }
        });
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', function () {
            if (mergedPdfBlob) {
                downloadMergedPdf();
            }
        });
    }

    // ========================================
    // File Handling
    // ========================================

    function handleFilesSelect(files) {
        selectedFiles = [];
        addFiles(files);
    }

    async function addFiles(files) {
        const validFiles = [];

        for (const file of files) {
            if (file.type !== 'application/pdf') {
                console.warn('Skipping non-PDF file:', file.name);
                continue;
            }

            if (file.size > CONFIG.maxFileSize) {
                alert('ไฟล์ ' + file.name + ' มีขนาดใหญ่เกินไป (สูงสุด 50MB)');
                continue;
            }

            // Read file to get page count
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
                const pageCount = pdf.getPageCount();

                validFiles.push({
                    file: file,
                    name: file.name,
                    size: file.size,
                    pageCount: pageCount,
                    arrayBuffer: arrayBuffer
                });
            } catch (error) {
                console.error('Error reading PDF:', file.name, error);
                alert('ไม่สามารถอ่านไฟล์ ' + file.name + ' ได้');
            }
        }

        const totalFiles = selectedFiles.length + validFiles.length;
        if (totalFiles > CONFIG.maxFiles) {
            alert('สามารถเลือกได้สูงสุด ' + CONFIG.maxFiles + ' ไฟล์');
            validFiles.splice(CONFIG.maxFiles - selectedFiles.length);
        }

        if (validFiles.length === 0 && selectedFiles.length === 0) {
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

        downloadSection.classList.add('hidden');
        progressContainer.classList.add('hidden');
        actionButtons.classList.remove('hidden');
        mergedPdfBlob = null;

        fileList.innerHTML = '';

        let totalPages = 0;
        selectedFiles.forEach(function (item, index) {
            totalPages += item.pageCount;

            const fileItem = document.createElement('div');
            fileItem.className = 'file-info';
            fileItem.draggable = true;
            fileItem.dataset.index = index;
            fileItem.innerHTML =
                '<div class="drag-handle" style="cursor: grab; padding: 0 0.5rem; color: var(--gray-400);">☰</div>' +
                '<div class="file-icon">PDF</div>' +
                '<div class="file-details">' +
                '<h4>' + escapeHtml(item.name) + '</h4>' +
                '<p>' + formatFileSize(item.size) + ' • ' + item.pageCount + ' หน้า</p>' +
                '</div>' +
                '<button class="remove-file" data-index="' + index + '" aria-label="ลบไฟล์">×</button>';

            fileList.appendChild(fileItem);
        });

        // Add event listeners
        fileList.querySelectorAll('.remove-file').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const index = parseInt(this.dataset.index);
                removeFile(index);
            });
        });

        // Enable drag sorting
        enableDragSort();

        // Update button
        mergeBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="12" height="12" rx="2" ry="2"/></svg>' +
            ' รวม ' + selectedFiles.length + ' ไฟล์ (' + totalPages + ' หน้า)';
    }

    function enableDragSort() {
        const items = fileList.querySelectorAll('.file-info');
        let draggedItem = null;

        items.forEach(function (item) {
            item.addEventListener('dragstart', function (e) {
                draggedItem = this;
                this.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', function () {
                this.style.opacity = '1';
                draggedItem = null;
                updateFileOrder();
            });

            item.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (draggedItem && draggedItem !== this) {
                    const rect = this.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;

                    if (e.clientY < midY) {
                        this.parentNode.insertBefore(draggedItem, this);
                    } else {
                        this.parentNode.insertBefore(draggedItem, this.nextSibling);
                    }
                }
            });
        });
    }

    function updateFileOrder() {
        const items = fileList.querySelectorAll('.file-info');
        const newOrder = [];

        items.forEach(function (item) {
            const index = parseInt(item.dataset.index);
            newOrder.push(selectedFiles[index]);
        });

        selectedFiles = newOrder;

        items.forEach(function (item, index) {
            item.dataset.index = index;
            item.querySelector('.remove-file').dataset.index = index;
        });
    }

    function resetConverter() {
        selectedFiles = [];
        mergedPdfBlob = null;
        fileInput.value = '';
        if (addFileInput) addFileInput.value = '';

        uploadArea.classList.remove('hidden');
        converterSection.classList.add('hidden');
        fileList.innerHTML = '';
        progressFill.style.width = '0%';
    }

    // ========================================
    // PDF Merging
    // ========================================

    async function mergePdfs() {
        if (typeof PDFLib === 'undefined') {
            alert('เกิดข้อผิดพลาด: ไม่สามารถโหลด PDF-lib library ได้');
            return;
        }

        try {
            actionButtons.classList.add('hidden');
            progressContainer.classList.remove('hidden');

            updateProgress(0, 'กำลังเตรียมรวมไฟล์ PDF...');

            const mergedPdf = await PDFLib.PDFDocument.create();

            for (let i = 0; i < selectedFiles.length; i++) {
                const item = selectedFiles[i];

                updateProgress(Math.round((i / selectedFiles.length) * 90),
                    'กำลังรวมไฟล์ ' + (i + 1) + '/' + selectedFiles.length + ': ' + truncateFileName(item.name, 30));

                const pdf = await PDFLib.PDFDocument.load(item.arrayBuffer);
                const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

                pages.forEach(function (page) {
                    mergedPdf.addPage(page);
                });

                // Small delay to prevent UI freezing
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            updateProgress(95, 'กำลังสร้างไฟล์ PDF...');

            const mergedPdfBytes = await mergedPdf.save();
            mergedPdfBlob = new Blob([mergedPdfBytes], { type: 'application/pdf' });

            updateProgress(100, 'รวมไฟล์ PDF สำเร็จ!');

            progressContainer.classList.add('hidden');
            downloadSection.classList.remove('hidden');

            // Update download button
            downloadBtn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
                ' ดาวน์โหลด PDF (' + formatFileSize(mergedPdfBlob.size) + ')';

        } catch (error) {
            console.error('Error merging PDFs:', error);
            alert('เกิดข้อผิดพลาดในการรวมไฟล์ PDF: ' + error.message);
            actionButtons.classList.remove('hidden');
            progressContainer.classList.add('hidden');
        }
    }

    function downloadMergedPdf() {
        if (!mergedPdfBlob) return;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(mergedPdfBlob);
        link.download = 'merged_' + new Date().getTime() + '.pdf';
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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function truncateFileName(name, maxLength) {
        if (name.length <= maxLength) return name;
        return name.substring(0, maxLength - 3) + '...';
    }

    console.log('Merge PDF initialized');

})();
