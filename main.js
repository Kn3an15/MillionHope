// main.js for Million Hope
// Author: Upgraded for mobile + PC, accurate selection, buy/visit modes, Firebase integration

// ======== FIREBASE CONFIG ========
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.1/firebase-app.js";
import { getDatabase, ref, set, get, update } from "https://www.gstatic.com/firebasejs/10.6.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.6.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);

// ======== ELEMENTS ========
const canvas = document.getElementById('pixelCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const sidebar = document.getElementById('sidebar');
const pixelList = document.getElementById('pixelList');
const totalCostEl = document.getElementById('totalCost');
const buyButton = document.getElementById('buyButton');
const messageBar = document.getElementById('messageBar');
const applyURLAllCheckbox = document.getElementById('applyURLAll');
const applyImageAllCheckbox = document.getElementById('applyImageAll');

const cols = 1000, rows = 1000;
let purchasedPixels = {}; // from DB
let selectedPixels = [];
let buyMode = false;
let hoveredCell = null;
let scale = 1, offsetX = 0, offsetY = 0;
let isDragging = false, dragStartX = 0, dragStartY = 0;
let rectStart = null;
let lastTouchDist = null;

// ======== OFFSCREEN CANVAS FOR PERFORMANCE ========
const offCanvas = document.createElement('canvas');
offCanvas.width = cols;
offCanvas.height = rows;
const offCtx = offCanvas.getContext('2d');

// ======== UTILITY FUNCTIONS ========
function screenToWorld(x, y) {
  const rect = canvas.getBoundingClientRect();
  return { x: (x - rect.left - offsetX)/scale, y: (y - rect.top - offsetY)/scale };
}

function worldToCell(x, y) {
  const col = Math.floor(x);
  const row = Math.floor(y);
  if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
  return { row, col };
}

function constrainView() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const worldW = cols*scale, worldH = rows*scale;
  offsetX = worldW <= w ? (w - worldW)/2 : Math.min(0, Math.max(offsetX, w - worldW));
  offsetY = worldH <= h ? (h - worldH)/2 : Math.min(0, Math.max(offsetY, h - worldH));
}

function clearViewport() { ctx.clearRect(0,0,canvas.width,canvas.height); }

// ======== DRAW FUNCTION ========
function draw() {
  clearViewport();
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Background grid
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0,0,cols,rows);

  // Light grid lines
  ctx.strokeStyle = '#d3d3d3';
  ctx.lineWidth = 0.05;
  for(let i=0;i<=cols;i+=10){ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,rows); ctx.stroke();}
  for(let i=0;i<=rows;i+=10){ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(cols,i); ctx.stroke();}

  // Draw purchased pixels
  for(const key in purchasedPixels){
    const px = purchasedPixels[key];
    if(px.img) {
      const img = new Image(); img.src = px.img;
      ctx.drawImage(img, px.col, px.row, 1, 1);
    } else { ctx.fillStyle='#0a0'; const [r,c] = key.split(','); ctx.fillRect(c,r,1,1);}
  }

  // Draw selected pixels
  for(const p of selectedPixels){
    if(p.image){ const img=new Image(); img.src=p.image; ctx.drawImage(img,p.col,p.row,1,1);}
    else{ ctx.fillStyle='#00d600'; ctx.fillRect(p.col,p.row,1,1);}
  }

  // Hover
  if(hoveredCell){
    ctx.fillStyle='rgba(0,163,255,0.3)';
    ctx.fillRect(hoveredCell.col, hoveredCell.row,1,1);
  }

  ctx.restore();
}

