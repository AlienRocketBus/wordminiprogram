#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const expected={
  'island_action.html':27,'island_adjective.html':51,'island_body.html':15,
  'island_clothes.html':30,'island_color.html':35,'island_home.html':21,
  'island_food.html':10,'island_job.html':2,'island_question.html':32,'island_school.html':16,
  'island_sports.html':5,'island_traffic.html':8,'island_treasure.html':60
};
const pages=fs.readdirSync(ROOT).filter(name=>/^island_[a-z0-9]+\.html$/.test(name)).sort();
assert.equal(pages.length,27,'all 27 island pages must be scanned');

let total=0;
for(const name of pages){
  const html=fs.readFileSync(path.join(ROOT,name),'utf8');
  const icons=[...html.matchAll(/emoji:"([^"\r\n]*)"/g)].map(match=>match[1]).filter(value=>value.startsWith('<'));
  assert.equal(icons.length,expected[name]||0,`${name}: unexpected app-owned markup icon count`);
  for(const icon of icons){
    assert.match(icon,/^<span class='[a-z0-9-]+-icon(?: [a-z0-9-]+)*'(?: aria-hidden='true')?>\s*(?:<svg\b|<img\b)/i,
      `${name}: markup icon must have a canonical span plus SVG/IMG root`);
    assert.match(icon,/(?:<\/svg>|<img\b[^>]*>)<\/span>$/i,`${name}: markup icon must close its media/span root`);
    assert.doesNotMatch(icon,/<\/?(?:script|style|foreignObject|iframe|object|embed|a)\b|\son[a-z]+\s*=|javascript:/i,`${name}: unsafe active markup is forbidden in a word icon`);
    for(const href of icon.matchAll(/(?:xlink:)?href='([^']+)'/gi))assert.match(href[1],/^(?:icons|words)\/[A-Za-z0-9_./-]+(?:\?v=\d+)?$/,`${name}: word icon asset URL must stay local`);
    for(const src of icon.matchAll(/\bsrc='([^']+)'/gi))assert.match(src[1],/^(?:icons|words)\/[A-Za-z0-9_./-]+(?:\?v=\d+)?$/,`${name}: word icon image URL must stay local`);
  }
  total+=icons.length;
}
assert.equal(total,312,'all 312 app-owned word illustrations must remain covered');

const moduleSource=fs.readFileSync(path.join(ROOT,'hansen_explore_progress_v945.js'),'utf8');
assert.doesNotMatch(moduleSource,/(?:textContent|innerText)\s*=\s*[^;\n]*(?:item\.word\.emoji|word\.emoji|w\.emoji)/,'word markup must never be assigned to a text sink');
assert.doesNotMatch(moduleSource,/innerHTML\s*=\s*[^;\n]*(?:item\.word\.emoji|word\.emoji|w\.emoji)/,'recommendations must not parse word markup a second time');
assert.match(moduleSource,/source\.childNodes/,'recommendations must reuse the already-rendered source icon');
assert.match(moduleSource,/querySelector\('svg,img'\)/,'recommendations must accept both SVG and user PNG source nodes');
assert.match(moduleSource,/cloneNode\(true\)/,'recommendation icons must be detached clones');

class FakeNode{
  constructor(tag='div',text=''){this.tagName=tag.toUpperCase();this.childNodes=[];this.attributes={};this.className='';this._text=String(text);this.style={};}
  appendChild(node){this.childNodes.push(node);return node;}
  setAttribute(name,value){this.attributes[name]=String(value);}
  cloneNode(deep){const copy=new FakeNode(this.tagName,this._text);copy.className=this.className;copy.attributes={...this.attributes};if(deep)this.childNodes.forEach(child=>copy.appendChild(child.cloneNode(true)));return copy;}
  querySelector(selector){const tags=selector.split(',').map(value=>value.trim().toUpperCase());if(tags.includes(this.tagName))return this;for(const child of this.childNodes){const hit=child.querySelector(selector);if(hit)return hit;}return null;}
  get textContent(){return this._text+this.childNodes.map(child=>child.textContent).join('');}
  set textContent(value){this._text=String(value);this.childNodes=[];}
}

let source=null;
const document={
  visibilityState:'visible',head:{appendChild(){}},documentElement:{appendChild(){},classList:{add(){},remove(){}}},
  createElement:tag=>new FakeNode(tag),getElementById:()=>null,contains:()=>true,
  querySelector:()=>source,addEventListener(){}
};
const context={console,document,location:{pathname:'/island_sports.html'},allW:[],Date,JSON,Math,Number,isFinite,
  setTimeout(){return 1;},clearTimeout(){},requestAnimationFrame(){return 1;},addEventListener(){},dispatchEvent(){}};
context.window=context;context.globalThis=context;
vm.createContext(context);vm.runInContext(moduleSource,context,{filename:'hansen_explore_progress_v945.js'});
const renderIcon=context.HansenExploreProgress._recommendationIcon;

source=new FakeNode('div');const originalSvg=new FakeNode('svg');source.appendChild(originalSvg);
let button=new FakeNode('button');let wrap=renderIcon(button,{index:11,word:{emoji:"<span class='sp-icon'><svg></svg></span>"}});
assert.equal(wrap.querySelector('svg')?.tagName,'SVG','markup icon must remain a rendered SVG node');
assert.notEqual(wrap.querySelector('svg'),originalSvg,'the recommendation must not move or mutate the source-card icon');
assert.equal(wrap.attributes['aria-hidden'],'true','decorative icon must be hidden from assistive text');

source=new FakeNode('div');const originalImg=new FakeNode('img');source.appendChild(originalImg);
button=new FakeNode('button');wrap=renderIcon(button,{index:12,word:{emoji:"<span class='fd-icon'><img src='icons/food-v958/pork.webp?v=960' alt=''></span>"}});
assert.equal(wrap.querySelector('img')?.tagName,'IMG','markup icon must remain a rendered image node');
assert.notEqual(wrap.querySelector('img'),originalImg,'the recommendation must clone, not move, the source image');

source=null;button=new FakeNode('button');wrap=renderIcon(button,{index:11,word:{emoji:"<span class='sp-icon'><svg></svg></span>"}});
assert.equal(wrap.textContent,'📘','missing markup source must fail closed, never expose markup text');
button=new FakeNode('button');wrap=renderIcon(button,{index:0,word:{emoji:'🏸'}});
assert.equal(wrap.textContent,'🏸','ordinary Unicode emoji must remain visible');

console.log('word icon rendering v946: 27 pages + 312 SVG/PNG icons + clone/fallback/text-sink guards ✅');
