// Global State
const state = {
    mapImage: null,
    mapKonvaImage: null,
    mapRotation: 0,
    mapScale: 1,

    points: [], // Array of {x, y}
    lines: [],
    polygon: null,
    boundingRect: null,
    centerMark: null,

    chakraImage: null,
    chakraKonvaImage: null,
    chakraVisible: false,
    chakraRotation: 0,
    chakraOpacity: 0.7,
    chakraScale: 1,

    showDiagonals: true,

    isSelectingPoints: false,

    stageWidth: 800,
    stageHeight: 600
};

// UI Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const rotateLeftBtn = document.getElementById('rotate-left-btn');
const rotateRightBtn = document.getElementById('rotate-right-btn');
const selectPointsBtn = document.getElementById('select-points-btn');
const clearPointsBtn = document.getElementById('clear-points-btn');
const chakraOpacityInput = document.getElementById('chakra-opacity');
const chakraRotationInput = document.getElementById('chakra-rotation');
const chakraRotationManualInput = document.getElementById('chakra-rotation-input');
const rotationVal = document.getElementById('rotation-val');
const opacityVal = document.getElementById('opacity-val');
const chakraSizeInput = document.getElementById('chakra-size');
const sizeVal = document.getElementById('size-val');
const toggleChakraBtn = document.getElementById('toggle-chakra-btn');
const showDiagonalsCheckbox = document.getElementById('show-diagonals');
const downloadPngBtn = document.getElementById('download-png-btn');
const downloadPdfBtn = document.getElementById('download-pdf-btn');
const canvasContainer = document.getElementById('canvas-container');
const placeholder = document.getElementById('placeholder');

// Konva Setup
let stage, mapLayer, drawingLayer, chakraLayer;

function initKonva() {
    placeholder.style.display = 'none';

    // Auto-size stage to container
    const containerWidth = canvasContainer.clientWidth - 40;
    const containerHeight = canvasContainer.clientHeight - 40;
    state.stageWidth = containerWidth;
    state.stageHeight = containerHeight;

    stage = new Konva.Stage({
        container: 'canvas-container',
        width: state.stageWidth,
        height: state.stageHeight,
        draggable: true, // Allow panning the whole view
    });

    // Zoom with mouse wheel
    stage.on('wheel', (e) => {
        e.evt.preventDefault();
        const scaleBy = 1.1;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        stage.scale({ x: newScale, y: newScale });

        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        stage.position(newPos);
    });

    mapLayer = new Konva.Layer();
    drawingLayer = new Konva.Layer();
    chakraLayer = new Konva.Layer();

    stage.add(mapLayer);
    stage.add(drawingLayer);
    stage.add(chakraLayer);

    // Click handler for point selection
    stage.on('click', (e) => {
        if (!state.isSelectingPoints || state.points.length >= 4) return;

        // Ignore clicks if dragging
        if (e.evt.button !== 0) return; // Only left click

        const pos = stage.getRelativePointerPosition();
        addPoint(pos.x, pos.y);
    });

    // Preload Chakra Image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = 'compass.png';
    img.onload = () => {
        state.chakraImage = img;
    };
}

// Map Loading
async function handleFileUpload(file) {
    if (!stage) initKonva();

    const fileType = file.type;

    if (fileType === 'application/pdf') {
        await loadPdf(file);
    } else if (fileType.startsWith('image/')) {
        await loadImage(file);
    } else {
        alert('Unsupported file type. Please upload a PDF or Image.');
    }
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                renderMap(img);
                resolve();
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function loadPdf(file) {
    const fileReader = new FileReader();
    fileReader.onload = async function () {
        const typedarray = new Uint8Array(this.result);
        try {
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2.0 }); // High res

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const img = new Image();
            img.onload = () => {
                renderMap(img);
            };
            img.src = canvas.toDataURL();

        } catch (error) {
            console.error('Error rendering PDF:', error);
            alert('Failed to load PDF.');
        }
    };
    fileReader.readAsArrayBuffer(file);
}

