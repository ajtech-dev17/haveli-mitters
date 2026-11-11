import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBranding } from '../assets/js/branding.js';
test('all page entry points use neutral first paint instead of the bundled logo',()=>{
  const pages=fs.readdirSync('.').filter(x=>x.endsWith('.html'));
  assert.equal(pages.length,12);
  for(const page of pages){
    const html=fs.readFileSync(page,'utf8');
    assert.doesNotMatch(html, /<img\b[^>]*\bsrc\s*=\s*["'][^"']*assets\/images\/team-logo\.png["']/i, page);
    assert.ok(html.includes('brand-loading-ring'),page);
    assert.ok(html.includes('data:image/svg+xml'),page);
  }
});
test('publishing branding updates displayed logos and favicon, without reassigning unchanged images',()=>{
  const element=attrs=>({attrs,writes:0,getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=v;this.writes++},removeAttribute(k){delete this.attrs[k]}});
  const icon=element({href:'data:image/svg+xml,empty',type:'image/png'});
  const logos=[element({src:'old.png'}),element({src:'old.png'})];
  const doc={querySelector:()=>icon,querySelectorAll:()=>logos};
  syncBranding(doc,'https://example.test/current.webp','Haveli Mitters');
  assert.equal(icon.attrs.href,'https://example.test/current.webp');
  assert.equal(icon.attrs.type,undefined);
  for(const logo of logos)assert.equal(logo.attrs.src,icon.attrs.href);
  const iconWrites=icon.writes;
  syncBranding(doc,'https://example.test/current.webp','Haveli Mitters');
  assert.equal(icon.writes,iconWrites);
  syncBranding(doc,'','Haveli Mitters');
  assert.equal(icon.attrs.href,'https://example.test/current.webp');
});
