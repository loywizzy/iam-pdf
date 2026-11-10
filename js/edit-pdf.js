/**
 * i-am pdf - Interactive PDF Editor (v2 — Full Rewrite)
 * Full Client-Side PDF Annotation, Drawing, Signing & Export Engine
 * Powered by PDF.js (Rendering) & PDF-Lib (Export/Manipulation)
 *
 * Bug Fixes in v2:
 *  - Text Tool: Inline contenteditable overlay (ไม่ใช้ prompt())
 *  - Rect/Redact: Drag-to-draw (mousedown → drag → mouseup)
 *  - Undo/Redo: รองรับ Image annotations (serialize/deserialize dataUrl)
 *  - Coordinate System: DPR-aware consistent ทั้ง draw + export
 *  - Signature Pad: ใช้ requestAnimationFrame รอ modal visible
 *  - Export: ใช้ atob() แทน fetch(dataUrl) เพื่อหลีกเลี่ยง CORS
 *  - Ctrl+Scroll: Zoom via mouse wheel
 *  - Toast Notifications: แทน alert()
 *  - Freehand: Smooth curves ด้วย quadraticCurveTo
 *  - Text Resize: Resize handles บน selected text annotation
 */

(function () {
    'use strict';

    const editorSection = document.getElementById('editor-section');
    if (!editorSection) return;

    // ==========================================
    // Configuration & Constants
    // ==========================================
    const CONFIG = {
        maxFileSize: 100 * 1024 * 1024,
        defaultZoom: 1.0,
        minZoom: 0.3,
        maxZoom: 3.0,
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

        currentTool: 'select',
        activeColor: '#111827',
        activeSize: 4,

        // Annotations: pageNumber (1-based) => Array<Annotation>
        annotations: {},

        // History
        history: [],
        redoStack: [],

        // Selection & Drag
        selectedAnnotation: null,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragInitialX: 0,
        dragInitialY: 0,
        dragInitPoints: null,

        // Drawing
        isDrawing: false,
        currentPath: [],

        // Rect drag-to-draw
        isRectDrawing: false,
        rectStartX: 0,
        rectStartY: 0,

        // Inline text editor
        activeTextOverlay: null,
        activeTextAnno: null,
    };

    // ==========================================
    // DOM Elements
    // ==========================================
    const heroSection      = document.getElementById('hero-section');
    const uploadArea       = document.getElementById('upload-area');
    const fileInput        = document.getElementById('file-input');

    const docFilename      = document.getElementById('doc-filename');
    const pageNumDisplay   = document.getElementById('page-num-display');
    const btnPrevPage      = document.getElementById('btn-prev-page');
    const btnNextPage      = document.getElementById('btn-next-page');
    const zoomVal          = document.getElementById('zoom-val');
    const btnZoomIn        = document.getElementById('btn-zoom-in');
    const btnZoomOut       = document.getElementById('btn-zoom-out');
    const btnUndo          = document.getElementById('btn-undo');
    const btnRedo          = document.getElementById('btn-redo');
    const btnChangeFile    = document.getElementById('btn-change-file');
    const btnExportPdf     = document.getElementById('btn-export-pdf');
    const exportProgress   = document.getElementById('export-progress');
    const exportProgressFill = document.getElementById('export-progress-fill');
    const exportProgressText = document.getElementById('export-progress-text');

    const editorSidebar    = document.getElementById('editor-sidebar');
    const thumbnailList    = document.getElementById('thumbnail-list');
    const totalPagesCount  = document.getElementById('total-pages-count');
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const canvasContainer  = document.getElementById('canvas-container');
    const pdfRenderCanvas  = document.getElementById('pdf-render-canvas');
    const pdfCtx           = pdfRenderCanvas.getContext('2d');
    const annotationCanvas = document.getElementById('annotation-canvas');
    const annoCtx          = annotationCanvas.getContext('2d');

    const toolButtons      = document.querySelectorAll('.tool-btn[data-tool]');
    const toolDeleteActive = document.getElementById('tool-delete-active');
    const colorDots        = document.querySelectorAll('.color-dot');
    const customColorPicker= document.getElementById('custom-color-picker');
    const sizeSelector     = document.getElementById('size-selector');

    const signatureModal   = document.getElementById('signature-modal');
    const signatureCanvas  = document.getElementById('signature-canvas');
    const sigCtx           = signatureCanvas ? signatureCanvas.getContext('2d') : null;
    const btnCloseSig      = document.getElementById('btn-close-sig');
    const btnCancelSig     = document.getElementById('btn-cancel-sig');
    const btnClearSig      = document.getElementById('btn-clear-sig');
    const btnSaveSig       = document.getElementById('btn-save-sig');

    const stampModal       = document.getElementById('stamp-modal');
    const btnCloseStamp    = document.getElementById('btn-close-stamp');
    const btnCancelStamp   = document.getElementById('btn-cancel-stamp');
    const stampOptions     = document.querySelectorAll('.stamp-option');

    // ==========================================
    // Toast Notification System
    // ==========================================
    function showToast(message, type = 'info', duration = 3500) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed; bottom: 24px; right: 24px; z-index: 9999;
                display: flex; flex-direction: column; gap: 8px; pointer-events: none;
            `;
            document.body.appendChild(container);
        }

        const colors = {
            info:    { bg: '#1E293B', icon: 'ℹ️' },
            success: { bg: '#065F46', icon: '✅' },
            error:   { bg: '#7F1D1D', icon: '❌' },
            warning: { bg: '#78350F', icon: '⚠️' },
        };
        const c = colors[type] || colors.info;

        const toast = document.createElement('div');
        toast.style.cssText = `
            background: ${c.bg}; color: #fff;
            padding: 12px 18px; border-radius: 10px;
            font: 500 14px/1.4 Inter, sans-serif;
            box-shadow: 0 4px 20px rgba(0,0,0,0.35);
            pointer-events: auto; display: flex; align-items: center; gap: 10px;
            max-width: 360px; opacity: 0; transform: translateY(12px);
            transition: opacity 0.25s, transform 0.25s;
        `;
        toast.innerHTML = `<span>${c.icon}</span><span>${message}</span>`;
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(12px)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ==========================================
    // History: Serialize / Deserialize (Image-safe)
    // ==========================================
    function serializeAnnotations(annos) {
        return annos.map(a => {
            const clone = Object.assign({}, a);
            delete clone.imgElement; // HTMLImageElement ไม่ serializable
            if (a.points) clone.points = a.points.map(p => ({ x: p.x, y: p.y }));
            return clone;
        });
    }

    function deserializeAnnotations(annos) {
        return annos.map(a => {
            if (a.dataUrl && !a.imgElement) {
                const img = new Image();
                img.src = a.dataUrl;
                a.imgElement = img;
            }
            return a;
        });
    }

    // ==========================================
    // History (Undo / Redo)
    // ==========================================
    function pushHistory() {
        const snapshot = serializeAnnotations(state.annotations[state.currentPage] || []);
        state.history.push({ page: state.currentPage, annotations: snapshot });
        state.redoStack = [];
        if (state.history.length > 100) state.history.shift(); // ป้องกัน memory leak
        updateHistoryButtons();
    }

    function undo() {
        if (state.history.length === 0) return;
        const lastEntry = state.history.pop();
        const currentSnapshot = serializeAnnotations(state.annotations[lastEntry.page] || []);
        state.redoStack.push({ page: lastEntry.page, annotations: currentSnapshot });

        state.annotations[lastEntry.page] = deserializeAnnotations(lastEntry.annotations);
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
        const currentSnapshot = serializeAnnotations(state.annotations[nextEntry.page] || []);
        state.history.push({ page: nextEntry.page, annotations: currentSnapshot });

        state.annotations[nextEntry.page] = deserializeAnnotations(nextEntry.annotations);
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
        if (btnUndo) btnUndo.disabled = state.history.length === 0;
        if (btnRedo) btnRedo.disabled = state.redoStack.length === 0;
    }

    btnUndo && btnUndo.addEventListener('click', undo);
    btnRedo && btnRedo.addEventListener('click', redo);

    // ==========================================
    // File Handling
    // ==========================================
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) handleFileUpload(e.target.files[0]);
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

    btnChangeFile && btnChangeFile.addEventListener('click', () => {
        if (confirm('คุณต้องการเปลี่ยนไฟล์หรือไม่? การแก้ไขที่ยังไม่ได้บันทึกจะหายไป')) {
            resetEditor();
        }
    });

    function resetEditor() {
        commitTextOverlay(); // commit หรือ cancel inline text
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
            showToast('กรุณาเลือกไฟล์ PDF เท่านั้น', 'error');
            return;
        }
        if (file.size > CONFIG.maxFileSize) {
            showToast('ขนาดไฟล์ต้องไม่เกิน 100MB', 'error');
            return;
        }

        state.file = file;
        if (docFilename) docFilename.textContent = file.name;

        try {
            const arrayBuffer = await file.arrayBuffer();
            state.pdfBytes = arrayBuffer;

            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
            state.pdfDocJs = await loadingTask.promise;
            state.totalPages = state.pdfDocJs.numPages;

            if (totalPagesCount) totalPagesCount.textContent = state.totalPages;
            state.currentPage = 1;
            state.zoom = CONFIG.defaultZoom;
            state.annotations = {};
            for (let i = 1; i <= state.totalPages; i++) state.annotations[i] = [];

            heroSection.classList.add('hidden');
            editorSection.classList.remove('hidden');

            await renderThumbnails();
            await renderCurrentPage();
            updateHistoryButtons();
            showToast(`เปิดไฟล์ "${file.name}" สำเร็จ (${state.totalPages} หน้า)`, 'success');
        } catch (err) {
            console.error('Error loading PDF:', err);
            showToast('เกิดข้อผิดพลาดในการเปิดไฟล์ PDF: ' + (err.message || 'ไฟล์อาจเสียหายหรือติดรหัสผ่าน'), 'error');
        }
    }

    // ==========================================
    // Page Rendering Engine
    // ==========================================
    async function renderCurrentPage() {
        if (!state.pdfDocJs) return;

        if (pageNumDisplay) pageNumDisplay.textContent = `${state.currentPage} / ${state.totalPages}`;
        if (zoomVal) zoomVal.textContent = `${Math.round(state.zoom * 100)}%`;
        if (btnPrevPage) btnPrevPage.disabled = state.currentPage <= 1;
        if (btnNextPage) btnNextPage.disabled = state.currentPage >= state.totalPages;

        document.querySelectorAll('.thumb-item').forEach((item, idx) => {
            const isActive = idx + 1 === state.currentPage;
            item.classList.toggle('active', isActive);
            if (isActive) item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });

        const page = await state.pdfDocJs.getPage(state.currentPage);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        state.pageViewport = unscaledViewport;

        const dpr = window.devicePixelRatio || 1;
        const scale = state.zoom;
        const viewport = page.getViewport({ scale: scale * dpr });

        const displayWidth  = Math.round(unscaledViewport.width * scale);
        const displayHeight = Math.round(unscaledViewport.height * scale);

        canvasContainer.style.width  = displayWidth + 'px';
        canvasContainer.style.height = displayHeight + 'px';

        pdfRenderCanvas.width  = viewport.width;
        pdfRenderCanvas.height = viewport.height;
        pdfRenderCanvas.style.width  = displayWidth + 'px';
        pdfRenderCanvas.style.height = displayHeight + 'px';

        annotationCanvas.width  = viewport.width;
        annotationCanvas.height = viewport.height;
        annotationCanvas.style.width  = displayWidth + 'px';
        annotationCanvas.style.height = displayHeight + 'px';

        await page.render({ canvasContext: pdfCtx, viewport }).promise;
        redrawAnnotations();
    }

    // ==========================================
    // Sidebar Thumbnails
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
                    commitTextOverlay();
                    state.currentPage = pageNum;
                    state.selectedAnnotation = null;
                    renderCurrentPage();
                }
            });
            thumbnailList.appendChild(thumbItem);

            (async () => {
                try {
                    const p = await state.pdfDocJs.getPage(pageNum);
                    const vp = p.getViewport({ scale: 0.25 });
                    thumbCanvas.width = vp.width;
                    thumbCanvas.height = vp.height;
                    const ctx = thumbCanvas.getContext('2d');
                    await p.render({ canvasContext: ctx, viewport: vp }).promise;
                } catch (e) { /* ignore thumbnail errors */ }
            })();
        }
    }

    btnToggleSidebar && btnToggleSidebar.addEventListener('click', () => {
        editorSidebar.classList.toggle('collapsed');
    });

    // ==========================================
    // Zoom Controls (Buttons + Ctrl+Scroll)
    // ==========================================
    btnPrevPage && btnPrevPage.addEventListener('click', () => {
        if (state.currentPage > 1) {
            commitTextOverlay();
            state.currentPage--;
            state.selectedAnnotation = null;
            renderCurrentPage();
        }
    });

    btnNextPage && btnNextPage.addEventListener('click', () => {
        if (state.currentPage < state.totalPages) {
            commitTextOverlay();
            state.currentPage++;
            state.selectedAnnotation = null;
            renderCurrentPage();
        }
    });

    function applyZoom(newZoom) {
        const clamped = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, newZoom));
        if (Math.abs(clamped - state.zoom) < 0.001) return;
        state.zoom = clamped;
        renderCurrentPage();
    }

    btnZoomIn  && btnZoomIn.addEventListener('click',  () => applyZoom(state.zoom + CONFIG.zoomStep));
    btnZoomOut && btnZoomOut.addEventListener('click', () => applyZoom(state.zoom - CONFIG.zoomStep));

    // Ctrl + Scroll wheel zoom
    canvasContainer.addEventListener('wheel', (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const delta = e.deltaY < 0 ? CONFIG.zoomStep : -CONFIG.zoomStep;
        applyZoom(state.zoom + delta);
    }, { passive: false });

    // ==========================================
    // Ribbon Tools & Properties
    // ==========================================
    toolButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.dataset.tool;
            if (tool === 'signature') { openSignatureModal(); return; }
            if (tool === 'stamp') { openStampModal(); return; }
            commitTextOverlay();
            setActiveTool(tool);
        });
    });

    function setActiveTool(tool) {
        state.currentTool = tool;
        state.selectedAnnotation = null;
        state.isRectDrawing = false;

        toolButtons.forEach(b => b.classList.toggle('active', b.dataset.tool === tool));

        const cursorMap = {
            select: 'default',
            text: 'text',
            pen: 'crosshair',
            highlighter: 'crosshair',
            rect: 'crosshair',
            redact: 'crosshair',
        };
        annotationCanvas.style.cursor = cursorMap[tool] || 'crosshair';
        redrawAnnotations();
    }

    colorDots.forEach(dot => {
        dot.addEventListener('click', () => {
            colorDots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            state.activeColor = dot.dataset.color;
            if (customColorPicker) customColorPicker.value = state.activeColor;
            if (state.selectedAnnotation && state.selectedAnnotation.color !== undefined) {
                pushHistory();
                state.selectedAnnotation.color = state.activeColor;
                redrawAnnotations();
            }
        });
    });

    customColorPicker && customColorPicker.addEventListener('input', (e) => {
        colorDots.forEach(d => d.classList.remove('active'));
        state.activeColor = e.target.value;
        if (state.selectedAnnotation && state.selectedAnnotation.color !== undefined) {
            pushHistory();
            state.selectedAnnotation.color = state.activeColor;
            redrawAnnotations();
        }
    });

    sizeSelector && sizeSelector.addEventListener('change', (e) => {
        state.activeSize = parseInt(e.target.value, 10);
        if (state.selectedAnnotation) {
            pushHistory();
            const anno = state.selectedAnnotation;
            if (anno.type === 'text') {
                anno.fontSize = Math.max(10, state.activeSize * 3);
            } else if (anno.strokeWidth !== undefined) {
                anno.strokeWidth = state.activeSize;
            }
            redrawAnnotations();
        }
    });

    toolDeleteActive && toolDeleteActive.addEventListener('click', deleteActiveAnnotation);

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
    // Keyboard Shortcuts
    // ==========================================
    window.addEventListener('keydown', (e) => {
        const inInput = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) ||
                        e.target.isContentEditable;
        if (inInput && !(e.ctrlKey || e.metaKey)) return;

        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault();
            e.shiftKey ? redo() : undo();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
            e.preventDefault();
            redo();
        } else if (!inInput && (e.key === 'Delete' || e.key === 'Backspace')) {
            if (state.selectedAnnotation) { e.preventDefault(); deleteActiveAnnotation(); }
        } else if (!inInput && e.key === 'Escape') {
            if (state.activeTextOverlay) { cancelTextOverlay(); }
            else if (state.isRectDrawing) { state.isRectDrawing = false; redrawAnnotations(); }
            else { state.selectedAnnotation = null; redrawAnnotations(); }
        } else if (!inInput) {
            const keyMap = { v: 'select', V: 'select', t: 'text', T: 'text',
                             p: 'pen', P: 'pen', h: 'highlighter', H: 'highlighter',
                             r: 'rect', R: 'rect', s: 'signature', S: 'signature' };
            const tool = keyMap[e.key];
            if (tool === 'signature') { openSignatureModal(); }
            else if (tool) { setActiveTool(tool); }
        }
    });

    // ==========================================
    // Coordinate Helper (DPR-aware)
    // ==========================================
    function getCanvasCoords(e) {
        const rect = annotationCanvas.getBoundingClientRect();
        const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
        const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);

        // CSS pixel position on canvas element
        const cssX = clientX - rect.left;
        const cssY = clientY - rect.top;

        // Convert to unscaled PDF points (zoom=1)
        return { x: cssX / state.zoom, y: cssY / state.zoom };
    }

    // ==========================================
    // Interactive Canvas Events
    // ==========================================
    annotationCanvas.addEventListener('mousedown',  handlePointerDown);
    annotationCanvas.addEventListener('mousemove',  handlePointerMove);
    window.addEventListener('mouseup',              handlePointerUp);

    annotationCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) handlePointerDown(e);
    }, { passive: false });

    annotationCanvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) { e.preventDefault(); handlePointerMove(e); }
    }, { passive: false });

    window.addEventListener('touchend', handlePointerUp);

    // ---- POINTER DOWN ----
    function handlePointerDown(e) {
        if (!state.pdfDocJs) return;

        // Commit any open text overlay when clicking elsewhere
        if (state.activeTextOverlay) {
            commitTextOverlay();
            return;
        }

        const coords = getCanvasCoords(e);
        const pageAnnos = getPageAnnos();

        switch (state.currentTool) {
            case 'select':
                handleSelectDown(coords, pageAnnos);
                break;

            case 'pen':
            case 'highlighter':
                pushHistory();
                state.isDrawing = true;
                state.currentPath = [coords];
                break;

            case 'text':
                createTextOverlay(coords, e);
                break;

            case 'rect':
            case 'redact':
                // Start drag-to-draw
                pushHistory();
                state.isRectDrawing = true;
                state.rectStartX = coords.x;
                state.rectStartY = coords.y;
                break;
        }
    }

    function handleSelectDown(coords, pageAnnos) {
        let hit = null;
        for (let i = pageAnnos.length - 1; i >= 0; i--) {
            if (hitTest(pageAnnos[i], coords.x, coords.y)) { hit = pageAnnos[i]; break; }
        }
        state.selectedAnnotation = hit;
        if (hit) {
            state.isDragging = true;
            state.dragStartX = coords.x;
            state.dragStartY = coords.y;
            state.dragInitialX = hit.x || 0;
            state.dragInitialY = hit.y || 0;
            state.dragInitPoints = hit.points
                ? hit.points.map(p => ({ x: p.x, y: p.y }))
                : null;
        }
        redrawAnnotations();
    }

    // ---- POINTER MOVE ----
    function handlePointerMove(e) {
        if (!state.pdfDocJs) return;
        const coords = getCanvasCoords(e);

        if (state.isDragging && state.selectedAnnotation) {
            const dx = coords.x - state.dragStartX;
            const dy = coords.y - state.dragStartY;

            if (state.selectedAnnotation.points && state.dragInitPoints) {
                state.selectedAnnotation.points = state.dragInitPoints.map(p => ({
                    x: p.x + dx, y: p.y + dy
                }));
            } else {
                state.selectedAnnotation.x = state.dragInitialX + dx;
                state.selectedAnnotation.y = state.dragInitialY + dy;
            }
            redrawAnnotations();
        } else if (state.isDrawing) {
            state.currentPath.push(coords);
            renderActiveDrawing();
        } else if (state.isRectDrawing) {
            renderRectPreview(coords);
        }
    }

    // ---- POINTER UP ----
    function handlePointerUp(e) {
        if (state.isDragging && state.selectedAnnotation) {
            state.isDragging = false;
            state.dragInitPoints = null;
            pushHistory();
        }

        if (state.isDrawing) {
            state.isDrawing = false;
            if (state.currentPath.length > 1) {
                const isHighlight = state.currentTool === 'highlighter';
                getPageAnnos().push({
                    type: 'freehand',
                    points: state.currentPath,
                    color: isHighlight ? '#FACC15' : state.activeColor,
                    strokeWidth: isHighlight ? 18 : state.activeSize,
                    isHighlight
                });
            }
            state.currentPath = [];
            redrawAnnotations();
        }

        if (state.isRectDrawing && e) {
            const coords = getCanvasCoords(e);
            commitRectDraw(coords);
        }
    }

    // ==========================================
    // Rect / Redact Drag-to-Draw
    // ==========================================
    function renderRectPreview(coords) {
        redrawAnnotations();
        const dpr = window.devicePixelRatio || 1;
        const scale = state.zoom * dpr;

        annoCtx.save();
        annoCtx.scale(scale, scale);

        const x = Math.min(state.rectStartX, coords.x);
        const y = Math.min(state.rectStartY, coords.y);
        const w = Math.abs(coords.x - state.rectStartX);
        const h = Math.abs(coords.y - state.rectStartY);

        const isRedact = state.currentTool === 'redact';
        if (isRedact) {
            annoCtx.fillStyle = 'rgba(0,0,0,0.5)';
            annoCtx.fillRect(x, y, w, h);
        } else {
            annoCtx.strokeStyle = state.activeColor;
            annoCtx.lineWidth = state.activeSize;
            annoCtx.setLineDash([5, 3]);
            annoCtx.strokeRect(x, y, w, h);
        }
        annoCtx.restore();
    }

    function commitRectDraw(endCoords) {
        state.isRectDrawing = false;

        const x = Math.min(state.rectStartX, endCoords.x);
        const y = Math.min(state.rectStartY, endCoords.y);
        const w = Math.abs(endCoords.x - state.rectStartX);
        const h = Math.abs(endCoords.y - state.rectStartY);

        // Ignore tiny accidental clicks
        if (w < 5 && h < 5) {
            redrawAnnotations();
            return;
        }

        const isRedact = state.currentTool === 'redact';
        getPageAnnos().push({
            type: 'rect',
            x, y,
            width: w,
            height: h,
            color: isRedact ? '#000000' : state.activeColor,
            fillColor: isRedact ? '#000000' : 'transparent',
            strokeWidth: isRedact ? 0 : state.activeSize,
            isRedact
        });
        redrawAnnotations();
    }

    // ==========================================
    // Inline Text Overlay (replaces prompt())
    // ==========================================
    function createTextOverlay(coords, originalEvent) {
        // Position overlay div on top of canvas at click position
        const rect = annotationCanvas.getBoundingClientRect();
        const fontSize = Math.max(14, state.activeSize * 3);

        const overlay = document.createElement('div');
        overlay.contentEditable = 'true';
        overlay.id = 'text-overlay-input';
        overlay.spellcheck = false;
        overlay.style.cssText = `
            position: fixed;
            left: ${rect.left + coords.x * state.zoom}px;
            top: ${rect.top + coords.y * state.zoom - fontSize}px;
            min-width: 60px; min-height: ${fontSize + 8}px;
            font: 600 ${fontSize}px/1.4 Inter, sans-serif;
            color: ${state.activeColor};
            background: rgba(255,255,255,0.92);
            border: 2px dashed #3B82F6;
            border-radius: 4px;
            padding: 2px 6px;
            outline: none;
            cursor: text;
            z-index: 9000;
            box-shadow: 0 2px 12px rgba(59,130,246,0.25);
            white-space: pre;
            user-select: text;
        `;
        overlay.setAttribute('placeholder', 'พิมพ์ข้อความ...');
        overlay.dataset.pdfX = coords.x;
        overlay.dataset.pdfY = coords.y;
        overlay.dataset.fontSize = fontSize;

        document.body.appendChild(overlay);
        overlay.focus();

        // Hint label
        const hint = document.createElement('div');
        hint.style.cssText = `
            position: fixed;
            left: ${rect.left + coords.x * state.zoom}px;
            top: ${rect.top + coords.y * state.zoom + fontSize + 4}px;
            font: 400 11px Inter, sans-serif;
            color: #6B7280;
            z-index: 9001;
            pointer-events: none;
        `;
        hint.textContent = 'Enter = บันทึก | Esc = ยกเลิก';
        hint.id = 'text-overlay-hint';
        document.body.appendChild(hint);

        state.activeTextOverlay = overlay;

        // Key handlers
        overlay.addEventListener('keydown', (ke) => {
            if (ke.key === 'Enter' && !ke.shiftKey) {
                ke.preventDefault();
                commitTextOverlay();
            } else if (ke.key === 'Escape') {
                ke.preventDefault();
                cancelTextOverlay();
            }
        });
    }

    function commitTextOverlay() {
        const overlay = state.activeTextOverlay;
        if (!overlay) return;

        const text = overlay.innerText.trim();
        if (text) {
            const x = parseFloat(overlay.dataset.pdfX);
            const y = parseFloat(overlay.dataset.pdfY);
            const fontSize = parseFloat(overlay.dataset.fontSize);
            pushHistory();
            getPageAnnos().push({
                type: 'text',
                x,
                y,
                text,
                fontSize,
                color: state.activeColor
            });
            redrawAnnotations();
        }
        overlay.remove();
        document.getElementById('text-overlay-hint')?.remove();
        state.activeTextOverlay = null;
        state.activeTextAnno = null;
    }

    function cancelTextOverlay() {
        state.activeTextOverlay?.remove();
        document.getElementById('text-overlay-hint')?.remove();
        state.activeTextOverlay = null;
        state.activeTextAnno = null;
    }

    // ==========================================
    // Hit Testing
    // ==========================================
    function hitTest(anno, px, py) {
        const threshold = 10;
        if (anno.type === 'text') {
            annoCtx.font = `600 ${anno.fontSize}px Inter, sans-serif`;
            const tw = annoCtx.measureText(anno.text).width / (window.devicePixelRatio || 1);
            const th = anno.fontSize;
            return px >= anno.x - 4 && px <= anno.x + tw + 4 &&
                   py >= anno.y - th && py <= anno.y + 4;
        } else if (anno.type === 'rect') {
            return px >= anno.x && px <= anno.x + anno.width &&
                   py >= anno.y && py <= anno.y + anno.height;
        } else if (anno.type === 'image') {
            return px >= anno.x && px <= anno.x + anno.width &&
                   py >= anno.y && py <= anno.y + anno.height;
        } else if (anno.type === 'freehand') {
            for (const pt of anno.points) {
                if (Math.hypot(pt.x - px, pt.y - py) <= threshold + anno.strokeWidth / 2) return true;
            }
        }
        return false;
    }

    // ==========================================
    // Redraw Annotation Canvas
    // ==========================================
    function redrawAnnotations() {
        annoCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
        const pageAnnos = getPageAnnos();
        const dpr = window.devicePixelRatio || 1;
        const scale = state.zoom * dpr;

        annoCtx.save();
        annoCtx.scale(scale, scale);

        pageAnnos.forEach(anno => drawSingleAnnotation(annoCtx, anno));

        if (state.selectedAnnotation && state.currentTool === 'select') {
            drawSelectionBox(annoCtx, state.selectedAnnotation);
        }

        annoCtx.restore();
    }

    // Smooth freehand preview while drawing
    function renderActiveDrawing() {
        if (!state.isDrawing || state.currentPath.length < 2) return;
        redrawAnnotations();

        const dpr = window.devicePixelRatio || 1;
        const scale = state.zoom * dpr;

        annoCtx.save();
        annoCtx.scale(scale, scale);

        const isHighlight = state.currentTool === 'highlighter';
        annoCtx.strokeStyle = isHighlight ? 'rgba(250, 204, 21, 0.45)' : state.activeColor;
        annoCtx.lineWidth   = isHighlight ? 18 : state.activeSize;
        annoCtx.lineCap    = 'round';
        annoCtx.lineJoin   = 'round';
        if (isHighlight) annoCtx.globalCompositeOperation = 'multiply';

        drawSmoothPath(annoCtx, state.currentPath);
        annoCtx.restore();
    }

    // Smooth bezier path helper
    function drawSmoothPath(ctx, pts) {
        if (pts.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
            const mx = (pts[i].x + pts[i + 1].x) / 2;
            const my = (pts[i].y + pts[i + 1].y) / 2;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
    }

    function drawSingleAnnotation(ctx, anno) {
        ctx.save();
        switch (anno.type) {
            case 'text':
                ctx.font = `600 ${anno.fontSize}px Inter, sans-serif`;
                ctx.fillStyle = anno.color;
                ctx.textBaseline = 'alphabetic';
                ctx.fillText(anno.text, anno.x, anno.y);
                break;

            case 'freehand':
                if (anno.points.length < 2) break;
                if (anno.isHighlight) {
                    ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
                    ctx.globalCompositeOperation = 'multiply';
                } else {
                    ctx.strokeStyle = anno.color;
                }
                ctx.lineWidth = anno.strokeWidth;
                ctx.lineCap  = 'round';
                ctx.lineJoin = 'round';
                drawSmoothPath(ctx, anno.points);
                break;

            case 'rect':
                if (anno.isRedact) {
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(anno.x, anno.y, anno.width, anno.height);
                } else {
                    if (anno.fillColor && anno.fillColor !== 'transparent') {
                        ctx.fillStyle = anno.fillColor;
                        ctx.fillRect(anno.x, anno.y, anno.width, anno.height);
                    }
                    ctx.strokeStyle = anno.color;
                    ctx.lineWidth   = anno.strokeWidth || 2;
                    ctx.strokeRect(anno.x, anno.y, anno.width, anno.height);
                }
                break;

            case 'image':
                if (anno.imgElement) {
                    if (anno.imgElement.complete) {
                        ctx.drawImage(anno.imgElement, anno.x, anno.y, anno.width, anno.height);
                    } else {
                        anno.imgElement.onload = () => redrawAnnotations();
                    }
                }
                break;
        }
        ctx.restore();
    }

    function drawSelectionBox(ctx, anno) {
        ctx.save();
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth   = 1.5 / state.zoom;
        ctx.setLineDash([4, 3]);

        let box = getBoundingBox(ctx, anno);
        const pad = 5;
        const bx = box.x - pad, by = box.y - pad;
        const bw = box.w + pad * 2, bh = box.h + pad * 2;

        ctx.strokeRect(bx, by, bw, bh);

        ctx.fillStyle = '#3B82F6';
        ctx.setLineDash([]);
        const hs = 7 / state.zoom;
        // 4 corner handles
        [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]].forEach(([hx, hy]) => {
            ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
        });
        ctx.restore();
    }

    function getBoundingBox(ctx, anno) {
        if (anno.type === 'text') {
            ctx.font = `600 ${anno.fontSize}px Inter, sans-serif`;
            const tw = ctx.measureText(anno.text).width;
            return { x: anno.x, y: anno.y - anno.fontSize, w: tw, h: anno.fontSize * 1.3 };
        }
        if (anno.type === 'rect' || anno.type === 'image') {
            return { x: anno.x, y: anno.y, w: anno.width, h: anno.height };
        }
        if (anno.type === 'freehand') {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            anno.points.forEach(p => {
                minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
            });
            return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        }
        return { x: 0, y: 0, w: 0, h: 0 };
    }

    // ==========================================
    // Signature Pad Modal
    // ==========================================
    let isSigDrawing = false;

    function openSignatureModal() {
        signatureModal.classList.add('open');
        // Wait for modal to be visible before measuring canvas
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const w = signatureCanvas.offsetWidth || signatureCanvas.parentElement.clientWidth || 480;
                signatureCanvas.width  = w;
                signatureCanvas.height = 200;
                if (sigCtx) {
                    sigCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
                    sigCtx.strokeStyle = '#111827';
                    sigCtx.lineWidth   = 2.5;
                    sigCtx.lineCap     = 'round';
                    sigCtx.lineJoin    = 'round';
                }
            });
        });
    }

    function closeSignatureModal() {
        signatureModal.classList.remove('open');
    }

    btnCloseSig  && btnCloseSig.addEventListener('click',  closeSignatureModal);
    btnCancelSig && btnCancelSig.addEventListener('click', closeSignatureModal);
    btnClearSig  && btnClearSig.addEventListener('click',  () => {
        if (sigCtx) sigCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    });

    signatureCanvas.addEventListener('mousedown', (e) => {
        isSigDrawing = true;
        const r = signatureCanvas.getBoundingClientRect();
        sigCtx.beginPath();
        sigCtx.moveTo(e.clientX - r.left, e.clientY - r.top);
    });
    signatureCanvas.addEventListener('mousemove', (e) => {
        if (!isSigDrawing) return;
        const r = signatureCanvas.getBoundingClientRect();
        sigCtx.lineTo(e.clientX - r.left, e.clientY - r.top);
        sigCtx.stroke();
    });
    window.addEventListener('mouseup', () => { isSigDrawing = false; });

    signatureCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        isSigDrawing = true;
        const r = signatureCanvas.getBoundingClientRect();
        sigCtx.beginPath();
        sigCtx.moveTo(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top);
    }, { passive: false });
    signatureCanvas.addEventListener('touchmove', (e) => {
        if (!isSigDrawing || e.touches.length !== 1) return;
        e.preventDefault();
        const r = signatureCanvas.getBoundingClientRect();
        sigCtx.lineTo(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top);
        sigCtx.stroke();
    }, { passive: false });

    btnSaveSig && btnSaveSig.addEventListener('click', () => {
        if (!sigCtx) return;

        // Check if canvas is blank
        const imgData = sigCtx.getImageData(0, 0, signatureCanvas.width, signatureCanvas.height);
        const hasContent = imgData.data.some((v, i) => i % 4 === 3 && v > 10);
        if (!hasContent) {
            showToast('กรุณาเซ็นชื่อก่อนบันทึก', 'warning');
            return;
        }

        const dataUrl = signatureCanvas.toDataURL('image/png');
        const img = new Image();
        img.onload = () => {
            pushHistory();
            const pageAnnos = getPageAnnos();
            // Place at center-right area of page
            const vp = state.pageViewport || { width: 500, height: 700 };
            pageAnnos.push({
                type: 'image',
                x: vp.width * 0.5,
                y: vp.height * 0.75,
                width: 200,
                height: 80,
                imgElement: img,
                dataUrl
            });
            closeSignatureModal();
            setActiveTool('select');
            redrawAnnotations();
            showToast('บันทึกลายเซ็นเรียบร้อย', 'success');
        };
        img.src = dataUrl;
    });

    // ==========================================
    // Stamps Modal
    // ==========================================
    function openStampModal() { stampModal.classList.add('open'); }
    function closeStampModal() { stampModal.classList.remove('open'); }

    btnCloseStamp  && btnCloseStamp.addEventListener('click',  closeStampModal);
    btnCancelStamp && btnCancelStamp.addEventListener('click', closeStampModal);

    stampOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            const stampText = opt.dataset.stamp;
            const colorMap = {
                'APPROVED': '#059669',
                'REJECTED': '#DC2626',
                'CONFIDENTIAL': '#7C3AED',
                'DRAFT': '#D97706',
                'COMPLETED': '#2563EB',
                'REVIEWED': '#0891B2',
            };
            const strokeColor = colorMap[stampText] || '#059669';

            const sc = document.createElement('canvas');
            sc.width  = 260;
            sc.height = 72;
            const sctx = sc.getContext('2d');

            // Background
            sctx.fillStyle = 'rgba(255,255,255,0.0)';
            sctx.fillRect(0, 0, sc.width, sc.height);

            // Border (double line effect)
            sctx.strokeStyle = strokeColor;
            sctx.lineWidth = 5;
            sctx.strokeRect(4, 4, 252, 64);
            sctx.lineWidth = 1.5;
            sctx.strokeRect(8, 8, 244, 56);

            // Text
            sctx.fillStyle = strokeColor;
            sctx.font = '800 22px Inter, Arial, sans-serif';
            sctx.textAlign = 'center';
            sctx.textBaseline = 'middle';
            sctx.fillText(stampText, 130, 36);

            const dataUrl = sc.toDataURL('image/png');
            const img = new Image();
            img.onload = () => {
                pushHistory();
                const vp = state.pageViewport || { width: 500, height: 700 };
                getPageAnnos().push({
                    type: 'image',
                    x: vp.width * 0.3,
                    y: vp.height * 0.1,
                    width: 195,
                    height: 54,
                    imgElement: img,
                    dataUrl
                });
                closeStampModal();
                setActiveTool('select');
                redrawAnnotations();
                showToast(`วางตราประทับ "${stampText}" เรียบร้อย`, 'success');
            };
            img.src = dataUrl;
        });
    });

    // ==========================================
    // PDF-Lib Export Engine (atob instead of fetch)
    // ==========================================
    btnExportPdf && btnExportPdf.addEventListener('click', exportEditedPdf);

    // Convert data URL to Uint8Array safely (no fetch, no CORS issues)
    function dataUrlToUint8Array(dataUrl) {
        const base64 = dataUrl.split(',')[1];
        const binary  = atob(base64);
        const bytes   = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    function setExportProgress(pct, text) {
        if (exportProgressFill) exportProgressFill.style.width = pct + '%';
        if (exportProgressText) exportProgressText.textContent = text;
    }

    async function exportEditedPdf() {
        if (!state.pdfBytes) return;

        // Check if there's anything to export
        const hasAnnos = Object.values(state.annotations).some(arr => arr.length > 0);
        if (!hasAnnos) {
            showToast('ไม่มีการแก้ไข กรุณาเพิ่ม annotation ก่อน export', 'warning');
            return;
        }

        btnExportPdf.disabled = true;
        exportProgress && exportProgress.classList.remove('hidden');
        setExportProgress(5, 'กำลังโหลดเอกสารต้นฉบับ... 5%');

        try {
            const pdfDoc = await PDFLib.PDFDocument.load(state.pdfBytes);
            const total  = pdfDoc.getPageCount();

            for (let i = 0; i < total; i++) {
                const pageNum = i + 1;
                const pct = Math.round(10 + ((i + 1) / total) * 75);
                setExportProgress(pct, `กำลังผสานหน้าที่ ${pageNum}/${total}... (${pct}%)`);

                const pageAnnos = state.annotations[pageNum] || [];
                if (pageAnnos.length === 0) continue;

                const page       = pdfDoc.getPage(i);
                const pageWidth  = page.getWidth();
                const pageHeight = page.getHeight();

                // High-res offscreen canvas
                const dpr = 2;
                const oc  = document.createElement('canvas');
                oc.width  = pageWidth * dpr;
                oc.height = pageHeight * dpr;

                const octx = oc.getContext('2d');
                octx.scale(dpr, dpr);

                pageAnnos.forEach(anno => drawSingleAnnotation(octx, anno));

                const pngBytes = dataUrlToUint8Array(oc.toDataURL('image/png'));
                const embedded = await pdfDoc.embedPng(pngBytes);

                page.drawImage(embedded, { x: 0, y: 0, width: pageWidth, height: pageHeight });
            }

            setExportProgress(90, 'กำลังสร้างไฟล์ PDF สุดท้าย... 90%');

            const finalBytes = await pdfDoc.save();
            const blob       = new Blob([finalBytes], { type: 'application/pdf' });
            const url        = URL.createObjectURL(blob);

            const link    = document.createElement('a');
            const origName = state.file ? state.file.name.replace(/\.pdf$/i, '') : 'document';
            link.href     = url;
            link.download = `${origName}_edited.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setExportProgress(100, 'เสร็จสมบูรณ์! 100%');
            showToast(`บันทึกไฟล์ "${origName}_edited.pdf" เรียบร้อย`, 'success', 5000);

            setTimeout(() => {
                URL.revokeObjectURL(url);
                exportProgress && exportProgress.classList.add('hidden');
                btnExportPdf.disabled = false;
            }, 2000);

        } catch (err) {
            console.error('Export error:', err);
            showToast('เกิดข้อผิดพลาดในการ Export: ' + (err.message || 'กรุณาลองใหม่'), 'error');
            exportProgress && exportProgress.classList.add('hidden');
            btnExportPdf.disabled = false;
        }
    }

    // ==========================================
    // Utility
    // ==========================================
    function getPageAnnos() {
        if (!state.annotations[state.currentPage]) {
            state.annotations[state.currentPage] = [];
        }
        return state.annotations[state.currentPage];
    }

})();