// ======== RESIZE ========
function resizeCanvas() {
  const w = container.clientWidth, h = container.clientHeight;
  canvas.width = w; canvas.height = h;
  scale = Math.min(w/cols, h/rows);
  offsetX = (w - cols*scale)/2; offsetY = (h - rows*scale)/2;
  constrainView(); draw();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ======== PIXEL SELECTION ========
function selectPixel(row,col){
  const key = `${row},${col}`;
  if(purchasedPixels[key]) return; // cannot select purchased
  const exists = selectedPixels.some(p=>p.row===row && p.col===col);
  if(!exists) selectedPixels.push({row,col,link:"",image:null});
  updateSidebar();
  draw();
}

canvas.addEventListener('click', e=>{
  const {x,y} = screenToWorld(e.clientX,e.clientY);
  const cell = worldToCell(x,y);
  if(!cell) return;
  if(!buyMode){
    const key = `${cell.row},${cell.col}`;
    if(purchasedPixels[key] && purchasedPixels[key].link) window.open(purchasedPixels[key].link,'_blank');
    return;
  }
  selectPixel(cell.row, cell.col);
});

// ======== DRAG & PAN ========
canvas.addEventListener('mousedown', e=>{ isDragging=true; dragStartX=e.clientX-offsetX; dragStartY=e.clientY-offsetY; });
window.addEventListener('mousemove', e=>{ if(isDragging){ offsetX=e.clientX-dragStartX; offsetY=e.clientY-dragStartY; constrainView(); draw(); } });
window.addEventListener('mouseup', ()=>{ isDragging=false; });

// ======== TOUCH ========
canvas.addEventListener('touchstart', e=>{
  if(e.touches.length===2){
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    lastTouchDist = Math.sqrt(dx*dx + dy*dy);
  }
});
canvas.addEventListener('touchmove', e=>{
  if(e.touches.length===2){
    e.preventDefault();
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const zoomFactor = dist/lastTouchDist;
    const prevScale = scale;
    scale = Math.max(Math.min(prevScale*zoomFactor, 60), Math.min(container.clientWidth/cols, container.clientHeight/rows));
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches[0].clientX + e.touches[1].clientX)/2 - rect.left;
    const cy = (e.touches[0].clientY + e.touches[1].clientY)/2 - rect.top;
    const worldX = (cx-offsetX)/prevScale, worldY = (cy-offsetY)/prevScale;
    offsetX = cx - worldX*scale; offsetY = cy - worldY*scale;
    constrainView(); draw();
    lastTouchDist = dist;
  } else if(e.touches.length===1){
    offsetX = e.touches[0].clientX - dragStartX;
    offsetY = e.touches[0].clientY - dragStartY;
    constrainView(); draw();
  }
}, {passive:false});
canvas.addEventListener('touchend', e=>{ if(e.touches.length<2) lastTouchDist=null; });

// ======== ZOOM WHEEL ========
canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  const zoomFactor=Math.exp(e.deltaY<0?1:-1 *0.12);
  const prevScale = scale;
  scale = Math.max(Math.min(scale*zoomFactor,60),Math.min(container.clientWidth/cols, container.clientHeight/rows));
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX-rect.left, cy=e.clientY-rect.top;
  const worldX = (cx-offsetX)/prevScale, worldY=(cy-offsetY)/prevScale;
  offsetX = cx - worldX*scale; offsetY = cy - worldY*scale;
  constrainView(); draw();
},{passive:false});

// ======== BUY / VISIT MODE ========
buyButton.addEventListener('click', ()=>{
  buyMode = !buyMode;
  sidebar.classList.toggle('open', buyMode);
  messageBar.textContent = buyMode ? "Select pixels to buy" : "Visit mode active";
  draw();
});

// ======== SIDEBAR & MULTIPLE PIXEL OPTIONS ========
function updateSidebar(){
  pixelList.innerHTML='';
  selectedPixels.forEach((p,i)=>{
    const div = document.createElement('div'); div.className='pixelSection';
    div.innerHTML = `<div>Row:${p.row} Col:${p.col}</div>
      <input type="url" placeholder="Pixel URL" value="${p.link}" class="linkInput" data-index="${i}">
      <input type="file" class="imgInput" accept="image/*" data-index="${i}">`;
    div.addEventListener('mouseenter', ()=>{ hoveredCell={row:p.row,col:p.col}; draw(); });
    div.addEventListener('mouseleave', ()=>{ hoveredCell=null; draw(); });
    pixelList.appendChild(div);
  });
  totalCostEl.textContent=`Total Cost: ${selectedPixels.length} JOD`;

  // Show "apply to all" only if multiple
  applyURLAllCheckbox.style.display = selectedPixels.length>1?'block':'none';
  applyImageAllCheckbox.style.display = selectedPixels.length>1?'block':'none';
}

