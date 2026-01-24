/**
 * i-am pdf - JPG to PDF Converter
 * Client-side Image to PDF conversion using jsPDF
 */

(function () {
    'use strict';

    // Check if we're on the right page
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    if (!uploadArea || !fileInput || !document.querySelector('h1')?.textContent.includes('JPG to PDF')) {
        return;
    }

    // ========================================
    // Configuration
    // ========================================
    const CONFIG = {
        maxFileSize: 20 * 1024 * 1024, // 20MB per image
        maxFiles: 50,
        acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    };

    // ========================================
    // DOM Elements
    // ========================================
    const addFileInput = document.getElementById('add-file-input');
    const addMoreFilesBtn = document.getElementById('add-more-files');
    const converterSection = document.getElementById('converter-section');
    const imageList = document.getElementById('image-list');
    const convertBtn = document.getElementById('convert-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const downloadSection = document.getElementById('download-section');
    const downloadBtn = document.getElementById('download-btn');
    const actionButtons = document.getElementById('action-buttons');
    const pageSizeSelect = document.getElementById('page-size');
    const orientationSelect = document.getElementById('orientation');

    // State
    let selectedImages = [];
    let generatedPdfBlob = null;

    // ========================================
    // Event Listeners
    // ========================================

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

    // Add more files
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
            if (selectedImages.length > 0) {
                createPdf();
            }
        });
    }

    // Download button
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function () {
            if (generatedPdfBlob) {
                downloadPdf();
            }
        });
    }

    // Options change - reset download section if PDF was already generated
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', function () {
            if (generatedPdfBlob) {
                // Reset to show convert button again
                generatedPdfBlob = null;
                downloadSection.classList.add('hidden');
                actionButtons.classList.remove('hidden');
            }
        });
    }

    if (orientationSelect) {
        orientationSelect.addEventListener('change', function () {
            if (generatedPdfBlob) {
                // Reset to show convert button again
                generatedPdfBlob = null;
                downloadSection.classList.add('hidden');
                actionButtons.classList.remove('hidden');
            }
        });
    }

    // ========================================
    // File Handling
    // ========================================

    function handleFilesSelect(files) {
        selectedImages = [];
        addFiles(files);
    }

    function addFiles(files) {
        const validFiles = files.filter(function (file) {
            if (!CONFIG.acceptedTypes.includes(file.type)) {
                console.warn('Skipping non-image file:', file.name);
                return false;
            }

            if (file.size > CONFIG.maxFileSize) {
                alert('ไฟล์ ' + file.name + ' มีขนาดใหญ่เกินไป (สูงสุด 20MB)');
                return false;
            }

            return true;
        });

        const totalFiles = selectedImages.length + validFiles.length;
        if (totalFiles > CONFIG.maxFiles) {
            alert('สามารถเลือกได้สูงสุด ' + CONFIG.maxFiles + ' รูป');
            validFiles.splice(CONFIG.maxFiles - selectedImages.length);
        }

        if (validFiles.length === 0 && selectedImages.length === 0) {
            alert('กรุณาเลือกไฟล์รูปภาพ');
            return;
        }

        // Load images as data URLs
        validFiles.forEach(function (file, index) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = new Image();
                img.onload = function () {
                    selectedImages.push({
                        name: file.name,
                        dataUrl: e.target.result,
                        width: img.width,
                        height: img.height,
                        size: file.size
                    });

                    if (index === validFiles.length - 1) {
                        showImageList();
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function removeImage(index) {
        selectedImages.splice(index, 1);

        if (selectedImages.length === 0) {
            resetConverter();
        } else {
            showImageList();
        }
    }

    function showImageList() {
        uploadArea.classList.add('hidden');
        converterSection.classList.remove('hidden');

        // Reset
        downloadSection.classList.add('hidden');
        progressContainer.classList.add('hidden');
        actionButtons.classList.remove('hidden');
        generatedPdfBlob = null;

        // Render image list
        imageList.innerHTML = '';

        selectedImages.forEach(function (img, index) {
            const item = document.createElement('div');
            item.className = 'image-item';
            item.draggable = true;
            item.dataset.index = index;
            item.innerHTML =
                '<img src="' + img.dataUrl + '" alt="' + escapeHtml(img.name) + '">' +
                '<div class="image-item-info">' +
                '<span title="' + escapeHtml(img.name) + '">' + truncateFileName(img.name, 20) + '</span>' +
                '<span class="image-size">' + img.width + '×' + img.height + '</span>' +
                '</div>' +
                '<button class="remove-image" data-index="' + index + '" aria-label="ลบรูป">×</button>' +
                '<div class="drag-handle">☰</div>';

            imageList.appendChild(item);
        });

        // Add event listeners
        imageList.querySelectorAll('.remove-image').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const index = parseInt(this.dataset.index);
                removeImage(index);
            });
        });

        // Enable drag and drop reordering
        enableDragSort();

        // Update button text
        convertBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
            ' สร้างไฟล์ PDF (' + selectedImages.length + ' รูป)';
    }

    function enableDragSort() {
        const items = imageList.querySelectorAll('.image-item');
        let draggedItem = null;

        items.forEach(function (item) {
            item.addEventListener('dragstart', function (e) {
                draggedItem = this;
                this.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', function () {
                this.classList.remove('dragging');
                draggedItem = null;
                updateImageOrder();
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

    function updateImageOrder() {
        const items = imageList.querySelectorAll('.image-item');
        const newOrder = [];

        items.forEach(function (item) {
            const index = parseInt(item.dataset.index);
            newOrder.push(selectedImages[index]);
        });

        selectedImages = newOrder;

        // Update data-index attributes
        items.forEach(function (item, index) {
            item.dataset.index = index;
            item.querySelector('.remove-image').dataset.index = index;
        });
    }

    function resetConverter() {
        selectedImages = [];
        generatedPdfBlob = null;
        fileInput.value = '';
        if (addFileInput) addFileInput.value = '';

        uploadArea.classList.remove('hidden');
        converterSection.classList.add('hidden');
        imageList.innerHTML = '';
        progressFill.style.width = '0%';
    }

    // ========================================
    // PDF Creation
    // ========================================

    async function createPdf() {
        if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
            alert('เกิดข้อผิดพลาด: ไม่สามารถโหลด jsPDF library ได้');
            return;
        }

        const { jsPDF } = window.jspdf;

        try {
            actionButtons.classList.add('hidden');
            progressContainer.classList.remove('hidden');

            const pageSize = pageSizeSelect.value;
            const orientation = orientationSelect.value;

            let pdf = null;

            for (let i = 0; i < selectedImages.length; i++) {
                const img = selectedImages[i];

                updateProgress(Math.round((i / selectedImages.length) * 90), 'กำลังเพิ่มรูปที่ ' + (i + 1) + '/' + selectedImages.length);

                // Determine orientation for this page
                let pageOrientation = orientation;
                if (orientation === 'auto') {
                    pageOrientation = img.width > img.height ? 'landscape' : 'portrait';
                }

                // Create PDF on first image or add page
                if (i === 0) {
                    if (pageSize === 'fit') {
                        // Convert pixels to mm (assuming 96 DPI)
                        const widthMm = img.width * 0.264583;
                        const heightMm = img.height * 0.264583;
                        pdf = new jsPDF({
                            orientation: pageOrientation,
                            unit: 'mm',
                            format: [widthMm, heightMm]
                        });
                    } else {
                        pdf = new jsPDF({
                            orientation: pageOrientation,
                            unit: 'mm',
                            format: pageSize
                        });
                    }
                } else {
                    if (pageSize === 'fit') {
                        const widthMm = img.width * 0.264583;
                        const heightMm = img.height * 0.264583;
                        pdf.addPage([widthMm, heightMm], pageOrientation);
                    } else {
                        pdf.addPage(pageSize, pageOrientation);
                    }
                }

                // Get page dimensions
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();

                // Calculate image dimensions to fit page (with margin)
                const margin = pageSize === 'fit' ? 0 : 10;
                const maxWidth = pageWidth - (margin * 2);
                const maxHeight = pageHeight - (margin * 2);

                const imgRatio = img.width / img.height;
                const pageRatio = maxWidth / maxHeight;

                let imgWidth, imgHeight, x, y;

                if (pageSize === 'fit') {
                    imgWidth = pageWidth;
                    imgHeight = pageHeight;
                    x = 0;
                    y = 0;
                } else if (imgRatio > pageRatio) {
                    imgWidth = maxWidth;
                    imgHeight = maxWidth / imgRatio;
                    x = margin;
                    y = margin + (maxHeight - imgHeight) / 2;
                } else {
                    imgHeight = maxHeight;
                    imgWidth = maxHeight * imgRatio;
                    x = margin + (maxWidth - imgWidth) / 2;
                    y = margin;
                }

                pdf.addImage(img.dataUrl, 'JPEG', x, y, imgWidth, imgHeight);

                // Small delay to prevent UI freezing
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            updateProgress(95, 'กำลังสร้างไฟล์ PDF...');

            generatedPdfBlob = pdf.output('blob');

            updateProgress(100, 'สร้างไฟล์ PDF สำเร็จ!');

            // Show download button
            progressContainer.classList.add('hidden');
            downloadSection.classList.remove('hidden');

        } catch (error) {
            console.error('Error creating PDF:', error);
            alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF: ' + error.message);
            actionButtons.classList.remove('hidden');
            progressContainer.classList.add('hidden');
        }
    }

    function downloadPdf() {
        if (!generatedPdfBlob) return;

        const link = document.createElement('a');
        link.href = URL.createObjectURL(generatedPdfBlob);
        link.download = 'images_' + new Date().getTime() + '.pdf';
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

    console.log('JPG to PDF Converter initialized');

})();
