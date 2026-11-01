import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderSite,esc,lines,picture} from '../website/render.mjs';
import {renderMap} from '../website/map-render.mjs';
import {renderFooter} from '../website/footer.mjs';
import {renderPublicMenu,renderPublicHeader,sectionLinks,PUBLIC_PAGES} from '../website/navigation.mjs';
const seed=JSON.parse(await readFile(new URL('../website/content.json',import.meta.url)));
test('home and map share the complete photographic footer and its action controls',()=>{
  const expected=renderFooter(seed,{esc,lines,picture});
  for(const html of [renderSite(seed),renderMap(seed)]){
    assert.ok(html.includes(expected));
    assert.equal((html.match(/id="footer-enquire"/g)||[]).length,1);
    assert.equal((html.match(/id="privacy-settings"/g)||[]).length,1);
    assert.equal((html.match(/id="details-dialog"/g)||[]).length,1);
  }
});
test('public menu offers only known pages and visible retreat sections',()=>{
  const c=structuredClone(seed);c.sections.find(s=>s.id==='gallery').visible=false;
  const links=sectionLinks(c);assert.ok(!links.some(p=>p.href==='/#gallery'));assert.ok(links.some(p=>p.href==='/#visit'));
  for(const mode of ['home','map']){
    const menu=renderPublicMenu(c,{esc,mode});
    for(const page of PUBLIC_PAGES)assert.ok(menu.includes(`href="${page.href}"`));
    assert.ok(!menu.includes('href="/#gallery"'));
    assert.ok(menu.includes('aria-labelledby="nature-menu-title"'));
  }
});
test('shared public chrome escapes edited brand and enquiry text',()=>{
  const c=structuredClone(seed);c.brand.name='Aroha" onload="alert(1)';c.brand.welcome='<script>alert(1)</script>';c.visit.enquiryLabel='<b>Visit</b>';
  for(const html of [renderFooter(c,{esc,lines,picture}),renderPublicMenu(c,{esc}),renderPublicHeader(c,{esc})]){
    assert.ok(!html.includes('<script>alert'));assert.ok(!html.includes('alt="Aroha" onload='));
  }
  assert.ok(renderFooter(c,{esc,lines,picture}).includes('&lt;b&gt;Visit&lt;/b&gt;'));
});
