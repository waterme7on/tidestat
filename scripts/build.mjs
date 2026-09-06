import { mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
// Publish only browser assets: never Workers, database schemas, tests or local secrets.
const files = ['index.html','revenue.html','revenue.css','revenue-ui.js','connection.js','theme.js','theme.css','i18n.js','scene.js','scene.css','dashboard.css','footprint-model.js','footprints.css','globe-map.js','globe.css','idle-motion.js','realtime-map.js','realtime.css','visitor-avatar.js'];
await rm(root+'dist', { recursive:true, force:true });
await mkdir(root+'dist', { recursive:true });
for(const file of files) await cp(root+file,root+'dist/'+file);
for(const dir of ['assets','vendor','docs']) await cp(root+dir,root+'dist/'+dir,{recursive:true});
console.log(`Built ${files.length} browser entries and asset directories into dist/`);

await mkdir(root+'dist/sdk', {recursive:true});
for(const file of ['index.js','browser.js']) await cp(root+'packages/browser-sdk/'+file,root+'dist/sdk/'+file);
await cp(root+'integrations/shopify',root+'dist/integrations/shopify',{recursive:true});
