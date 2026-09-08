/* Account sessions are HttpOnly cookies. Legacy read tokens remain tab-local. */
(() => {
 const key='tidestat.connection';let account={},epoch=0;
 const read=()=>{try{return JSON.parse(sessionStorage.getItem(key)||'{}');}catch{return {};}};
 const save=value=>{try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}};
 const api={
  get(){const saved=read();return {...account,...saved,session:!!account.user&&!saved.token};},
  set(site,token){if(token)save({site,token});else this.select(site);},
  select(site){if(!account.sites?.some(s=>s.id===site))return false;save({site});window.dispatchEvent(new Event('tide:sitechange'));return true;},
  clear(){epoch++;account={};try{sessionStorage.removeItem(key);}catch{}},
  async refresh(){const ticket=++epoch;try{
   const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('No account session');const result=await response.json();
   let sites=[];if(result.user){const sitesResponse=await fetch('/api/sites',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000)});if(!sitesResponse.ok)throw Error('Sites unavailable');sites=(await sitesResponse.json()).sites||[];}
   if(ticket!==epoch)return this.get();account={...result,sites};const saved=read();if(!saved.token&&(!saved.site||!sites.some(s=>s.id===saved.site)))save(sites.length?{site:sites[0].id}:{});
  }catch{if(ticket===epoch)account={};}return this.get();},
  request(path,params={}){const {site,token}=this.get(),url=new URL(path,location.href);if(site)url.searchParams.set('site',site);for(const [key,value] of Object.entries(params))if(value!==''&&value!=null)url.searchParams.set(key,value);return {url:url.pathname+url.search,headers:token?{Authorization:`Bearer ${token}`}:{}};}
 };
 window.tideConnection=api;
 api.ready=new URLSearchParams(location.search).get('demo')==='1'?Promise.resolve(api.get()):api.refresh();
})();
