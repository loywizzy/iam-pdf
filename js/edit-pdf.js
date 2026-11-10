/**
 * i-am pdf - Interactive PDF Editor
 * Full Client-Side PDF Annotation, Drawing, Signing & Export Engine
 * Powered by PDF.js (Rendering) & PDF-Lib (Export/Manipulation)
 */

(function () {
    'use strict';

    // Verify page context
    const editorSection = document.getElementById('editor-section');
    if (!editorSection) return;

    // ==========================================
    // Configuration & Constants
    // ==========================================
    const CONFIG = {
        maxFileSize: 100 * 1024 * 1024, // 100MB
        defaultZoom: 1.0,
        minZoom: 0.5,
        maxZoom: 2.2,
        zoomStep: 0.15
    };

    // ==========================================
    // Application State
    // ==========================================
    const state = {
        file: null,
        pdfBytes: null,
        pdfDocJs: null,
        totalPages: 0,
        currentPage: 1,
        zoom: CONFIG.defaultZoom,
        pageViewport: null,
        
        // Tool & Inspector State
        currentTool: 'select', // 'select' | 'text' | 'pen' | 'highlighter' | 'rect' | 'redact'
        activeColor: '#111827',
        activeSize: 4,
        
        // Annotations Store: Map of pageNumber (1-based) => Array<Annotation>
        annotations: {},
        
        // History Stack for Undo/Redo
        history: [],
        redoStack: [],
        
        // Active Selection
        selectedAnnotation: null,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragInitialX: 0,
        dragInitialY: 0,
        
        // Drawing in Progress
        isDrawing: false,
        currentPath: []
    };

    // ==========================================
    // DOM Elements
    // ==========================================
    const heroSection = document.getElementById('hero-section');
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    // Top Controls
    const docFilename = document.getElementById('doc-filename');
    const pageNumDisplay = document.getElementById('page-num-display');
    const btnPrevPage = document.getElementById('btn-prev-page');
    const btnNextPage = document.getElementById('btn-next-page');
    const zoomVal = document.getElementById('zoom-val');
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const btnChangeFile = document.getElementById('btn-change-file');
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const exportProgress = document.getElementById('export-progress');
    const exportProgressFill = document.getElementById('export-progress-fill');
    const exportProgressText = document.getElementById('export-progress-text');

    // Sidebar & Viewport
    const editorSidebar = document.getElementById('editor-sidebar');
    const thumbnailList = document.getElementById('thumbnail-list');
    const totalPagesCount = document.getElementById('total-pages-count');
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const canvasContainer = document.getElementById('canvas-container');
    const pdfRenderCanvas = document.getElementById('pdf-render-canvas');
    const pdfCtx = pdfRenderCanvas.getContext('2d');
    const annotationCanvas = document.getElementById('annotation-canvas');
    const annoCtx = annotationCanvas.getContext('2d');

    // Ribbon & Properties
    const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
    const toolDeleteActive = document.getElementById('tool-delete-active');
    const propertiesBar = document.getElementById('properties-bar');
    const colorDots = document.querySelectorAll('.color-dot');
    const customColorPicker = document.getElementById('custom-color-picker');
    const sizeSelector = document.getElementById('size-selector');

    // Modals
    const signatureModal = document.getElementById('signature-modal');
    const signatureCanvas = document.getElementById('signature-canvas');
    const sigCtx = signatureCanvas ? signatureCanvas.getContext('2d') : null;
    const btnCloseSig = document.getElementById('btn-close-sig');
    const btnCancelSig = document.getElementById('btn-cancel-sig');
    const btnClearSig = document.getElementById('btn-clear-sig');
    const btnSaveSig = document.getElementById('btn-save-sig');

    const stampModal = document.getElementById('stamp-modal');
    const btnCloseStamp = document.getElementById('btn-close-stamp');
    const btnCancelStamp = document.getElementById('btn-cancel-stamp');
    const stampOptions = document.querySelectorAll('.stamp-option');

    // ==========================================
    // File Handling & Initialization
    // ==========================================
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    btnChangeFile.addEventListener('click', () => {
        if (confirm('คุณต้องการเปลี่ยนไฟล์หรือไม่? การแก้ไขที่ยังไม่ได้บันทึกจะหายไป')) {
            resetEditor();
        }
    });

    function resetEditor() {
        state.file = null;
        state.pdfBytes = null;
        state.pdfDocJs = null;
        state.totalPages = 0;
        state.currentPage = 1;
        state.annotations = {};
        state.history = [];
        state.redoStack = [];
        state.selectedAnnotation = null;

        fileInput.value = '';
        editorSection.classList.add('hidden');
        heroSection.classList.remove('hidden');
    }

    async function handleFileUpload(file) {
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            alert('กรุณาเลือกไฟล์ PDF เท่านั้น');
            return;
        }

        if (file.size > CONFIG.maxFileSize) {
            alert('ขนาดไฟล์ต้องไม่เกิน 100MB');
            return;
        }

        state.file = file;
        docFilename.textContent = file.name;

        try {
            const arrayBuffer = await file.arrayBuffer();
            state.pdfBytes = arrayBuffer;

            // Load with PDF.js
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
            state.pdfDocJs = await loadingTask.promise;
            state.totalPages = state.pdfDocJs.numPages;

            totalPagesCount.textContent = state.totalPages;
            state.currentPage = 1;
            state.zoom = CONFIG.defaultZoom;
            state.annotations = {};

            // Initialize empty annotation lists for all pages
            for (let i = 1; i <= state.totalPages; i++) {
                state.annotations[i] = [];
            }

            // Switch Views
            heroSection.classList.add('hidden');
            editorSection.classList.remove('hidden');

            // Render Thumbnails and First Page
            await renderThumbnails();
            await renderCurrentPage();
            updateHistoryButtons();
        } catch (err) {
            console.error('Error loading PDF:', err);
            alert('เกิดข้อผิดพลาดในการเปิดไฟล์ PDF: ' + (err.message || 'ไฟล์อาจเสียหายหรือติดรหัสผ่าน'));
        }
    }

    // ==========================================
    // Page Rendering Engine
    // ==========================================
    async function renderCurrentPage() {
        if (!state.pdfDocJs) return;

        pageNumDisplay.textContent = `${state.currentPage} / ${state.totalPages}`;
        zoomVal.textContent = `${Math.round(state.zoom * 100)}%`;
        btnPrevPage.disabled = state.currentPage <= 1;
        btnNextPage.disabled = state.currentPage >= state.totalPages;

        // Highlight active thumbnail
        document.querySelectorAll('.thumb-item').forEach((item, idx) => {
            if (idx + 1 === state.currentPage) {
                item.classList.add('active');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });

        // Fetch page from PDF.js
        const page = await state.pdfDocJs.getPage(state.currentPage);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        state.pageViewport = unscaledViewport;

        // Calculate viewport with scale & DPR for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        const scale = state.zoom;
        const viewport = page.getViewport({ scale: scale * dpr });

        // Set dimensions
        const displayWidth = Math.round(unscaledViewport.width * scale);
        const displayHeight = Math.round(unscaledViewport.height * scale);

        canvasContainer.style.width = displayWidth + 'px';
        canvasContainer.style.height = displayHeight + 'px';

        pdfRenderCanvas.width = viewport.width;
        pdfRenderCanvas.height = viewport.height;
        pdfRenderCanvas.style.width = displayWidth + 'px';
        pdfRenderCanvas.style.height = displayHeight + 'px';

        annotationCanvas.width = viewport.width;
        annotationCanvas.height = viewport.height;
        annotationCanvas.style.width = displayWidth + 'px';
        annotationCanvas.style.height = displayHeight + 'px';

        // Render PDF base canvas
        const renderContext = {
            canvasContext: pdfCtx,
            viewport: viewport
        };
        await page.render(renderContext).promise;

        // Render Annotations
        redrawAnnotations();
    }

    // ==========================================
    // Sidebar Thumbnails Generator
    // ==========================================
    async function renderThumbnails() {
        thumbnailList.innerHTML = '';

        for (let i = 1; i <= state.totalPages; i++) {
            const pageNum = i;
            const thumbItem = document.createElement('div');
            thumbItem.className = 'thumb-item' + (pageNum === state.currentPage ? ' active' : '');
            thumbItem.dataset.page = pageNum;

            const canvasWrapper = document.createElement('div');
            canvasWrapper.className = 'thumb-canvas-wrapper';

            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.className = 'thumb-canvas';
            canvasWrapper.appendChild(thumbCanvas);

            const meta = document.createElement('div');
            meta.className = 'thumb-meta';
            meta.innerHTML = `<span>หน้า ${pageNum}</span>`;

            thumbItem.appendChild(canvasWrapper);
            thumbItem.appendChild(meta);

            thumbItem.addEventListener('click', () => {
                if (state.currentPage !== pageNum) {
                    state.currentPage = pageNum;
                    state.selectedAnnotation = null;
                    renderCurrentPage();
                }
            });

            thumbnailList.appendChild(thumbItem);

            // Async render thumbnail image
            (async () => {
                try {
                    const page = await state.pdfDocJs.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 0.25 });
                    thumbCanvas.width = viewport.width;
                    thumbCanvas.height = viewport.height;
                    const ctx = thumbCanvas.getContext('2d');
                    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                } catch (e) {
                    console.warn(`Could not render thumbnail for page ${pageNum}`, e);
                }
            })();
        }
    }

    btnToggleSidebar.addEventListener('click', () => {
        editorSidebar.classList.toggle('collapsed');
    });

    // ==========================================
    // Zoom & Navigation Controls
    // ==========================================
    btnPrevPage.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            state.selectedAnnotation = null;
            renderCurrentPage();
        }
    });

    btnNextPage.addEventListener('click', () => {
        if (state.currentPage < state.totalPages) {
            state.currentPage++;
            state.selectedAnnotation = null;
            renderCurrentPage();
        }
    });

    btnZoomIn.addEventListener('click', () => {
        if (state.zoom < CONFIG.maxZoom) {
            state.zoom = Math.min(CONFIG.maxZoom, state.zoom + CONFIG.zoomStep);
            renderCurrentPage();
        }
    });

    btnZoomOut.addEventListener('click', () => {
        if (state.zoom > CONFIG.minZoom) {
            state.zoom = Math.max(CONFIG.minZoom, state.zoom - CONFIG.zoomStep);
            renderCurrentPage();
        }
    });

    // ==========================================
    // Ribbon Tools & Properties
    // ==========================================
    toolButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.dataset.tool;

            if (tool === 'signature') {
                openSignatureModal();
                return;
            }

            if (tool === 'stamp') {
                openStampModal();
                return;
            }

            setActiveTool(tool);
        });
    });

    function setActiveTool(tool) {
        state.currentTool = tool;
        state.selectedAnnotation = null;

        toolButtons.forEach(b => {
            if (b.dataset.tool === tool) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });

        // Set cursor style
        if (tool === 'select') {
            annotationCanvas.style.cursor = 'default';
        } else if (tool === 'text') {
            annotationCanvas.style.cursor = 'text';
        } else if (tool === 'pen' || tool === 'highlighter') {
            annotationCanvas.style.cursor = 'crosshair';
        } else {
            annotationCanvas.style.cursor = 'crosshair';
        }

        redrawAnnotations();
    }

    // Color Pickers
    colorDots.forEach(dot => {
        dot.addEventListener('click', () => {
            colorDots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            state.activeColor = dot.dataset.color;
            customColorPicker.value = state.activeColor;

            if (state.selectedAnnotation && state.selectedAnnotation.color !== undefined) {
                pushHistory();
                state.selectedAnnotation.color = state.activeColor;
                redrawAnnotations();
            }
        });
    });

    customColorPicker.addEventListener('input', (e) => {
        colorDots.forEach(d => d.classList.remove('active'));
        state.activeColor = e.target.value;

        if (state.selectedAnnotation && state.selectedAnnotation.color !== undefined) {
            pushHistory();
            state.selectedAnnotation.color = state.activeColor;
            redrawAnnotations();
        }
    });

    sizeSelector.addEventListener('change', (e) => {
        state.activeSize = parseInt(e.target.value, 10);

        if (state.selectedAnnotation) {
            pushHistory();
            if (state.selectedAnnotation.type === 'text') {
                state.selectedAnnotation.fontSize = Math.max(14, state.activeSize * 3);
            } else if (state.selectedAnnotation.width !== undefined) {
                state.selectedAnnotation.strokeWidth = state.activeSize;
            }
            redrawAnnotations();
        }
    });

    toolDeleteActive.addEventListener('click', () => {
        deleteActiveAnnotation();
    });

    function deleteActiveAnnotation() {
        if (!state.selectedAnnotation) return;
        const pageAnnos = state.annotations[state.currentPage] || [];
        const idx = pageAnnos.indexOf(state.selectedAnnotation);
        if (idx !== -1) {
            pushHistory();
            pageAnnos.splice(idx, 1);
            state.selectedAnnotation = null;
            redrawAnnotations();
        }
    }

    // ==========================================
    // History (Undo / Redo)
    // ==========================================
    function pushHistory() {
        // Deep clone current page annotations
        const snapshot = JSON.parse(JSON.stringify(state.annotations[state.currentPage] || []));
        state.history.push({
            page: state.currentPage,
            annotations: snapshot
        });
        state.redoStack = [];
        updateHistoryButtons();
    }

    btnUndo.addEventListener('click', undo);
    btnRedo.addEventListener('click', redo);

    function undo() {
        if (state.history.length === 0) return;
        const lastEntry = state.history.pop();
        
        // Save current for redo
        const currentSnapshot = JSON.parse(JSON.stringify(state.annotations[lastEntry.page] || []));
        state.redoStack.push({
            page: lastEntry.page,
            annotations: currentSnapshot
        });

        state.annotations[lastEntry.page] = lastEntry.annotations;
        state.selectedAnnotation = null;
        updateHistoryButtons();

        if (state.currentPage === lastEntry.page) {
            redrawAnnotations();
        } else {
            state.currentPage = lastEntry.page;
            renderCurrentPage();
        }
    }

    function redo() {
        if (state.redoStack.length === 0) return;
        const nextEntry = state.redoStack.pop();

        const currentSnapshot = JSON.parse(JSON.stringify(state.annotations[nextEntry.page] || []));
        state.history.push({
            page: nextEntry.page,
            annotations: currentSnapshot
        });

        state.annotations[nextEntry.page] = nextEntry.annotations;
        state.selectedAnnotation = null;
        updateHistoryButtons();

        if (state.currentPage === nextEntry.page) {
            redrawAnnotations();
        } else {
            state.currentPage = nextEntry.page;
            renderCurrentPage();
        }
    }

    function updateHistoryButtons() {
        btnUndo.disabled = state.history.length === 0;
        btnRedo.disabled = state.redoStack.length === 0;
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        // Ignore if user is inside a form input
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            if (e.shiftKey) {
                redo();
            } else {
                undo();
            }
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
            e.preventDefault();
            redo();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (state.selectedAnnotation) {
                e.preventDefault();
                deleteActiveAnnotation();
            }
        } else if (e.key === 'v' || e.key === 'V') {
            setActiveTool('select');
        } else if (e.key === 't' || e.key === 'T') {
            setActiveTool('text');
        } else if (e.key === 'p' || e.key === 'P') {
            setActiveTool('pen');
        } else if (e.key === 'h' || e.key === 'H') {
            setActiveTool('highlighter');
        } else if (e.key === 's' || e.key === 'S') {
            openSignatureModal();
        }
    });

    // ==========================================
    // Interactive Canvas Event Handling
    // ==========================================
    function getCanvasCoords(e) {
        const rect = annotationCanvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);

        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Convert to unscaled PDF points
        const scale = state.zoom;
        return {
            x: x / scale,
            y: y / scale
        };
    }

    annotationCanvas.addEventListener('mousedown', handlePointerDown);
    annotationCanvas.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    annotationCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            handlePointerDown(e);
        }
    }, { passive: false });

    annotationCanvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            e.preventDefault();
            handlePointerMove(e);
        }
    }, { passive: false });

    window.addEventListener('touchend', handlePointerUp);

    function handlePointerDown(e) {
        if (!state.pdfDocJs) return;
        const coords = getCanvasCoords(e);
        const pageAnnos = state.annotations[state.currentPage] || [];

        if (state.currentTool === 'select') {
            // Check hit test in reverse (topmost first)
            let hit = null;
            for (let i = pageAnnos.length - 1; i >= 0; i--) {
                const anno = pageAnnos[i];
                if (hitTest(anno, coords.x, coords.y)) {
                    hit = anno;
                    break;
                }
            }

            state.selectedAnnotation = hit;
            if (hit) {
                state.isDragging = true;
                state.dragStartX = coords.x;
                state.dragStartY = coords.y;
                state.dragInitialX = hit.x || 0;
                state.dragInitialY = hit.y || 0;
            }
            redrawAnnotations();
        } else if (state.currentTool === 'pen' || state.currentTool === 'highlighter') {
            pushHistory();
            state.isDrawing = true;
            state.currentPath = [coords];
        } else if (state.currentTool === 'text') {
            const inputVal = prompt('พิมพ์ข้อความที่ต้องการใส่ลงในเอกสาร:');
            if (inputVal && inputVal.trim()) {
                pushHistory();
                pageAnnos.push({
                    type: 'text',
                    x: coords.x,
                    y: coords.y,
                    text: inputVal.trim(),
                    fontSize: Math.max(16, state.activeSize * 4),
                    color: state.activeColor
                });
                redrawAnnotations();
            }
        } else if (state.currentTool === 'rect' || state.currentTool === 'redact') {
            pushHistory();
            const isRedact = state.currentTool === 'redact';
            pageAnnos.push({
                type: 'rect',
                x: coords.x,
                y: coords.y,
                width: 140,
                height: 40,
                color: isRedact ? '#FFFFFF' : state.activeColor,
                fillColor: isRedact ? '#FFFFFF' : 'transparent',
                strokeWidth: isRedact ? 0 : state.activeSize,
                isRedact: isRedact
            });
            redrawAnnotations();
        }
    }

    function handlePointerMove(e) {
        if (!state.pdfDocJs) return;
        const coords = getCanvasCoords(e);

        if (state.isDragging && state.selectedAnnotation) {
            const dx = coords.x - state.dragStartX;
            const dy = coords.y - state.dragStartY;
            
            if (state.selectedAnnotation.points) {
                // Shift freehand path
                if (!state.selectedAnnotation._dragInitPoints) {
                    state.selectedAnnotation._dragInitPoints = JSON.parse(JSON.stringify(state.selectedAnnotation.points));
                }
                state.selectedAnnotation.points = state.selectedAnnotation._dragInitPoints.map(p => ({
                    x: p.x + dx,
                    y: p.y + dy
                }));
            } else {
                state.selectedAnnotation.x = state.dragInitialX + dx;
                state.selectedAnnotation.y = state.dragInitialY + dy;
            }
            redrawAnnotations();
        } else if (state.isDrawing) {
            state.currentPath.push(coords);
            renderActiveDrawing();
        }
    }

    function handlePointerUp() {
        if (state.isDragging && state.selectedAnnotation) {
            state.isDragging = false;
            if (state.selectedAnnotation._dragInitPoints) {
                delete state.selectedAnnotation._dragInitPoints;
            }
            pushHistory();
        }

        if (state.isDrawing) {
            state.isDrawing = false;
            if (state.currentPath.length > 1) {
                const pageAnnos = state.annotations[state.currentPage] || [];
                const isHighlight = state.currentTool === 'highlighter';

                pageAnnos.push({
                    type: 'freehand',
                    points: state.currentPath,
                    color: isHighlight ? '#FACC15' : state.activeColor,
                    strokeWidth: isHighlight ? 18 : state.activeSize,
                    isHighlight: isHighlight
                });
            }
            state.currentPath = [];
            redrawAnnotations();
        }
    }

    // Hit Testing for selecting annotations
    function hitTest(anno, px, py) {
        const threshold = 12;
        if (anno.type === 'text') {
            annoCtx.font = `${anno.fontSize}px Inter, sans-serif`;
            const textWidth = annoCtx.measureText(anno.text).width;
            const textHeight = anno.fontSize;
            return px >= anno.x && px <= anno.x + textWidth &&
                   py >= anno.y - textHeight && py <= anno.y + textHeight * 0.3;
        } else if (anno.type === 'rect') {
            return px >= anno.x && px <= anno.x + anno.width &&
                   py >= anno.y && py <= anno.y + anno.height;
        } else if (anno.type === 'image') {
            return px >= anno.x && px <= anno.x + anno.width &&
                   py >= anno.y && py <= anno.y + anno.height;
        } else if (anno.type === 'freehand') {
            for (const pt of anno.points) {
                const dist = Math.hypot(pt.x - px, pt.y - py);
                if (dist <= threshold + (anno.strokeWidth / 2)) return true;
            }
        }
        return false;
    }

    // ==========================================
    // Redraw Annotation Canvas
    // ==========================================
    function redrawAnnotations() {
        annoCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
        const pageAnnos = state.annotations[state.currentPage] || [];
        const dpr = window.devicePixelRatio || 1;
        const scale = state.zoom * dpr;

        annoCtx.save();
        annoCtx.scale(scale, scale);

        pageAnnos.forEach(anno => {
            drawSingleAnnotation(annoCtx, anno);
        });

        // Draw Selection Bounding Box
        if (state.selectedAnnotation && state.currentTool === 'select') {
            drawSelectionBox(annoCtx, state.selectedAnnotation);
        }

        annoCtx.restore();
    }

    function renderActiveDrawing() {
        if (!state.isDrawing || state.currentPath.length < 2) return;
        redrawAnnotations();

        const dpr = window.devicePixelRatio || 1;
        const scale = state.zoom * dpr;

        annoCtx.save();
        annoCtx.scale(scale, scale);

        const isHighlight = state.currentTool === 'highlighter';
        annoCtx.strokeStyle = isHighlight ? 'rgba(250, 204, 21, 0.45)' : state.activeColor;
        annoCtx.lineWidth = isHighlight ? 18 : state.activeSize;
        annoCtx.lineCap = 'round';
        annoCtx.lineJoin = 'round';

        annoCtx.beginPath();
        annoCtx.moveTo(state.currentPath[0].x, state.currentPath[0].y);
        for (let i = 1; i < state.currentPath.length; i++) {
            annoCtx.lineTo(state.currentPath[i].x, state.currentPath[i].y);
        }
        annoCtx.stroke();
        annoCtx.restore();
    }

    function drawSingleAnnotation(ctx, anno) {
        ctx.save();

        if (anno.type === 'text') {
            ctx.font = `600 ${anno.fontSize}px Inter, sans-serif`;
            ctx.fillStyle = anno.color;
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(anno.text, anno.x, anno.y);
        } else if (anno.type === 'freehand') {
            if (anno.points.length < 2) {
                ctx.restore();
                return;
            }
            if (anno.isHighlight) {
                ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
                ctx.globalCompositeOperation = 'multiply';
            } else {
                ctx.strokeStyle = anno.color;
            }
            ctx.lineWidth = anno.strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            ctx.moveTo(anno.points[0].x, anno.points[0].y);
            for (let i = 1; i < anno.points.length; i++) {
                ctx.lineTo(anno.points[i].x, anno.points[i].y);
            }
            ctx.stroke();
        } else if (anno.type === 'rect') {
            if (anno.isRedact) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(anno.x, anno.y, anno.width, anno.height);
                ctx.strokeStyle = '#E2E8F0';
                ctx.lineWidth = 1;
                ctx.strokeRect(anno.x, anno.y, anno.width, anno.height);
            } else {
                ctx.strokeStyle = anno.color;
                ctx.lineWidth = anno.strokeWidth;
                ctx.strokeRect(anno.x, anno.y, anno.width, anno.height);
            }
        } else if (anno.type === 'image') {
            if (anno.imgElement && anno.imgElement.complete) {
                ctx.drawImage(anno.imgElement, anno.x, anno.y, anno.width, anno.height);
            }
        }

        ctx.restore();
    }

    function drawSelectionBox(ctx, anno) {
        ctx.save();
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);

        let box = { x: 0, y: 0, w: 0, h: 0 };
        if (anno.type === 'text') {
            ctx.font = `600 ${anno.fontSize}px Inter, sans-serif`;
            const textWidth = ctx.measureText(anno.text).width;
            box = {
                x: anno.x - 4,
                y: anno.y - anno.fontSize - 2,
                w: textWidth + 8,
                h: anno.fontSize + 8
            };
        } else if (anno.type === 'rect' || anno.type === 'image') {
            box = {
                x: anno.x - 4,
                y: anno.y - 4,
                w: anno.width + 8,
                h: anno.height + 8
            };
        } else if (anno.type === 'freehand') {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            anno.points.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });
            box = {
                x: minX - 6,
                y: minY - 6,
                w: (maxX - minX) + 12,
                h: (maxY - minY) + 12
            };
        }

        ctx.strokeRect(box.x, box.y, box.w, box.h);

        // Corner handles
        ctx.fillStyle = '#DC2626';
        ctx.setLineDash([]);
        const handleSize = 6;
        ctx.fillRect(box.x - handleSize/2, box.y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(box.x + box.w - handleSize/2, box.y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(box.x - handleSize/2, box.y + box.h - handleSize/2, handleSize, handleSize);
        ctx.fillRect(box.x + box.w - handleSize/2, box.y + box.h - handleSize/2, handleSize, handleSize);

        ctx.restore();
    }

    // ==========================================
    // Signature Pad Modal
    // ==========================================
    let isSigDrawing = false;

    function openSignatureModal() {
        signatureModal.classList.add('open');
        signatureCanvas.width = signatureCanvas.parentElement.clientWidth;
        signatureCanvas.height = 200;
        sigCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
        sigCtx.strokeStyle = '#111827';
        sigCtx.lineWidth = 3;
        sigCtx.lineCap = 'round';
        sigCtx.lineJoin = 'round';
    }

    function closeSignatureModal() {
        signatureModal.classList.remove('open');
    }

    btnCloseSig.addEventListener('click', closeSignatureModal);
    btnCancelSig.addEventListener('click', closeSignatureModal);
    btnClearSig.addEventListener('click', () => {
        sigCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    });

    signatureCanvas.addEventListener('mousedown', (e) => {
        isSigDrawing = true;
        const rect = signatureCanvas.getBoundingClientRect();
        sigCtx.beginPath();
        sigCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    });

    signatureCanvas.addEventListener('mousemove', (e) => {
        if (!isSigDrawing) return;
        const rect = signatureCanvas.getBoundingClientRect();
        sigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        sigCtx.stroke();
    });

    window.addEventListener('mouseup', () => { isSigDrawing = false; });

    // Touch support for signature pad
    signatureCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isSigDrawing = true;
            const rect = signatureCanvas.getBoundingClientRect();
            sigCtx.beginPath();
            sigCtx.moveTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
        }
    }, { passive: false });

    signatureCanvas.addEventListener('touchmove', (e) => {
        if (isSigDrawing && e.touches.length === 1) {
            e.preventDefault();
            const rect = signatureCanvas.getBoundingClientRect();
            sigCtx.lineTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
            sigCtx.stroke();
        }
    }, { passive: false });

    btnSaveSig.addEventListener('click', () => {
        const dataUrl = signatureCanvas.toDataURL('image/png');
        const img = new Image();
        img.onload = () => {
            pushHistory();
            const pageAnnos = state.annotations[state.currentPage] || [];
            pageAnnos.push({
                type: 'image',
                x: 100,
                y: 200,
                width: 180,
                height: 80,
                imgElement: img,
                dataUrl: dataUrl
            });
            closeSignatureModal();
            setActiveTool('select');
            redrawAnnotations();
        };
        img.src = dataUrl;
    });

    // ==========================================
    // Stamps Modal
    // ==========================================
    function openStampModal() {
        stampModal.classList.add('open');
    }

    function closeStampModal() {
        stampModal.classList.remove('open');
    }

    btnCloseStamp.addEventListener('click', closeStampModal);
    btnCancelStamp.addEventListener('click', closeStampModal);

    stampOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            const stampText = opt.dataset.stamp;
            let strokeColor = '#059669';
            if (stampText === 'CONFIDENTIAL') strokeColor = '#DC2626';
            if (stampText === 'DRAFT') strokeColor = '#D97706';
            if (stampText === 'COMPLETED') strokeColor = '#2563EB';

            // Generate stamp image on offscreen canvas
            const stampCanvas = document.createElement('canvas');
            stampCanvas.width = 240;
            stampCanvas.height = 70;
            const sctx = stampCanvas.getContext('2d');

            sctx.strokeStyle = strokeColor;
            sctx.lineWidth = 4;
            sctx.strokeRect(4, 4, 232, 62);

            sctx.fillStyle = strokeColor;
            sctx.font = '800 24px Inter, sans-serif';
            sctx.textAlign = 'center';
            sctx.textBaseline = 'middle';
            sctx.fillText(stampText, 120, 35);

            const img = new Image();
            img.onload = () => {
                pushHistory();
                const pageAnnos = state.annotations[state.currentPage] || [];
                pageAnnos.push({
                    type: 'image',
                    x: 150,
                    y: 150,
                    width: 180,
                    height: 52,
                    imgElement: img,
                    dataUrl: stampCanvas.toDataURL('image/png')
                });
                closeStampModal();
                setActiveTool('select');
                redrawAnnotations();
            };
            img.src = stampCanvas.toDataURL('image/png');
        });
    });

    // ==========================================
    // PDF-Lib Backend Export Engine
    // ==========================================
    btnExportPdf.addEventListener('click', exportEditedPdf);

    async function exportEditedPdf() {
        if (!state.pdfBytes) return;

        btnExportPdf.disabled = true;
        exportProgress.classList.remove('hidden');
        exportProgressFill.style.width = '10%';
        exportProgressText.textContent = 'กำลังโหลดเอกสารต้นฉบับ... 10%';

        try {
            // Load original PDF using PDF-Lib
            const pdfDoc = await PDFLib.PDFDocument.load(state.pdfBytes);
            const total = pdfDoc.getPageCount();

            for (let i = 0; i < total; i++) {
                const pageNum = i + 1;
                const percent = Math.round(15 + ((i + 1) / total) * 70);
                exportProgressFill.style.width = percent + '%';
                exportProgressText.textContent = `กำลังผสานการแก้ไขหน้าที่ ${pageNum} จาก ${total}... (${percent}%)`;

                const pageAnnos = state.annotations[pageNum] || [];
                if (pageAnnos.length > 0) {
                    const page = pdfDoc.getPage(i);
                    const pageWidth = page.getWidth();
                    const pageHeight = page.getHeight();

                    // Create High-Res offscreen canvas for rendering page annotations
                    const offscreenCanvas = document.createElement('canvas');
                    const dpr = 2; // 2x crisp rendering for high-res output
                    offscreenCanvas.width = pageWidth * dpr;
                    offscreenCanvas.height = pageHeight * dpr;

                    const octx = offscreenCanvas.getContext('2d');
                    octx.scale(dpr, dpr);

                    // Render all annotations for this page
                    pageAnnos.forEach(anno => {
                        drawSingleAnnotation(octx, anno);
                    });

                    // Convert to PNG and embed into PDF-Lib
                    const pngDataUrl = offscreenCanvas.toDataURL('image/png');
                    const pngImageBytes = await fetch(pngDataUrl).then(res => res.arrayBuffer());
                    const embeddedImage = await pdfDoc.embedPng(pngImageBytes);

                    // Draw image on PDF page
                    page.drawImage(embeddedImage, {
                        x: 0,
                        y: 0,
                        width: pageWidth,
                        height: pageHeight
                    });
                }
            }

            exportProgressFill.style.width = '90%';
            exportProgressText.textContent = 'กำลังสร้างไฟล์ PDF ขั้นสุดท้าย... 90%';

            // Save PDF
            const finalPdfBytes = await pdfDoc.save();

            exportProgressFill.style.width = '100%';
            exportProgressText.textContent = 'เสร็จสมบูรณ์! กำลังดาวน์โหลดไฟล์... 100%';

            // Trigger Download
            const blob = new Blob([finalPdfBytes], { type: 'application/pdf' });
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            const origName = state.file ? state.file.name.replace(/\.pdf$/i, '') : 'document';
            link.href = downloadUrl;
            link.download = `${origName}_edited.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setTimeout(() => {
                URL.revokeObjectURL(downloadUrl);
                exportProgress.classList.add('hidden');
                btnExportPdf.disabled = false;
            }, 2500);

        } catch (err) {
            console.error('Error generating PDF:', err);
            alert('เกิดข้อผิดพลาดในการบันทึกเอกสาร PDF: ' + (err.message || 'กรุณาลองใหม่อีกครั้ง'));
            exportProgress.classList.add('hidden');
            btnExportPdf.disabled = false;
        }
    }

})();