function renderMap(imgElement) {
    state.mapImage = imgElement;
    mapLayer.destroyChildren();

    // Calculate scale to fit in stage
    const scale = Math.min(
        (state.stageWidth * 0.8) / imgElement.width,
        (state.stageHeight * 0.8) / imgElement.height
    );

    state.mapKonvaImage = new Konva.Image({
        x: state.stageWidth / 2,
        y: state.stageHeight / 2,
        image: imgElement,
        width: imgElement.width * scale,
        height: imgElement.height * scale,
        offset: {
            x: (imgElement.width * scale) / 2,
            y: (imgElement.height * scale) / 2
        },
        rotation: 0
    });

    mapLayer.add(state.mapKonvaImage);
    mapLayer.draw();

    // Enable controls
    enableControls();

    // Reset stage pos and scale
    stage.position({ x: 0, y: 0 });
    stage.scale({ x: 1, y: 1 });

    // Clear previous drawings
    clearPoints();
}

function enableControls() {
    rotateLeftBtn.disabled = false;
    rotateRightBtn.disabled = false;
    selectPointsBtn.disabled = false;
    clearPointsBtn.disabled = false;
}

// Map Controls
rotateLeftBtn.addEventListener('click', () => {
    state.mapRotation = (state.mapRotation - 90) % 360;
    state.mapKonvaImage.rotation(state.mapRotation);
    mapLayer.draw();
});

rotateRightBtn.addEventListener('click', () => {
    state.mapRotation = (state.mapRotation + 90) % 360;
    state.mapKonvaImage.rotation(state.mapRotation);
    mapLayer.draw();
});

// Selection Logic
selectPointsBtn.addEventListener('click', () => {
    state.isSelectingPoints = !state.isSelectingPoints;
    if (state.isSelectingPoints) {
        selectPointsBtn.textContent = 'Cancel Selection';
        selectPointsBtn.classList.add('danger-btn');
        selectPointsBtn.classList.remove('secondary-btn');
        canvasContainer.style.cursor = 'crosshair';
    } else {
        selectPointsBtn.textContent = 'Start Selection';
        selectPointsBtn.classList.remove('danger-btn');
        selectPointsBtn.classList.add('secondary-btn');
        canvasContainer.style.cursor = 'default';
    }
});

clearPointsBtn.addEventListener('click', clearPoints);

showDiagonalsCheckbox.addEventListener('change', (e) => {
    state.showDiagonals = e.target.checked;
    updateDrawing();
});

function clearPoints() {
    state.points = [];
    drawingLayer.destroyChildren();
    drawingLayer.draw();

    // Hide chakra if visible
    if (state.chakraVisible) {
        toggleChakraBtn.click();
    }

    toggleChakraBtn.disabled = true;
    chakraOpacityInput.disabled = true;
    chakraRotationInput.disabled = true;
    downloadPngBtn.disabled = true;
    downloadPdfBtn.disabled = true;
}

function addPoint(x, y) {
    const group = new Konva.Group({ x, y, draggable: true });

    const circle = new Konva.Circle({
        radius: 6,
        fill: 'rgba(59, 130, 246, 0.8)',
        stroke: '#fff',
        strokeWidth: 2
    });

    const text = new Konva.Text({
        text: (state.points.length + 1).toString(),
        fontSize: 12,
        fill: '#fff',
        x: -4,
        y: -5
    });

    group.add(circle, text);

    group.on('dragmove', () => {
        updatePoint(group.index, group.x(), group.y());
    });

    drawingLayer.add(group);
    state.points.push({ x, y, group });

    updateDrawing();

    if (state.points.length === 4) {
        state.isSelectingPoints = false;
        selectPointsBtn.textContent = 'Start Selection';
        selectPointsBtn.classList.remove('danger-btn');
        selectPointsBtn.classList.add('secondary-btn');
        canvasContainer.style.cursor = 'default';

        calculateCenter();
    }
}

function updatePoint(index, x, y) {
    state.points[index].x = x;
    state.points[index].y = y;
    updateDrawing();
    if (state.points.length === 4) {
        calculateCenter();
    }
}

