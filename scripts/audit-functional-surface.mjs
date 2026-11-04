import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const backend=process.argv[2];
if(!backend)throw new Error('Usage: node scripts/audit-functional-surface.mjs BACKEND_DIRECTORY');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const rel=(file,root=process.cwd())=>path.relative(root,file).replaceAll('\\','/');
const frontendFiles=walk(path.resolve('src')).filter(f=>/\.[cm]?[jt]sx?$/.test(f));
const backendFiles=walk(path.join(backend,'src')).filter(f=>/\.ts$/.test(f));
const controls=[],routes=[],endpoints=[];
const compact=(v)=>v.replace(/\s+/g,' ').trim().slice(0,160);
for(const file of frontendFiles){
 const source=fs.readFileSync(file,'utf8');const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 if(/[/\\]page\.tsx$/.test(file)){const parts=rel(file).replace(/^src\/app/,'').replace(/\/page\.tsx$/,'').split('/').filter(p=>p&&!/^\(.+\)$/.test(p));routes.push({route:'/'+parts.join('/'),file:rel(file)});}
 function visit(n){
  if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
   const tag=n.tagName.getText(ast);if(['button','input','select','textarea','dialog','form','Link'].includes(tag)){
    const attributes={};for(const a of n.attributes.properties)if(ts.isJsxAttribute(a))attributes[a.name.getText(ast)]=a.initializer?compact(a.initializer.getText(ast)):true;
    const line=ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1;
    const handlers=Object.keys(attributes).filter(key=>/^on[A-Z]/.test(key));
    const label=attributes['aria-label']||attributes.title||attributes.placeholder||(ts.isJsxElement(n.parent)?compact(n.parent.children.map(c=>c.getText(ast)).join(' ')):'');
    const behavior=tag==='Link'?'navigation':handlers.length?'event-handler':tag==='form'&&attributes.action?'form-action':tag==='button'&&attributes.type!=="\"button\""? 'form-context-dependent':'requires-runtime-context';
    controls.push({file:rel(file),line,tag,label,handlers,behavior,...(attributes.href?{href:attributes.href}:{}),...(attributes.type?{type:attributes.type}:{})});
   }
  }ts.forEachChild(n,visit);
 }visit(ast);
}
for(const file of backendFiles.filter(f=>/\.controller\.ts$/.test(f))){
 const source=fs.readFileSync(file,'utf8');const root=source.match(/@Controller\((?:['"]([^'"]*)['"])?\)/)?.[1]||'';
 for(const match of source.matchAll(/@(Get|Post|Patch|Delete|Put)\((?:['"]([^'"]*)['"])?\)/g))endpoints.push({method:match[1].toUpperCase(),path:'/'+[root,match[2]].filter(Boolean).join('/'),file:rel(file,backend),line:source.slice(0,match.index).split('\n').length});
}
function changed(root){return execFileSync('git',['-c','core.quotepath=false','ls-files','-m','-o','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean).sort();}
const result={generatedAt:new Date().toISOString(),scope:'Static source inventory. Handler presence is not proof of runtime functionality; form context, shared controls and conditional rendering require browser/service verification. No environment files, secrets or database records are read.',counts:{frontendSourceFiles:frontendFiles.length,backendSourceFiles:backendFiles.length,routes:routes.length,controls:controls.length,endpoints:endpoints.length},routes,controls,endpoints,changedFiles:{frontend:changed(process.cwd()),backend:changed(backend)}};
fs.mkdirSync('docs',{recursive:true});fs.writeFileSync('docs/functional-surface-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.counts));
