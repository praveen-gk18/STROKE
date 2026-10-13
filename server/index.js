import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import fs from 'fs';
import { initStorage, getStorageType, getProgressByHash, saveProgressByHash, hashRecoveryKey, ConflictError, validateProgressPayload } from './storage.js';
import { addDocumentChunks, queryRAG, parseFile, generateFromChunks } from './rag.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const upload = multer({dest:'uploads/'});
let materials=[];

app.disable('x-powered-by');
app.use(express.json({ limit: '300kb' }));
app.use((req,res,next)=>{ if(req.path.startsWith('/api/')) console.log(`[api] ${req.method} ${req.path}`); next(); });

app.get('/api/health', async (req,res)=>{
  try{
    await initStorage();
    res.set('Cache-Control','no-store');
    res.json({status:'ok',storage:getStorageType(),timestamp:new Date().toISOString(),uptime:process.uptime(),version:'1.0.0'});
  }catch(e){ res.status(500).json({status:'error',error:e.message}); }
});

function extractBearer(req){ const auth=req.headers['authorization']||req.headers['Authorization']; if(!auth||!auth.startsWith('Bearer ')) return null; return auth.slice(7).trim(); }
function requireAuth(req,res,next){
  const token=extractBearer(req); if(!token) return res.status(401).json({error:'Missing Authorization'});
  try{ req.recoveryKeyHash=hashRecoveryKey(token); next(); }catch{ return res.status(401).json({error:'Invalid key'}); }
}
app.get('/api/progress', requireAuth, async (req,res)=>{
  res.set('Cache-Control','no-store');
  try{ const r=await getProgressByHash(req.recoveryKeyHash); if(!r) return res.status(404).json({error:'No progress'}); res.json({data:r.data,revision:r.revision,updatedAt:r.updatedAt}); }
  catch(e){ res.status(500).json({error:'Internal error'}); }
});
app.put('/api/progress', requireAuth, async (req,res)=>{
  res.set('Cache-Control','no-store');
  try{
    const {data,revision}=req.body||{}; validateProgressPayload({data,revision});
    const saved=await saveProgressByHash(req.recoveryKeyHash,data,revision||0);
    res.json({ok:true,revision:saved.revision});
  }catch(err){ if(err instanceof ConflictError) return res.status(409).json({error:'Stale revision',currentRevision:err.current?.revision}); res.status(500).json({error:'Internal'}); }
});

// --- RAG routes BEFORE static/fallback ---
app.post('/api/materials', upload.single('file'), async (req,res)=>{
  try{
    const text=await parseFile(req.file.path, req.file.mimetype);
    const mat={id:Date.now().toString(),name:req.file.originalname,text:text.slice(0,20000),created:Date.now()};
    materials.push(mat); addDocumentChunks(mat.id,text);
    res.json({ok:true,material:mat});
  }catch(e){ res.status(500).json({error:e.message}); }
});
app.get('/api/materials', (req,res)=>res.json(materials));
app.post('/api/rag/query', (req,res)=>{
  const {q}=req.body; const chunks=queryRAG(q,4); const gen=generateFromChunks(q,chunks); res.json(gen);
});

app.use(express.static(PUBLIC_DIR,{setHeaders:(res,fp)=>{ if(fp.endsWith('sw.js')) res.set('Cache-Control','no-cache'); }}));
app.get('*',(req,res,next)=>{ if(req.path.startsWith('/api/')) return next(); res.sendFile(path.join(PUBLIC_DIR,'index.html')); });

app.use((err,req,res,next)=>{ if(err?.type==='entity.too.large') return res.status(413).json({error:'Payload too large'}); res.status(500).json({error:'Internal'}); });

async function start(){
  try{ await initStorage(); }catch(e){ if(process.env.NODE_ENV==='production') process.exit(1); }
  app.listen(PORT,'0.0.0.0',()=>console.log(`[server] listening on ${PORT}`));
}
if(import.meta.url===`file://${process.argv[1]}`) start();
export default app; export {start};