function updateDrawing() {
    // Clear old lines/rects
    drawingLayer.find('Line').forEach(l => l.destroy());
    drawingLayer.find('Rect').forEach(r => r.destroy());
    if (state.centerMark) state.centerMark.destroy();

    if (state.points.length > 1) {
        // Draw polygon
        const pointsFlat = state.points.flatMap(p => [p.x, p.y]);
        if (state.points.length === 4) pointsFlat.push(state.points[0].x, state.points[0].y); // Close path

        const polyline = new Konva.Line({
            points: pointsFlat,
            stroke: 'rgba(59, 130, 246, 0.8)',
            strokeWidth: 2,
            dash: [5, 5]
        });

        // Ensure lines are drawn behind points
        drawingLayer.add(polyline);
        polyline.moveToBottom();
    }

    if (state.points.length === 4) {
        // Calculate Bounding Box and Center
        const xs = state.points.map(p => p.x);
        const ys = state.points.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const rect = new Konva.Rect({
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            stroke: 'rgba(16, 185, 129, 0.8)',
            strokeWidth: 2,
            dash: [10, 5]
        });

        drawingLayer.add(rect);
        rect.moveToBottom();

        // Draw Diagonals if enabled
        if (state.showDiagonals) {
            const diag1 = new Konva.Line({
                points: [minX, minY, maxX, maxY],
                stroke: 'rgba(16, 185, 129, 0.5)',
                strokeWidth: 1
            });

            const diag2 = new Konva.Line({
                points: [maxX, minY, minX, maxY],
                stroke: 'rgba(16, 185, 129, 0.5)',
                strokeWidth: 1
            });

            drawingLayer.add(diag1, diag2);
            diag1.moveToBottom();
            diag2.moveToBottom();
        }

        const centerX = minX + (maxX - minX) / 2;
        const centerY = minY + (maxY - minY) / 2;

        state.centerMark = new Konva.Group({ x: centerX, y: centerY });
        state.centerMark.add(new Konva.Circle({
            radius: 4, fill: '#10b981'
        }));
        state.centerMark.add(new Konva.Ring({
            innerRadius: 8, outerRadius: 10, fill: '#10b981'
        }));

        drawingLayer.add(state.centerMark);
    }

    drawingLayer.draw();
}

function calculateCenter() {
    const xs = state.points.map(p => p.x);
    const ys = state.points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    state.center = {
        x: minX + (maxX - minX) / 2,
        y: minY + (maxY - minY) / 2,
        width: maxX - minX,
        height: maxY - minY
    };

    // Enable Chakra controls
    toggleChakraBtn.disabled = false;
    downloadPngBtn.disabled = false;
    downloadPdfBtn.disabled = false;

    // Update Chakra if visible
    if (state.chakraVisible) {
        updateChakraPosition();
    }
}

// Chakra Logic
toggleChakraBtn.addEventListener('click', () => {
    if (!state.chakraImage) {
        alert("Chakra image not loaded yet.");
        return;
    }

    state.chakraVisible = !state.chakraVisible;

    if (state.chakraVisible) {
        toggleChakraBtn.textContent = 'Hide Chakra';
        chakraOpacityInput.disabled = false;
        chakraRotationInput.disabled = false;
        chakraRotationManualInput.disabled = false;
        chakraSizeInput.disabled = false;

        if (!state.chakraKonvaImage) {
            state.chakraKonvaImage = new Konva.Image({
                image: state.chakraImage,
                opacity: parseFloat(chakraOpacityInput.value),
                draggable: true // Allow dragging to manually fine-tune center
            });

            // Add custom drag bound function if you want to lock it to center, 
            // but for fine tuning, free drag is usually better.

            chakraLayer.add(state.chakraKonvaImage);
        }

        updateChakraPosition();
        state.chakraKonvaImage.show();
    } else {
        toggleChakraBtn.textContent = 'Show Chakra';
        chakraOpacityInput.disabled = true;
        chakraRotationInput.disabled = true;
        chakraRotationManualInput.disabled = true;
        chakraSizeInput.disabled = true;
        if (state.chakraKonvaImage) state.chakraKonvaImage.hide();
    }

    chakraLayer.draw();
});

