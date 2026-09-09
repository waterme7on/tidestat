import './build-icons.mjs';
import { mkdir, cp, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
// Publish only browser assets: never Workers, database schemas, tests or local secrets.
const files = ['language-menu.js','ui-motion.js','onboarding.js','onboarding.css','setup-dialog.js','ui-icons.js','ui-polish.js','ui-polish.css','account.html','account-ui.js','account.css','account-locale.js','pricing.html','pricing.js','pricing.css','pricing-locale.js','product-ui.js','product-ui.css','live-product.css','landing-locale.js','revenue-locale.js','index.html','live.html','live-intelligence.js','live-intelligence.css','landing.html','landing.css','landing.js','revenue.html','revenue.css','revenue-ui.js','revenue-visuals.js','connection.js','theme.js','theme.css','i18n.js','scene.js','scene.css','dashboard.css','footprint-model.js','footprints.css','globe-map.js','globe.css','idle-motion.js','realtime-map.js','realtime.css','visitor-avatar.js'];
await rm(root+'dist', { recursive:true, force:true });
await mkdir(root+'dist', { recursive:true });
for(const file of files) await cp(root+file,root+'dist/'+file);
for(const dir of ['assets','vendor','docs']) await cp(root+dir,root+'dist/'+dir,{recursive:true});
await cp(root+'landing.html',root+'dist/index.html');
console.log(`Built ${files.length} browser entries and asset directories into dist/`);

await mkdir(root+'dist/sdk', {recursive:true});
for(const file of ['index.js','browser.js']) await cp(root+'packages/browser-sdk/'+file,root+'dist/sdk/'+file);
await cp(root+'integrations/shopify',root+'dist/integrations/shopify',{recursive:true});

await writeFile(root+'dist/_headers', '/sdk/*\n  Access-Control-Allow-Origin: *\n  Cross-Origin-Resource-Policy: cross-origin\n');