// ======== IMAGE UPLOAD ========
pixelList.addEventListener('change', async e=>{
  if(e.target.classList.contains('imgInput')){
    const file = e.target.files[0]; if(!file) return;
    const idx = e.target.dataset.index;
    const storageRef = sRef(storage, `pixels/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    selectedPixels[idx].image = url;

    // Apply to all
    if(applyImageAllCheckbox.checked) selectedPixels.forEach(p=>p.image=url);
    updateSidebar(); draw();
  } else if(e.target.classList.contains('linkInput')){
    const idx = e.target.dataset.index;
    selectedPixels[idx].link = e.target.value;
    if(applyURLAllCheckbox.checked) selectedPixels.forEach(p=>p.link=e.target.value);
  }
});

// ======== CHECKOUT ========
document.getElementById('checkout').addEventListener('click', async ()=>{
  if(selectedPixels.length===0) return;
  const receiptId = Date.now();
  const updates = {};
  selectedPixels.forEach(p=>{
    const key = `${p.row},${p.col}`;
    purchasedPixels[key] = {row:p.row,col:p.col,link:p.link,image:p.image};
    updates[key] = purchasedPixels[key];
  });
  await update(ref(db, 'pixels/'), updates);
  await set(ref(db, `receipts/${receiptId}`), {pixels:selectedPixels,total:selectedPixels.length});
  selectedPixels=[]; updateSidebar(); draw();
  alert('Purchase successful! Receipt saved.');
});
// ======== BUY / VISIT MODE TOGGLE ========
const buyButton = document.getElementById('buyButton');

buyButton.addEventListener('click', () => {
  buyMode = !buyMode;
  sidebar.classList.toggle('open', buyMode);

  if (buyMode) {
    messageBar.textContent = "Buy mode active: select pixels";
    buyButton.textContent = "Switch to Visit Mode";
  } else {
    messageBar.textContent = "Visit mode active: click locked pixels to visit URL";
    buyButton.textContent = "Switch to Buy Mode";
    selectedPixels = [];   // optionally clear selection when leaving buy mode
    updateSidebar();
    draw();
  }
});

// ======== CHECKOUT WITH VERIFICATION ========
document.getElementById('checkout').addEventListener('click', async () => {
  if (!buyMode) { alert("Switch to Buy mode first."); return; }
  if (selectedPixels.length === 0) { alert("Select at least one pixel."); return; }

  // Verify all selected pixels have URL or image
  for (let p of selectedPixels) {
    if (!p.link && !p.image) {
      alert(`Pixel at Row ${p.row} Col ${p.col} is missing URL or image.`);
      return;
    }
  }

  // Proceed to save purchase
  const receiptId = Date.now();
  const updates = {};
  selectedPixels.forEach(p => {
    const key = `${p.row},${p.col}`;
    purchasedPixels[key] = { row: p.row, col: p.col, link: p.link, image: p.image };
    updates[key] = purchasedPixels[key];
  });

  await update(ref(db, 'pixels/'), updates);
  await set(ref(db, `receipts/${receiptId}`), { pixels: selectedPixels, total: selectedPixels.length, date: new Date().toISOString() });

  selectedPixels = [];
  updateSidebar();
  draw();
  alert('Purchase successful! Receipt saved.');
});

// ======== HOVER HIGHLIGHT ========
canvas.addEventListener('mousemove', e=>{
  const {x,y} = screenToWorld(e.clientX,e.clientY);
  const cell = worldToCell(x,y);
  hoveredCell = cell;
  draw();
});
canvas.addEventListener('mouseleave', ()=>{ hoveredCell=null; draw(); });

// ======== INIT DB ========
async function loadDB(){
  const snap = await get(ref(db,'pixels/'));
  if(snap.exists()) purchasedPixels = snap.val();
  draw();
}
loadDB();