function updateChakraPosition() {
    if (!state.chakraKonvaImage || !state.center) return;

    // Size chakra to fit within the bounding rectangle, with scale multiplier
    const baseSize = Math.min(state.center.width, state.center.height);
    const size = baseSize * state.chakraScale;

    state.chakraKonvaImage.width(size);
    state.chakraKonvaImage.height(size);

    state.chakraKonvaImage.offset({
        x: size / 2,
        y: size / 2
    });

    state.chakraKonvaImage.x(state.center.x);
    state.chakraKonvaImage.y(state.center.y);

    state.chakraKonvaImage.rotation(parseInt(chakraRotationInput.value));
    chakraLayer.draw();
}

chakraOpacityInput.addEventListener('input', (e) => {
    const opacityValue = parseFloat(e.target.value);
    opacityVal.textContent = Math.round(opacityValue * 100) + '%';
    if (state.chakraKonvaImage) {
        state.chakraKonvaImage.opacity(opacityValue);
        chakraLayer.draw();
    }
});

chakraRotationInput.addEventListener('input', (e) => {
    const val = e.target.value;
    rotationVal.textContent = val + '°';
    chakraRotationManualInput.value = val;
    if (state.chakraKonvaImage) {
        state.chakraKonvaImage.rotation(parseInt(val));
        chakraLayer.draw();
    }
});

chakraRotationManualInput.addEventListener('input', (e) => {
    let val = parseInt(e.target.value);
    
    // Validate and clamp value
    if (isNaN(val)) {
        return;
    }
    
    // Normalize to 0-360 range
    val = ((val % 360) + 360) % 360;
    e.target.value = val;
    
    // Update slider and chakra
    chakraRotationInput.value = val;
    rotationVal.textContent = val + '°';
    
    if (state.chakraKonvaImage) {
        state.chakraKonvaImage.rotation(val);
        chakraLayer.draw();
    }
});

chakraSizeInput.addEventListener('input', (e) => {
    const scale = parseFloat(e.target.value);
    state.chakraScale = scale;
    sizeVal.textContent = scale.toFixed(1) + 'x';
    updateChakraPosition();
});

// Download functionality
downloadPngBtn.addEventListener('click', () => {
    if (!stage) return;

    try {
        const canvas = stage.toCanvas({ pixelRatio: 2 });
        if (!canvas) {
            alert('Failed to capture the stage. Please try again.');
            return;
        }

        canvas.toBlob((blob) => {
            if (!blob) {
                alert('Failed to generate image blob. Please try again.');
                return;
            }

            const link = document.createElement('a');
            link.download = 'vastu-map-with-chakra.png';
            link.href = URL.createObjectURL(blob);
            document.body.appendChild(link);
            link.click();
            URL.revokeObjectURL(link.href);
            document.body.removeChild(link);
        }, 'image/png');
    } catch (error) {
        console.error('Error generating image:', error);
        alert('Error generating image: ' + error.message);
    }
});

downloadPdfBtn.addEventListener('click', () => {
    if (!stage) return;

    try {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert('PDF library not loaded. Please try again.');
            return;
        }

        const canvas = stage.toCanvas({ pixelRatio: 2 });
        if (!canvas) {
            alert('Failed to capture the stage. Please try again.');
            return;
        }

        const dataURL = canvas.toDataURL('image/png');
        if (!dataURL || dataURL.length < 100) {
            alert('Failed to generate PDF image. Please try again.');
            return;
        }

        const jsPDF = window.jspdf.jsPDF;
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imageRatio = canvas.width / canvas.height;
        let finalWidth = pageWidth - 20;
        let finalHeight = finalWidth / imageRatio;

        if (finalHeight > pageHeight - 20) {
            finalHeight = pageHeight - 20;
            finalWidth = finalHeight * imageRatio;
        }

        const x = (pageWidth - finalWidth) / 2;
        const y = (pageHeight - finalHeight) / 2;

        pdf.addImage(dataURL, 'PNG', x, y, finalWidth, finalHeight);
        pdf.save('vastu-map-with-chakra.pdf');
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF: ' + error.message);
    }
});

// File Upload Handlers
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFileUpload(e.target.files[0]);
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files[0]);
});

// Handle window resize
window.addEventListener('resize', () => {
    if (stage) {
        const containerWidth = canvasContainer.clientWidth - 40;
        const containerHeight = canvasContainer.clientHeight - 40;
        stage.width(containerWidth);
        stage.height(containerHeight);
    }
});
