/**
 * i-am pdf - Organize PDF
 * Client-side PDF page organization (reorder, rotate, delete)
 */

(function () {
    'use strict';

    // Check if we're on the right page
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    if (!uploadArea || !fileInput || !document.querySelector('h1')?.textContent.includes('จัดการหน้า')) {
        return;
    }

    // ========================================
    // Configuration
    // ========================================
    const CONFIG = {
        maxFileSize: 100 * 1024 * 1024, // 100MB per file
        thumbnailScale: 0.5
    };

    // ========================================
    // DOM Elements
    // ========================================
    const converterSection = document.getElementById('converter-section');
    const fileNameDisplay = document.getElementById('file-name-display');
    const pageGrid = document.getElementById('page-grid');
    const applyBtn = document.getElementById('apply-btn');
    const resetBtn = document.getElementById('reset-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const downloadSection = document.getElementById('download-section');
    const downloadBtn = document.getElementById('download-btn');
    const actionButtons = document.getElementById('action-buttons');

    // State
    let selectedFile = null;
    let selectedFileArrayBuffer = null;
    let pagesData = []; // Array of { originalIndex, rotation, isDeleted, blobUrl }
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

    if (applyBtn) {
        applyBtn.addEventListener('click', processPdf);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', resetConverter);
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', function () {
            if (resultBlob) {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(resultBlob);
                link.download = resultFileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        });
    }

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
        pagesData = [];
        resultBlob = null;
        pageGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">กำลังโหลดหน้ากระดาษ...</div>';
        
        uploadArea.classList.add('hidden');
        converterSection.classList.remove('hidden');
        downloadSection.classList.add('hidden');
        actionButtons.classList.remove('hidden');

        try {
            selectedFileArrayBuffer = await file.arrayBuffer();
            await renderThumbnails(selectedFileArrayBuffer);
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
            const totalPages = pdf.numPages;
            
            pageGrid.innerHTML = '';
            pagesData = [];
            
            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                
                // Get the original rotation of the page
                const originalRotation = page.rotate || 0;
                
                const viewport = page.getViewport({ scale: CONFIG.thumbnailScale, rotation: originalRotation });
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                
                const blobUrl = canvas.toDataURL('image/jpeg', 0.8);
                
                pagesData.push({
                    id: 'page_' + pageNum,
                    originalIndex: pageNum - 1, // 0-based for pdf-lib
                    displayNumber: pageNum,
                    rotation: 0, // Additional rotation applied by user
                    isDeleted: false,
                    imgSrc: blobUrl
                });
            }
            
            renderGrid();
            
        } catch (error) {
            console.error('Error rendering thumbnails:', error);
            pageGrid.innerHTML = '<div style="grid-column: 1 / -1; color: red;">เกิดข้อผิดพลาดในการโหลดหน้ากระดาษ</div>';
        }
    }

    function renderGrid() {
        pageGrid.innerHTML = '';
        
        pagesData.forEach((pageData, currentIndex) => {
            const pageItem = document.createElement('div');
            pageItem.className = 'page-item' + (pageData.isDeleted ? ' is-deleted' : '');
            pageItem.draggable = true;
            pageItem.dataset.id = pageData.id;
            pageItem.dataset.index = currentIndex;
            
            const imgContainer = document.createElement('div');
            imgContainer.style.position = 'relative';
            
            const img = document.createElement('img');
            img.src = pageData.imgSrc;
            img.style.transform = `rotate(${pageData.rotation}deg)`;
            imgContainer.appendChild(img);
            
            const overlay = document.createElement('div');
            overlay.className = 'deleted-overlay';
            overlay.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
            imgContainer.appendChild(overlay);
            
            pageItem.appendChild(imgContainer);
            
            const label = document.createElement('div');
            label.className = 'page-label';
            label.textContent = 'หน้า ' + pageData.displayNumber;
            pageItem.appendChild(label);
            
            const controls = document.createElement('div');
            controls.className = 'page-controls';
            
            // Rotate Button
            const rotateBtn = document.createElement('button');
            rotateBtn.className = 'btn-icon';
            rotateBtn.title = 'หมุนหน้า';
            rotateBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
            rotateBtn.onclick = (e) => {
                e.stopPropagation();
                pageData.rotation = (pageData.rotation + 90) % 360;
                img.style.transform = `rotate(${pageData.rotation}deg)`;
            };
            controls.appendChild(rotateBtn);
            
            // Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-icon delete';
            deleteBtn.title = 'ลบหน้า';
            deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                pageData.isDeleted = true;
                pageItem.classList.add('is-deleted');
            };
            controls.appendChild(deleteBtn);

            // Restore Button
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'btn-icon restore';
            restoreBtn.title = 'กู้คืนหน้า';
            restoreBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>';
            restoreBtn.onclick = (e) => {
                e.stopPropagation();
                pageData.isDeleted = false;
                pageItem.classList.remove('is-deleted');
            };
            controls.appendChild(restoreBtn);
            
            pageItem.appendChild(controls);
            pageGrid.appendChild(pageItem);
        });

        setupDragAndDrop();
    }

    function setupDragAndDrop() {
        const items = document.querySelectorAll('.page-item');
        let draggedItem = null;

        items.forEach(item => {
            item.addEventListener('dragstart', function (e) {
                draggedItem = this;
                setTimeout(() => this.classList.add('dragging'), 0);
            });

            item.addEventListener('dragend', function () {
                this.classList.remove('dragging');
                draggedItem = null;
                updatePagesOrder();
            });

            item.addEventListener('dragover', function (e) {
                e.preventDefault();
                if (draggedItem && draggedItem !== this) {
                    const bounding = this.getBoundingClientRect();
                    const offset = bounding.y + (bounding.height / 2);
                    if (e.clientY - offset > 0) {
                        this.style.borderRight = '2px solid var(--primary-color)';
                        this.style.borderLeft = '';
                    } else {
                        this.style.borderLeft = '2px solid var(--primary-color)';
                        this.style.borderRight = '';
                    }
                }
            });

            item.addEventListener('dragleave', function () {
                this.style.borderLeft = '';
                this.style.borderRight = '';
            });

            item.addEventListener('drop', function (e) {
                e.preventDefault();
                this.style.borderLeft = '';
                this.style.borderRight = '';
                
                if (draggedItem && draggedItem !== this) {
                    const bounding = this.getBoundingClientRect();
                    const offset = bounding.y + (bounding.height / 2);
                    if (e.clientY - offset > 0) {
                        this.parentNode.insertBefore(draggedItem, this.nextSibling);
                    } else {
                        this.parentNode.insertBefore(draggedItem, this);
                    }
                }
            });
        });
    }

    function updatePagesOrder() {
        const newPagesData = [];
        const items = document.querySelectorAll('.page-item');
        
        items.forEach((item, index) => {
            const id = item.dataset.id;
            const originalData = pagesData.find(p => p.id === id);
            if (originalData) {
                newPagesData.push(originalData);
                item.dataset.index = index;
            }
        });
        
        pagesData = newPagesData;
    }

    function resetConverter() {
        selectedFile = null;
        selectedFileArrayBuffer = null;
        pagesData = [];
        resultBlob = null;
        fileInput.value = '';

        uploadArea.classList.remove('hidden');
        converterSection.classList.add('hidden');
        progressFill.style.width = '0%';
    }

    // ========================================
    // PDF Processing
    // ========================================

    async function processPdf() {
        if (typeof PDFLib === 'undefined') {
            alert('เกิดข้อผิดพลาด: ไม่สามารถโหลด PDF-lib library ได้');
            return;
        }

        // Count active pages
        const activePages = pagesData.filter(p => !p.isDeleted);
        if (activePages.length === 0) {
            alert('กรุณาเลือกอย่างน้อย 1 หน้าที่ไม่ได้ถูกลบ');
            return;
        }

        try {
            actionButtons.classList.add('hidden');
            progressContainer.classList.remove('hidden');

            updateProgress(20, 'กำลังโหลดไฟล์ PDF...');

            // Read fresh to avoid detached buffer issues
            const freshArrayBuffer = await selectedFile.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.load(freshArrayBuffer);
            
            const newPdf = await PDFLib.PDFDocument.create();
            
            updateProgress(50, 'กำลังจัดเรียงและหมุนหน้า PDF...');
            
            for (let i = 0; i < activePages.length; i++) {
                const pageData = activePages[i];
                
                const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageData.originalIndex]);
                
                // Apply rotation if needed
                if (pageData.rotation !== 0) {
                    const currentRotation = copiedPage.getRotation().angle;
                    copiedPage.setRotation(PDFLib.degrees(currentRotation + pageData.rotation));
                }
                
                newPdf.addPage(copiedPage);
                
                updateProgress(50 + Math.round((i / activePages.length) * 30), `กำลังจัดการหน้าที่ ${i + 1}...`);
            }
            
            updateProgress(85, 'กำลังบันทึกไฟล์ PDF...');
            const pdfBytes = await newPdf.save();
            resultBlob = new Blob([pdfBytes], { type: 'application/pdf' });
            resultFileName = selectedFile.name.replace('.pdf', '') + '_organized.pdf';

            updateProgress(100, 'ประมวลผลสำเร็จ!');

            progressContainer.classList.add('hidden');
            downloadSection.classList.remove('hidden');

            // Update download button text
            const sizeStr = formatFileSize(resultBlob.size);
            downloadBtn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
                ' ดาวน์โหลด PDF (' + sizeStr + ')';

        } catch (error) {
            console.error('Error organizing PDF:', error);
            alert('เกิดข้อผิดพลาดในการจัดการไฟล์ PDF: ' + error.message);
            actionButtons.classList.remove('hidden');
            progressContainer.classList.add('hidden');
        }
    }

    // ========================================
    // Utility Functions
    // ========================================

    function updateProgress(percent, message) {
        progressFill.style.width = percent + '%';
        progressText.textContent = message;
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    console.log('Organize PDF initialized');

})();