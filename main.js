// main.js
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = firebase.storage();

const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d',{alpha:false});
const container = document.getElementById('canvasContainer');
const sidebar = document.getElementById('sidebar');
const pixelList = document.getElementById('pixelList');
const totalCostEl = document.getElementById('totalCost');
const buyButton = document.getElementById('buyButton');
const messageBar = document.getElementById('messageBar');
const checkoutBtn = document.getElementById('checkout');
const clearSelectionBtn = document.getElementById('clearSelection');

const cols = 1000, rows = 1000;
let pixelsData = {};  // from Firebase
let selectedPixels = [];
let hoveredCell = null;
let buyMode = false;
let scale = 1, offsetX = 0, offsetY = 0;
let isDragging = false, dragStartX = 0, dragStartY = 0;
let rectStart = null;
let lastTouchDist = null;

// --- Canvas Setup ---
function resizeCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = container.clientWidth, h = container.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);

    const fit = Math.min(w / cols, h / rows);
    scale = fit; // fit to container
    offsetX = (w - cols * scale) / 2;
    offsetY = (h - rows * scale) / 2;
    draw();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Firebase Load Pixels ---
db.ref('pixels').on('value', snapshot => {
    pixelsData = snapshot.val() || {};
    draw();
});

// --- Coordinate conversions ---
function screenToWorld(x,y){
    const rect=canvas.getBoundingClientRect();
    return {x:(x-rect.left-offsetX)/scale,y:(y-rect.top-offsetY)/scale};
}
function worldToCell(x,y){
    const col=Math.floor(x),row=Math.floor(y);
    if(col<0||row<0||col>=cols||row>=rows) return null;
    return {row,col};
}

// --- Draw ---
function clearViewport(){ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.restore();}
function draw(){
    clearViewport();
    ctx.save();
    ctx.translate(offsetX,offsetY);
    ctx.scale(scale,scale);

    // Background
    ctx.fillStyle = '#111';
    ctx.fillRect(0,0,cols,rows);

    // Draw locked pixels from Firebase
    for(const key in pixelsData){
        const p = pixelsData[key];
        const [row,col] = key.split(',').map(Number);
        if(p.image){
            const img = new Image();
            img.src = p.image;
            ctx.drawImage(img,col,row,1,1);
        } else {
            ctx.fillStyle = '#0a0';
            ctx.fillRect(col,row,1,1);
        }
    }

    // Draw selected pixels
    selectedPixels.forEach(p=>{
        if(p.image){
            const img = new Image();
            img.src = p.image;
            ctx.drawImage(img,p.col,p.row,1,1);
        } else {
            ctx.fillStyle = '#00d600';
            ctx.fillRect(p.col,p.row,1,1);
        }
    });

    // Hover highlight
    if(hoveredCell){
        const key = `${hoveredCell.row},${hoveredCell.col}`;
        if(!pixelsData[key]){
            ctx.fillStyle = 'rgba(0,163,255,0.5)';
            ctx.fillRect(hoveredCell.col,hoveredCell.row,1,1);
        }
    }

    // Rectangle preview
    if(rectStart && buyMode && hoveredCell){
        ctx.fillStyle = 'rgba(0,214,0,0.3)';
        const rx = Math.min(rectStart.x,hoveredCell.col);
        const ry = Math.min(rectStart.y,hoveredCell.row);
        const rw = Math.abs(rectStart.x-hoveredCell.col)+1;
        const rh = Math.abs(rectStart.y-hoveredCell.row)+1;
        ctx.fillRect(rx,ry,rw,rh);
    }

    ctx.restore();
}

// --- Hover ---
canvas.addEventListener('mousemove', e=>{
    const {x,y}=screenToWorld(e.clientX,e.clientY);
    hoveredCell = worldToCell(x,y);
    draw();
});
canvas.addEventListener('mouseleave', ()=>{ hoveredCell=null; draw(); });

// --- Selection ---
function addPixel(row,col){
    const key = `${row},${col}`;
    if(pixelsData[key]) return; // locked
    if(selectedPixels.some(p=>p.row===row && p.col===col)) return;
    selectedPixels.push({row,col,image:null,link:""});
}

canvas.addEventListener('click', e=>{
    const {x,y} = screenToWorld(e.clientX,e.clientY);
    const cell = worldToCell(x,y);
    if(!cell) return;
    if(!buyMode){
        // Visit mode: click locked pixels
        const key = `${cell.row},${cell.col}`;
        if(pixelsData[key] && pixelsData[key].link) window.open(pixelsData[key].link,'_blank');
        return;
    }
    // Buy mode
    addPixel(cell.row,cell.col);
    updateSidebar();
    draw();
});

