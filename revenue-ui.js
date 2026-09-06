const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params = new URLSearchParams(location.search);
let demo = params.get('demo') === '1', data = null, generation = 0;
let storyGeneration=0, filterTimer;
let currency = 'USD', sourceFilter = '', visitorFilter = params.get('visitor') || '', statusFilter = '';
const titles = { stories:['Every dollar has a story.','Follow the people, moments, and paths that turn a visit into revenue.'], journeys:['The paths that pay off.','See which observed journeys lead to verified payments.'], sources:['Where your revenue begins.','Compare acquisition sources by the revenue their visitors generate.'], leaks:['Where the story stops.','Find observed checkout and signup drop-offs worth investigating.'], integrations:['Connect the whole story.','Bring browsing, payments, and acquisition into one shared event model.'] };
const view = () => Object.hasOwn(titles, location.hash.slice(1)) ? location.hash.slice(1) : 'stories';
const money = (minor, cur = currency) => { try { const digits = new Intl.NumberFormat('en',{style:'currency',currency:cur}).resolvedOptions().maximumFractionDigits; return new Intl.NumberFormat('en',{style:'currency',currency:cur,maximumFractionDigits:digits}).format((Number(minor)||0)/10**digits); } catch { return `${cur} ${minor} minor units`; } };
const number = value => Number(value || 0).toLocaleString('en');
const date = ts => new Date(ts).toLocaleString('en', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
const elapsed = ms => ms < 60000 ? '< 1 min' : ms < 3600000 ? `${Math.round(ms/60000)} min` : `${(ms/3600000).toFixed(1)} hours`;
const pathHTML = (path, payment) => `<div class="path">${(path||[]).map((p,i)=>`${i?'<i>→</i>':''}<span>${esc(p)}</span>`).join('')}${payment?`<i>→</i><span class="paid">${esc(payment)}</span>`:''}</div>`;
function sample() {
  const now = Date.now();
  const specs = [ ['v-sample-01','Google Organic',['/blog/visitor-stories','/pricing','Returning visit','Signup','Checkout'],1900,2,'stripe'], ['v-sample-02','Direct',['/','/pricing','Signup','Checkout'],4900,1,'stripe'], ['v-sample-03','Google Organic',['/shopify','/pricing','Checkout'],2900,1,'shopify'] ];
  const stories = specs.map(([id,source,journey,amount,sessions,provider],i)=>({id:`sample-${i}`,visitorId:id,sessionId:`session-${i}`,source,landingPage:journey[0],provider,paymentId:`sample_payment_${i}`,amountMinor:amount,currency:'USD',ts:now-i*3600000,attribution:'explicit',returning:sessions>1,sessionCount:sessions,durationMs: sessions*900000,journey,timeline:journey.map((p,n)=>({id:`e${n}`,type:p.startsWith('/')?'pageview':p==='Checkout'?'checkout':p==='Signup'?'signup':'custom',path:p.startsWith('/')?p:'/pricing',ts:now-i*3600000-(journey.length-n)*180000,sessionId:`session-${i}-${n<2?1:sessions}`,properties:{}}))}));
  return {site:'Sample store',overview:{visitors:12,sessions:15,customers:3,conversion:.25,currencies:[{currency:'USD',revenue:9700,payments:3,customers:3,returningRevenue:1900,unattributedRevenue:0,revenuePerVisitor:9700/12}]},stories,sources:[{name:'Google Organic',payments:2,revenue:{USD:4800},visitors:7},{name:'Direct',payments:1,revenue:{USD:4900},visitors:5}],pages:stories.map(s=>({name:s.landingPage,payments:1,revenue:{USD:s.amountMinor},visitors:s.source==='Direct'?5:7})),journeys:stories.map(s=>({name:s.journey.join(' → '),payments:1,revenue:{USD:s.amountMinor},visitors:1})),funnel:[{name:'Visitors',visitors:12},{name:'Signup',visitors:8},{name:'Checkout',visitors:6},{name:'Paid',visitors:3}],leaks:[{name:'Checkout → Payment',visitors:3,entered:6,converted:3},{name:'Signup → Checkout',visitors:2,entered:8,converted:6}],historyComplete:true,truncated:false};
}
function notice(message, error = false) { $('notice').innerHTML = message ? `<div class="notice${error?' error':''}">${esc(message)}</div>` : ''; }
function render() {
  const current = view();
  document.querySelectorAll('nav [data-view]').forEach(a=>{a.classList.toggle('active',a.dataset.view===current); if(a.dataset.view===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('pageTitle').textContent = titles[current][0]; $('pageDescription').textContent = titles[current][1];
  $('siteLabel').textContent = demo ? 'Sample store' : window.tideConnection.get().site || 'Your workspace';
  $('dataBadge').textContent = demo ? 'Sample data · not your revenue' : data ? 'Verified payment data' : 'Not connected';
  $('dataBadge').classList.toggle('demo', demo);
  $('range').disabled = demo;
  $('metrics').hidden = !data || current==='integrations';
  if (current==='integrations') { renderIntegrations(); return; }
  if (!data) {
    $('metrics').innerHTML='';
    $('content').innerHTML=`<section class="card empty"><div class="symbol">⌁</div><h2>Your first revenue story starts here.</h2><p>Connect your website to follow a visitor from their first page to a verified payment. Your real-time map and footprints remain one click away.</p><button class="primary" id="setup">Connect website →</button><button id="sample">Explore sample stories</button><p><a href="./docs/index.html">Read the integration guide ↗</a></p></section>`;
    $('setup').onclick=()=> $('connectDialog').showModal(); $('sample').onclick=()=>{demo=true;data=sample();visitorFilter='';notice('Illustrative sample data. These are not real visitors or revenue.');render();}; return;
  }
  const currencies=data.overview.currencies || [];
  if(!currencies.some(c=>c.currency===currency)) currency=currencies[0]?.currency || 'USD';
  const totals=currencies.find(c=>c.currency===currency)||{};
  $('metrics').innerHTML = [['Net revenue',money(totals.revenue),currency],['Customers',number(data.overview.customers),'Paying visitors'],['Visitors',number(data.overview.visitors),'Observed visitors'],['Sessions',number(data.overview.sessions),'Recorded sessions'],['Conversion',`${((data.overview.conversion||0)*100).toFixed(1)}%`,'Visitor → payment'],['Revenue / visitor',money(totals.revenuePerVisitor),currency]].map(([label,value,note])=>`<div class="metric"><span>${label}</span><strong>${esc(value)}</strong><small>${note}</small></div>`).join('');
  const currencySelect=`<label>Currency <select id="currency">${(currencies.length?currencies:[{currency:'USD'}]).map(c=>`<option${c.currency===currency?' selected':''}>${esc(c.currency)}</option>`).join('')}</select></label>`;
  if(current==='stories') renderStories(currencySelect,totals);
  if(current==='journeys') $('content').innerHTML=`<section class="card"><div class="card-head"><div><h2>Revenue by journey</h2><p class="muted">Observed paths before payment · repeated sessions remain part of the story</p></div>${currencySelect}</div>${ranking(data.journeys,'Journey')}</section>${funnelHTML()}`;
  if(current==='sources') $('content').innerHTML=`<section class="card"><div class="card-head"><div><h2>Top revenue sources</h2><p class="muted">First observed acquisition · revenue is not a causal claim</p></div>${currencySelect}</div>${ranking(data.sources,'Source',true)}</section><div class="split"><section class="card"><h2>Top revenue landing pages</h2><p class="muted">Revenue assigned to the first observed landing page.</p>${ranking(data.pages,'Landing page')}</section><section class="card"><h2>Organic search context</h2><p class="muted">Search Console query, page, impressions, clicks, CTR and position are aggregate search data. They are never attached to an individual visitor.</p><a href="./docs/index.html#search-console">Configure aggregate import ↗</a><div id="searchData"></div></section></div>`;
  if(current==='leaks') $('content').innerHTML=`<div class="split">${funnelHTML()}<section class="card"><h2>Potential revenue leaks</h2><p class="muted">Observed people who entered a step without the next recorded step. Tracking gaps and later returns can affect these counts.</p>${(data.leaks||[]).map(l=>`<div class="story-row"><span class="avatar">↘</span><div><strong>${esc(l.name)}</strong><small>${number(l.entered)} entered · ${number(l.converted)} continued</small><div class="bar"><b style="width:${Math.min(100,100*l.visitors/Math.max(1,l.entered))}%"></b></div></div><div class="amount"><strong>${number(l.visitors)}</strong><small>did not continue</small></div></div>`).join('')||'<p class="muted">No observed drop-offs in this period.</p>'}<p class="muted">Potential lost revenue is not estimated without evidence of order value and purchase intent.</p></section></div>`;
  if(current==='sources') void loadSearch();
  if(current==='journeys' && data.journeys.length) {const top=[...data.journeys].sort((a,b)=>(b.revenue?.[currency]||0)-(a.revenue?.[currency]||0))[0];const insight=document.createElement('p');insight.className='notice';insight.textContent=`In this period, ${top.name} generated ${money(top.revenue?.[currency]||0)} in observed net revenue. This is the highest-revenue recorded journey for ${currency}.`;$('content').prepend(insight);}
  if($('currency'))$('currency').onchange=e=>{currency=e.target.value;render();};
}
function ranking(rows=[], label, perVisitor=false) {
  if(!rows.length)return '<p class="muted">No verified payments in this period yet.</p>';
  const sorted=[...rows].sort((a,b)=>(b.revenue?.[currency]||0)-(a.revenue?.[currency]||0));
  const max=Math.max(1,...sorted.map(r=>r.revenue?.[currency]||0));
  return `<div class="table-scroll"><table><thead><tr><th>${label}</th><th>Payments*</th>${perVisitor?'<th>Visitors</th><th>Revenue / visitor</th>':''}<th>${esc(currency)} revenue</th></tr></thead><tbody>${sorted.map(r=>`<tr><td>${esc(r.name)}<div class="bar"><b style="width:${Math.max(0,(r.revenue?.[currency]||0)/max*100)}%"></b></div></td><td>${number(r.payments)}</td>${perVisitor?`<td>${number(r.visitors)}</td><td>${money((r.revenue?.[currency]||0)/Math.max(1,r.visitors))}</td>`:''}<td>${money(r.revenue?.[currency]||0)}</td></tr>`).join('')}</tbody></table></div><p class="muted">* Payment counts span currencies. Revenue is shown only in ${esc(currency)}.</p>`;
}
function funnelHTML() {const rows=data.funnel||[], max=Math.max(1,...rows.map(r=>r.visitors));return `<section class="card"><h2>Revenue funnel</h2><p class="muted">Recorded visitor milestones · ${number(data.overview.visitors)} visitors in the selected period</p>${rows.map(r=>`<div class="funnel-row"><span>${esc(r.name)}</span><div class="bar"><b style="width:${100*r.visitors/max}%"></b></div><strong>${number(r.visitors)}</strong></div>`).join('')}<p class="muted">Payments may come from returning visitors with steps recorded before this period.</p></section>`;}
function renderStories(currencySelect,totals) {
  $('content').innerHTML=`<section class="card"><div class="card-head"><div><h2>Revenue Stories</h2><p class="muted">Each payment, connected to its observed visitor history.</p></div>${currencySelect}</div><p class="muted">${money(totals.grossRevenue ?? totals.revenue)} received · ${money(totals.refunds)} refunded · ${money(totals.revenue)} net. Fees and disputes are excluded.</p><div class="filters"><input id="visitorSearch" aria-label="Search visitor or payment ID" placeholder="Search visitor or payment ID" value="${esc(visitorFilter)}"><select id="sourceFilter" aria-label="Acquisition source"><option value="">All sources</option>${[...new Set(data.sources.map(s=>s.name))].map(s=>`<option${s===sourceFilter?' selected':''}>${esc(s)}</option>`).join('')}</select><select id="statusFilter" aria-label="Visitor type"><option value="">All visitors</option><option value="returning"${statusFilter==='returning'?' selected':''}>Returning visitors</option><option value="unattributed"${statusFilter==='unattributed'?' selected':''}>Unattributed payments</option></select></div><div id="storyList"></div><div id="storyPaging"></div></section><div class="split"><section class="card"><h2>Returning visitors matter</h2><p class="muted">Revenue from visitors with more than one observed session.</p><h2 style="font-size:30px;margin-top:15px">${money(totals.returningRevenue)}</h2><p class="muted">${totals.revenue?((totals.returningRevenue||0)/totals.revenue*100).toFixed(1):'0'}% of ${esc(currency)} revenue in this period.</p></section><section class="card"><h2>Keep attribution honest</h2><p class="muted">${money(totals.unattributedRevenue)} is currently unassigned to an observed visitor journey. Pass TideStat attribution metadata into your payment flow to connect future payments.</p><a href="./docs/index.html#stripe">Connect payment metadata ↗</a></section></div>`;
  $('visitorSearch').oninput=e=>{visitorFilter=e.target.value;clearTimeout(filterTimer);filterTimer=setTimeout(()=>queryStories(),250);}; $('sourceFilter').onchange=e=>{sourceFilter=e.target.value;queryStories();};$('statusFilter').onchange=e=>{statusFilter=e.target.value;queryStories();};if(demo)renderStoryList();else void queryStories();
}
function renderStoryList() {
  const rows=data.stories.filter(s=>s.currency===currency&&(!sourceFilter||s.source===sourceFilter)&&(!visitorFilter||`${s.visitorId||''} ${s.paymentId}`.toLowerCase().includes(visitorFilter.toLowerCase()))&&(!statusFilter||(statusFilter==='returning'?s.returning:!s.visitorId||s.attribution==='unattributed')));
  $('storyList').innerHTML=rows.map(s=>`<button class="story-row" data-story="${esc(s.id)}"><span class="avatar" aria-hidden="true">${s.returning?'◕':'◡'}</span><div><strong>${esc(s.source||'Unattributed')}</strong><small>${esc(s.visitorId?`Visitor ${s.visitorId.length>14?s.visitorId.slice(0,8)+'…'+s.visitorId.slice(-4):s.visitorId}`:'No linked visitor')} · ${s.returning?'Returning · ':''}${number(s.sessionCount)} sessions · ${s.visitorId?elapsed(s.durationMs||0):'unknown duration'}</small>${pathHTML(s.journey,money(s.amountMinor,s.currency))}</div><div class="amount"><strong>${money(s.amountMinor,s.currency)}</strong><small>${s.amountMinor<0?'Refund · ':''}${esc(s.provider)}</small><small>${date(s.ts)}</small></div></button>`).join('')||'<div class="empty"><h2>No matching revenue stories.</h2><p>Try another filter, or connect a payment provider to record your first verified payment.</p></div>';
  $('storyList').querySelectorAll('[data-story]').forEach(button=>button.onclick=()=>openStory(data.stories.find(s=>s.id===button.dataset.story)));
}
function openStory(s) {
  $('storyTitle').textContent=`${money(s.amountMinor,s.currency)} from ${s.source||'Unattributed'}`;
  $('storyBody').innerHTML=`<div class="detail-grid">${[['Visitor',s.visitorId||'Unattributed'],['Sessions',s.sessionCount],['Time to payment',s.visitorId?elapsed(s.durationMs||0):'Unknown'],['Provider',s.provider],['Payment',s.paymentId],['Attribution',s.attribution]].map(([l,v])=>`<div><small>${l}</small><b>${esc(v)}</b></div>`).join('')}</div>${!s.visitorId?'<p class="notice">This payment has no verified visitor link. No browsing history has been inferred.</p>':''}<ol class="timeline">${(s.timeline||[]).map((e,i,rows)=>`${i===0||e.sessionId!==rows[i-1].sessionId?`<li><time>SESSION</time><strong>${esc(e.sessionId)}</strong></li>`:''}<li><time>${date(e.ts)}</time><strong>${esc(e.type)}</strong><p>${esc(e.path||'')}</p></li>`).join('')}<li><time>${date(s.ts)}</time><strong>Verified ${esc(s.provider)} ${s.amountMinor<0?'refund':'payment'} · ${money(s.amountMinor,s.currency)}</strong><p>${esc(s.paymentId)}</p></li></ol>${s.timelineTruncated?'<p class="notice">Showing the latest 200 events before this payment. Earlier events are omitted from this timeline.</p>':''}<p class="muted">This is recorded payment revenue, not an MRR estimate. History reflects available events and may be incomplete.</p><a href="./index.html${demo?'?demo=1':''}">Back to live visitors & footprints ↗</a>`;
  $('storyDialog').showModal();
}
function renderIntegrations() {
  $('content').innerHTML=`<div class="integration-grid">${[['⌘','NPM / Browser SDK','Available locally','Track pageviews, optional clicks, signup, checkout and custom events. Carry visitor and session IDs into payments.','npm'],['◈','Stripe','Webhook connector','Verify signed payment events and link them using server-side checkout metadata. Unlinked payments stay unattributed.','stripe'],['▣','Shopify','Pixel + payment webhook','Use the same canonical schema for storefront events and order payments, with cart attribution attributes.','shopify'],['↗','Google Search Console','Aggregate import','Import query and page performance as search context. No visitor-to-keyword matching and no OAuth connection is implied.','search-console']].map(([icon,name,status,desc,anchor])=>`<section class="card"><span class="integration-icon">${icon}</span><h2>${name}</h2><span class="badge">${status}</span><p class="muted">${desc}</p><a href="./docs/index.html#${anchor}">Setup guide →</a></section>`).join('')}</div><section class="card" style="margin-top:22px"><h2>One website, one data boundary.</h2><p class="muted">Each website has its own allowed origin, private read token, and payment signing secrets. Switch websites with a different site ID and token. Connector availability does not mean your provider is connected.</p><button id="integrationConnect">Configure workspace →</button></section>`;
  $('integrationConnect').onclick=()=> $('connectDialog').showModal();
}
async function load() {
  const ticket=++generation;
  if(demo){data=sample();notice('Illustrative sample data. These are not real visitors or revenue.');render();return;}
  const connection=window.tideConnection.get();
  if(!connection.site||!connection.token){data=null;render();return;}
  data=null;render();notice('Loading observed journeys and verified payments…');
  const request=window.tideConnection.request('/api/revenue',{days:$('range').value});
  try {const res=await fetch(request.url,{headers:request.headers,cache:'no-store',signal:AbortSignal.timeout(15000)});if(!res.ok)throw new Error(res.status===401||res.status===403?'The website ID or read token was not accepted.':`Revenue data is unavailable (${res.status}).`);const result=await res.json();if(!result.overview||!Array.isArray(result.stories))throw new Error('Unexpected response. Check that the Revenue Story Worker is deployed.');if(ticket!==generation)return;data=result;notice(data.truncated||data.historyComplete===false?'The available history is incomplete or exceeds the report limit. Totals describe the returned sample; narrow the date range.':'');render();}catch(e){if(ticket!==generation)return;data=null;notice(e.name==='TimeoutError'?'The request timed out. Refresh to try again.':e.message,true);render();}
}
$('connectionButton').onclick=()=> $('connectDialog').showModal();
$('connectForm').onsubmit=e=>{e.preventDefault();const form=new FormData(e.target);window.tideConnection.set(form.get('site').trim(),form.get('token').trim());demo=false;visitorFilter='';sourceFilter='';$('connectDialog').close();load();};
$('disconnect').onclick=()=>{window.tideConnection.clear();demo=false;data=null;generation++;$('connectDialog').close();notice('');render();};
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$(button.dataset.close).close();
$('refresh').onclick=load;$('range').onchange=load;window.addEventListener('hashchange',render);load();

async function loadSearch() {
  const target=$('searchData'), ticket=generation;
  if(!target)return;
  if(demo){target.innerHTML='<p class="notice">Sample mode does not simulate Search Console data.</p>';return;}
  const request=window.tideConnection.request('/api/search-console');
  try {
    const response=await fetch(request.url,{headers:request.headers,cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('Search import unavailable');
    const result=await response.json();
    if(ticket!==generation||target!==$('searchData'))return;
    if(!Array.isArray(result.rows)||!result.rows.length){target.innerHTML='<p class="notice">No aggregate search data imported yet.</p>';return;}
    target.innerHTML='<p class="muted">Latest imported rows · independent of the revenue date filter.</p><div class="table-scroll"><table><thead><tr><th>Query / page / date</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>Position</th></tr></thead><tbody>'+result.rows.slice(0,20).map(r=>`<tr><td>${esc(r.query)}<br><small>${esc(r.page)} · ${esc(r.date)}</small></td><td>${number(r.impressions)}</td><td>${number(r.clicks)}</td><td>${(r.ctr*100).toFixed(1)}%</td><td>${Number(r.position).toFixed(1)}</td></tr>`).join('')+'</tbody></table></div><p class="muted">Showing up to 20 imported rows. These queries cannot identify individual visitors.</p>';
  } catch {if(ticket===generation&&target===$('searchData'))target.innerHTML='<p class="notice">Aggregate search data is unavailable. Revenue data is unaffected.</p>';}
}

async function queryStories(offset=0) {
  if(demo){renderStoryList();return;}
  const currentData=data, ticket=++storyGeneration;
  if(!currentData||!$('storyList'))return;
  if(!offset)$('storyList').innerHTML='<p class="muted">Searching payment history…</p>';
  const request=window.tideConnection.request('/api/stories',{days:$('range').value,q:visitorFilter,source:sourceFilter,currency,returning:statusFilter==='returning'?'true':'',attribution:statusFilter==='unattributed'?'unattributed':'',offset,limit:100});
  try {
    const response=await fetch(request.url,{headers:request.headers,cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Could not load payment history.');
    const result=await response.json();
    if(ticket!==storyGeneration||data!==currentData||!$('storyList'))return;
    data.stories=offset?[...data.stories,...result.stories]:result.stories;
    renderStoryList();
    $('storyPaging').innerHTML=`<p class="muted">${data.stories.length} of ${number(result.total)} matching stories${result.truncated?' · available history is truncated':''}.</p>${result.nextOffset!=null?'<button id="moreStories">Load more stories</button>':''}`;
    if($('moreStories'))$('moreStories').onclick=()=>queryStories(result.nextOffset);
  } catch {if(ticket===storyGeneration&&data===currentData&&$('storyList')){$('storyList').innerHTML='<p class="notice error">Payment history could not be loaded. Refresh to retry.</p>';$('storyPaging').innerHTML='';}}
}
