/**
 * i-am pdf - Add Watermark to PDF
 * Client-side PDF manipulation using pdf-lib
 */

(function () {
    'use strict';

    // Check if we're on the right page
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    if (!uploadArea || !fileInput || !document.querySelector('h1')?.textContent.includes('ใส่ลายน้ำ')) {
        return;
    }

    // ========================================
    // Configuration
    // ========================================
    const CONFIG = {
        maxFileSize: 100 * 1024 * 1024 // 100MB per file
    };

    // ========================================
    // DOM Elements
    // ========================================
    const converterSection = document.getElementById('converter-section');
    const fileNameDisplay = document.getElementById('file-name-display');
    const applyBtn = document.getElementById('apply-btn');
    const resetBtn = document.getElementById('reset-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const downloadSection = document.getElementById('download-section');
    const downloadBtn = document.getElementById('download-btn');
    const actionButtons = document.getElementById('action-buttons');

    // Options Elements
    const watermarkText = document.getElementById('watermark-text');
    const textColor = document.getElementById('text-color');
    const fontSize = document.getElementById('font-size');
    const opacity = document.getElementById('opacity');
    const opacityVal = document.getElementById('opacity-val');
    const rotation = document.getElementById('rotation');
    const rotationVal = document.getElementById('rotation-val');
    const watermarkPreview = document.getElementById('watermark-preview');

    // State
    let selectedFile = null;
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

    if (applyBtn) applyBtn.addEventListener('click', addWatermark);
    if (resetBtn) resetBtn.addEventListener('click', resetConverter);
    
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

    // UI Updates on Options Change
    function updatePreview() {
        watermarkPreview.textContent = watermarkText.value || 'CONFIDENTIAL';
        const colorHex = textColor.value;
        const op = opacity.value;
        const r = parseInt(colorHex.slice(1, 3), 16);
        const g = parseInt(colorHex.slice(3, 5), 16);
        const b = parseInt(colorHex.slice(5, 7), 16);
        
        watermarkPreview.style.color = `rgba(${r}, ${g}, ${b}, ${op})`;
        // Scale down the preview font size relatively
        const scaledFontSize = Math.min(Math.max(fontSize.value / 2, 16), 50); 
        watermarkPreview.style.fontSize = scaledFontSize + 'px';
        watermarkPreview.style.transform = `rotate(-${rotation.value}deg)`;
        
        opacityVal.textContent = op;
        rotationVal.textContent = rotation.value;
    }

    watermarkText.addEventListener('input', updatePreview);
    textColor.addEventListener('input', updatePreview);
    fontSize.addEventListener('input', updatePreview);
    opacity.addEventListener('input', updatePreview);
    rotation.addEventListener('input', updatePreview);

    // ========================================
    // File Handling
    // ========================================

    function handleFileSelect(file) {
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

        resultBlob = null;
        uploadArea.classList.add('hidden');
        converterSection.classList.remove('hidden');
        downloadSection.classList.add('hidden');
        actionButtons.classList.remove('hidden');
        
        updatePreview();
    }

    function resetConverter() {
        selectedFile = null;
        resultBlob = null;
        fileInput.value = '';

        uploadArea.classList.remove('hidden');
        converterSection.classList.add('hidden');
        progressFill.style.width = '0%';
    }

    // ========================================
    // PDF Processing
    // ========================================

    function hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return PDFLib.rgb(r, g, b);
    }

    async function addWatermark() {
        if (typeof PDFLib === 'undefined') {
            alert('เกิดข้อผิดพลาด: ไม่สามารถโหลด PDF-lib library ได้');
            return;
        }

        const text = watermarkText.value.trim();
        if (!text) {
            alert('กรุณากรอกข้อความลายน้ำ');
            return;
        }

        try {
            actionButtons.classList.add('hidden');
            progressContainer.classList.remove('hidden');

            updateProgress(20, 'กำลังโหลดไฟล์ PDF...');

            const arrayBuffer = await selectedFile.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            
            // Register fontkit to support custom fonts if needed in future
            if (typeof fontkit !== 'undefined') {
                pdfDoc.registerFontkit(fontkit);
            }
            
            // For now, use standard font. Support for Thai might require embedding a custom font
            // which can be done by fetching a .ttf file. For this version, standard is used.
            const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
            
            const pages = pdfDoc.getPages();
            
            updateProgress(40, 'กำลังประทับลายน้ำ...');
            
            const color = hexToRgb(textColor.value);
            const size = parseInt(fontSize.value);
            const op = parseFloat(opacity.value);
            // pdf-lib rotation is mathematically positive for counter-clockwise, 
            // but we usually think of positive as clockwise. We'll match our UI preview.
            const angle = PDFLib.degrees(parseInt(rotation.value));

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();
                
                const textWidth = helveticaFont.widthOfTextAtSize(text, size);
                const textHeight = helveticaFont.heightAtSize(size);
                
                // Draw in the center of the page
                page.drawText(text, {
                    x: width / 2 - textWidth / 2,
                    y: height / 2 - textHeight / 2,
                    size: size,
                    font: helveticaFont,
                    color: color,
                    opacity: op,
                    rotate: angle,
                    xSkew: PDFLib.degrees(0),
                    ySkew: PDFLib.degrees(0),
                });
                
                if (i % 10 === 0) {
                    updateProgress(40 + Math.round((i / pages.length) * 40), 'กำลังประทับลายน้ำ...');
                    await new Promise(resolve => setTimeout(resolve, 5));
                }
            }
            
            updateProgress(85, 'กำลังบันทึกไฟล์ PDF...');
            const pdfBytes = await pdfDoc.save();
            resultBlob = new Blob([pdfBytes], { type: 'application/pdf' });
            resultFileName = selectedFile.name.replace('.pdf', '') + '_watermark.pdf';

            updateProgress(100, 'ประมวลผลสำเร็จ!');

            progressContainer.classList.add('hidden');
            downloadSection.classList.remove('hidden');

            const sizeStr = formatFileSize(resultBlob.size);
            downloadBtn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
                ' ดาวน์โหลด PDF (' + sizeStr + ')';

        } catch (error) {
            console.error('Error adding watermark:', error);
            alert('เกิดข้อผิดพลาดในการใส่ลายน้ำ: ' + error.message);
            actionButtons.classList.remove('hidden');
            progressContainer.classList.add('hidden');
        }
    }

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

    console.log('Watermark PDF initialized');

})();