// --- Drag ---
canvas.addEventListener('mousedown', e=>{
    if(!buyMode){isDragging=true; dragStartX=e.clientX-offsetX; dragStartY=e.clientY-offsetY; return;}
    const {x,y}=screenToWorld(e.clientX,e.clientY);
    const cell = worldToCell(x,y);
    if(cell){rectStart={x:cell.col,y:cell.row};} 
    else {isDragging=true; dragStartX=e.clientX-offsetX; dragStartY=e.clientY-offsetY;}
});
window.addEventListener('mousemove', e=>{
    if(isDragging && !rectStart){
        offsetX = e.clientX - dragStartX;
        offsetY = e.clientY - dragStartY;
        draw();
    } else if(rectStart && buyMode){
        const {x,y}=screenToWorld(e.clientX,e.clientY);
        hoveredCell = worldToCell(x,y);
        draw();
    }
});
window.addEventListener('mouseup', e=>{
    if(rectStart && buyMode && hoveredCell){
        const rx=Math.min(rectStart.x,hoveredCell.col);
        const ry=Math.min(rectStart.y,hoveredCell.row);
        const rw=Math.abs(rectStart.x-hoveredCell.col)+1;
        const rh=Math.abs(rectStart.y-rectStart.y)+1;
        for(let r=ry;r<ry+rh;r++){
            for(let c=rx;c<rx+rw;c++){
                addPixel(r,c);
            }
        }
        rectStart=null;
        updateSidebar();
        draw();
    }
    isDragging=false;
});

// --- Touch zoom ---
canvas.addEventListener('touchstart', e=>{
    if(e.touches.length===2){
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDist = Math.sqrt(dx*dx+dy*dy);
    }
});
canvas.addEventListener('touchmove', e=>{
    if(e.touches.length===2){
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if(lastTouchDist){
            const zoomFactor = dist / lastTouchDist;
            const prevScale = scale;
            scale *= zoomFactor;
            const minScale = Math.min(container.clientWidth/cols, container.clientHeight/rows);
            scale = Math.max(minScale, Math.min(60,scale));
            const rect = canvas.getBoundingClientRect();
            const cx = (e.touches[0].clientX + e.touches[1].clientX)/2 - rect.left;
            const cy = (e.touches[0].clientY + e.touches[1].clientY)/2 - rect.top;
            const worldX = (cx - offsetX)/prevScale;
            const worldY = (cy - offsetY)/prevScale;
            offsetX = cx - worldX*scale;
            offsetY = cy - worldY*scale;
            draw();
        }
        lastTouchDist = dist;
    }
},{passive:false});
canvas.addEventListener('touchend', e=>{if(e.touches.length<2) lastTouchDist=null;});

// --- Sidebar ---
function updateSidebar(){
    sidebar.classList.toggle('open', buyMode);
    pixelList.innerHTML='';
    selectedPixels.forEach((p,i)=>{
        const div = document.createElement('div');
        div.className='pixelSection';
        div.dataset.index=i;
        div.innerHTML = `<div><strong>Row:</strong>${p.row},<strong>Col:</strong>${p.col}</div>
            <input type="text" placeholder="URL" value="${p.link}" class="pixelLink">
            <input type="file" class="pixelImage">`;
        pixelList.appendChild(div);

        // URL input
        div.querySelector('.pixelLink').addEventListener('input', e=>{
            p.link = e.target.value;
        });

        // Image upload
        div.querySelector('.pixelImage').addEventListener('change', e=>{
            const file = e.target.files[0];
            if(!file) return;
            const storageRef = storage.ref(`pixelImages/${Date.now()}_${file.name}`);
            storageRef.put(file).then(()=>storageRef.getDownloadURL()).then(url=>{
                p.image = url;
                draw();
            });
        });

        // Hover highlight
        div.addEventListener('mouseenter', ()=>{hoveredCell={row:p.row,col:p.col}; draw();});
        div.addEventListener('mouseleave', ()=>{hoveredCell=null; draw();});
    });
}
buyButton.addEventListener('click', ()=>{
    buyMode=!buyMode;
    messageBar.textContent=buyMode?'Buy mode activated':'Visit mode activated';
    updateSidebar();
});

// --- Checkout ---
checkoutBtn.addEventListener('click', ()=>{
    if(!selectedPixels.length) return alert('No pixels selected!');
    const updates = {};
    selectedPixels.forEach(p=>{
        const key=`${p.row},${p.col}`;
        updates[`pixels/${key}`] = {
            image: p.image||null,
            link: p.link||'',
            locked:true,
            timestamp:Date.now()
        };
    });
    const purchaseRef = db.ref('purchases').push();
    purchaseRef.set({
        pixels:selectedPixels.map(p=>`${p.row},${p.col}`),
        totalCost:selectedPixels.length,
        paymentMethod:'mock', // integrate real payment API
        timestamp:Date.now()
    }).then(()=>db.ref().update(updates))
    .then(()=>{
        selectedPixels=[];
        updateSidebar();
        draw();
        alert('Purchase successful!');
    });
});

// --- Clear Selection ---
clearSelectionBtn.addEventListener('click', ()=>{
    selectedPixels=[];
    updateSidebar();
    draw();
});

