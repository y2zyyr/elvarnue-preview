/* Local, build-time translation catalogues. No customer text is sent to a translator. */
(()=>{
'use strict';
const languages={en:'English','zh-CN':'简体中文',ja:'日本語',ko:'한국어',fr:'Français',es:'Español'};
const normalise=s=>String(s).replace(/\s+/g,' ').trim();
const storageKey='elvarnue-language-v1',catalogues=new Map(),originalText=new WeakMap(),originalAttributes=new WeakMap();
let language='en',catalogue={},patterns=[],folded=new Map(),observer,bar,selector,status,requestId=0,pending=false;
const unsupported=new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','PRE','CODE']);
const ignored=(element,attributes=false)=>!element||Boolean(element.closest('[translate="no"], [data-language-ui], [data-user-content]'))||(unsupported.has(element.tagName)&&!(attributes&&element.tagName==='TEXTAREA'));
function compile(){
 folded=new Map(Object.entries(catalogue).map(([a,b])=>[a.toLowerCase(),b]));
 patterns=Object.entries(catalogue).filter(([key,value])=>value&&/\{\{\d+\}\}/.test(key)).map(([key,value])=>{
  const slots=[];let position=0,source='';
  for(const match of key.matchAll(/\{\{(\d+)\}\}/g)){source+=key.slice(position,match.index).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(.+?)';slots.push(match[1]);position=match.index+match[0].length;}
  source+=key.slice(position).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return {regex:new RegExp('^'+source+'$','i'),value,slots,specificity:key.replace(/\{\{\d+\}\}/g,'').length};
 }).sort((a,b)=>b.specificity-a.specificity);
}
function exact(s){return catalogue[s]||folded.get(s.toLowerCase())||s;}
function t(input){
 const raw=String(input??'');if(language==='en'||!raw.trim())return raw;
 const key=normalise(raw),direct=exact(key);let translated=direct;
 if(direct===key)for(const pattern of patterns){const match=key.match(pattern.regex);if(!match)continue;const values={};pattern.slots.forEach((slot,i)=>values[slot]=exact(match[i+1]));translated=pattern.value.replace(/\{\{(\d+)\}\}/g,(_,slot)=>values[slot]??'');break;}
 return raw.slice(0,raw.search(/\S|$/))+translated+(raw.match(/\s*$/)?.[0]||'');
}
// Readable downloads localise known labels and sample text, preserving customer entries.
function translateDocument(input){return String(input).split('\n').map(line=>{
 const match=line.match(/^([^:：]+)([:：]\s*)(.*)$/);
 if(match&&exact(normalise(match[1]))!==normalise(match[1]))return t(match[1])+match[2]+t(match[3]);
 return t(line);
}).join('\n');}
window.I18N={t,document:translateDocument,brief:(form,data,headers)=>[...headers.map(t),'',...Object.entries(data).map(([key,value])=>t(key.toUpperCase())+': '+((form.elements[key]?.tagName==='SELECT'||form.querySelector('[type=radio][name="'+CSS.escape(key)+'"]'))?t(value):value))].join('\n'),download:(text,filename)=>{const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)},get language(){return language},refresh:()=>apply(),ready:Promise.resolve()};
function translateNode(node){
 if(ignored(node.parentElement)||!node.nodeValue?.trim())return;
 const current=node.nodeValue,cached=originalText.get(node);
 const source=cached&&current===cached.rendered?cached.source:current;
 const rendered=t(source);originalText.set(node,{source,rendered});if(current!==rendered)node.nodeValue=rendered;
}
const attributeNames=['aria-label','alt','placeholder','title','content'];
function translateElement(element){
 // Translate labels and placeholders without translating the typed textarea value.
 if(ignored(element,true))return;
 // Freeze implicit option values before changing display labels. Application state stays canonical.
 if(element.tagName==='OPTION'&&!element.hasAttribute('value'))element.setAttribute('value',element.textContent);
 let attrs=originalAttributes.get(element);if(!attrs){attrs={};originalAttributes.set(element,attrs);}
 for(const name of attributeNames){
  if(name==='content'&&!(element.tagName==='META'&&element.getAttribute('name')==='description'))continue;
  if(!element.hasAttribute(name))continue;
  const current=element.getAttribute(name),cached=attrs[name],source=cached&&current===cached.rendered?cached.source:current;
  const rendered=t(source);attrs[name]={source,rendered};if(current!==rendered)element.setAttribute(name,rendered);
 }
}
function localLink(a){
 const raw=a.getAttribute('href');if(!raw||/^(?:#|mailto:|tel:|blob:|javascript:)/i.test(raw)||a.hasAttribute('download'))return;
 let url;try{url=new URL(raw,location.href)}catch{return;}
 if(url.origin!==location.origin||!(/\/$|\.html$/.test(url.pathname)))return;
 if(language==='en')url.searchParams.delete('lang');else url.searchParams.set('lang',language);
 const next=url.pathname+url.search+url.hash;if(raw!==next)a.setAttribute('href',next);
}
function apply(){
 if(!document.body||!observer)return;
 observer.disconnect();
 try{
  // Options must be frozen even if their parent text was translated during a previous pass.
  document.querySelectorAll('option:not([value])').forEach(option=>option.setAttribute('value',option.textContent));
  const walk=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
  let node;while((node=walk.nextNode())){if(node.nodeType===Node.TEXT_NODE)translateNode(node);else translateElement(node);}
  document.querySelectorAll('a[href]').forEach(localLink);
 }finally{observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributeNames});}
}
function queueApply(){if(pending)return;pending=true;queueMicrotask(()=>{pending=false;apply()});}
async function setLanguage(next,{initial=false}={}){
 if(!Object.hasOwn(languages,next))return false;
 const id=++requestId;selector.disabled=true;bar.setAttribute('aria-busy','true');delete bar.dataset.loadError;status.textContent=t('Switching language…');
 try{
  let nextCatalogue={};
  if(next!=='en'){
   if(!catalogues.has(next)){
    const response=await fetch('/elvarnue-preview/i18n/'+next+'.json?v=bf1a8c892d');if(!response.ok)throw new Error('catalogue');
    const data=await response.json();if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('catalogue');catalogues.set(next,data);
   }
   nextCatalogue=catalogues.get(next);
  }
  if(id!==requestId)return false;
  language=next;catalogue=nextCatalogue;compile();document.documentElement.lang=next;document.documentElement.dataset.language=next;
  selector.value=next;document.querySelector('#site-language-label').textContent=t('Language');selector.setAttribute('aria-label',t('Choose language'));
  const url=new URL(location.href);if(next==='en')url.searchParams.delete('lang');else url.searchParams.set('lang',next);history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  try{localStorage.setItem(storageKey,next)}catch{}
  document.querySelectorAll('input,textarea,select').forEach(field=>{if(field.validity?.customError)field.setCustomValidity('');});
  apply();status.textContent=initial?'':t('Language updated. Your entries have been kept.');
  document.dispatchEvent(new CustomEvent('elvarnue:language',{detail:{language}}));return true;
 }catch{
  if(id!==requestId)return false;
  selector.value=language;bar.dataset.loadError='true';status.textContent=t('Language could not be loaded. Please try again.');return false;
 }finally{if(id===requestId){selector.disabled=false;bar.removeAttribute('aria-busy');}}
}
function start(){
 bar=document.createElement('div');bar.className='language-bar';bar.dataset.languageUi='';bar.setAttribute('translate','no');
 bar.innerHTML='<div class="language-inner"><span class="language-brand" aria-hidden="true">ELVARNUE / GLOBAL STUDIO</span><div class="language-control"><label id="site-language-label" for="site-language">Language</label><select id="site-language" aria-label="Choose language">'+Object.entries(languages).map(([value,name])=>'<option value="'+value+'" lang="'+value+'">'+name+'</option>').join('')+'</select></div></div><span class="language-status" id="language-status" role="status" aria-live="polite"></span>';
 document.body.prepend(bar);selector=bar.querySelector('select');status=bar.querySelector('[role=status]');
 observer=new MutationObserver(queueApply);
 let preferred=new URLSearchParams(location.search).get('lang');if(!Object.hasOwn(languages,preferred)){try{preferred=localStorage.getItem(storageKey)}catch{}}
 if(!Object.hasOwn(languages,preferred))preferred='en';
 selector.addEventListener('change',()=>{window.I18N.ready=setLanguage(selector.value);});
 window.I18N.ready=setLanguage(preferred,{initial:true});
 // Make validation messages accessible in the chosen language without touching field values.
 document.addEventListener('invalid',event=>{
  const field=event.target;if(!field.validity)return;
  if(field.validity.valueMissing)field.setCustomValidity(t('Please complete this field.'));
  else if(field.validity.typeMismatch&&field.type==='email')field.setCustomValidity(t('Please enter a valid email address.'));
  else if(field.validity.typeMismatch&&field.type==='url')field.setCustomValidity(t('Please enter a valid website URL.'));
  else if(field.validity.rangeUnderflow)field.setCustomValidity(t(`Enter a number of at least ${field.min}.`));
  else if(field.validity.rangeOverflow)field.setCustomValidity(t(`Enter a number no greater than ${field.max}.`));
  else if(field.validity.badInput)field.setCustomValidity(t('Please enter a valid number.'));
  else if(field.validity.stepMismatch)field.setCustomValidity(t(`Please enter a value in increments of ${field.step||1}.`));
  else if(field.validity.tooShort)field.setCustomValidity(t(`Please enter at least ${field.minLength} characters, excluding surrounding spaces.`));
 },true);
 document.addEventListener('input',event=>event.target.setCustomValidity?.(''),true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
