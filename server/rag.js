import fs from 'fs';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import natural from 'natural';
const TfIdf = natural.TfIdf;

let tfidf = new TfIdf();
let docs = []; // {id, materialId, text, chunkIndex}

export function addDocumentChunks(materialId, text){
  const chunks = text.match(/[^.!?]+[.!?]+/g)?.join(' ').match(/.{1,800}/g) || [text.slice(0,800)];
  chunks.forEach((chunk,i)=>{
    const id = `${materialId}-${i}`;
    docs.push({id, materialId, text:chunk, chunkIndex:i});
    tfidf.addDocument(chunk);
  });
}

export function queryRAG(q, topK=3){
  const results=[];
  tfidf.tfidfs(q, (i, score)=>{ if(docs[i]) results.push({score, doc:docs[i]}); });
  return results.sort((a,b)=>b.score-a.score).slice(0,topK).map(r=>r.doc);
}

export async function parseFile(filePath, mimetype){
  if(mimetype==='application/pdf'){
    const data = await pdf(fs.readFileSync(filePath));
    return data.text;
  }
  return fs.readFileSync(filePath,'utf8');
}

export function generateFromChunks(question, chunks){
  const context = chunks.map(c=>c.text).join('\n---\n');
  // Template generation (no external LLM – works offline, no openai.com needed)
  const explanation = `Based on your material:\n${context.slice(0,1200)}\n\n**Explanation for "${question}":**\n${context.split('.').slice(0,3).join('. ')}.`;
  const quiz = [
    {q:`What is the main idea of "${question}"?`, options:chunks.map(c=>c.text.slice(0,60)), ans:0},
    {q:`Which statement is from your notes?`, options:[context.slice(0,80), "Random unrelated fact", "Not in material"], ans:0}
  ];
  const flashcards = chunks.slice(0,3).map(c=>({front:c.text.slice(0,100)+'...', back:c.text.slice(0,200)}));
  return {explanation, quiz, flashcards, sources:chunks};
}
