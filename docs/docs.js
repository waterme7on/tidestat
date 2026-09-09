import { tr, locale, registerMessages } from '../product-ui.js';
registerMessages({"Connect your website": "接入你的网站", "Getting started": "开始使用", "1. Add your website": "1. 添加网站", "2. Install the tracker": "2. 安装埋点", "3. Verify and explore": "3. 验证并查看分析", "Who does what?": "你和 TideStat 分别负责什么？", "Optional payment data": "可选：支付数据", "TideStat stores your events and turns them into visual analytics. Add the tracker to your website; we run the analytics service.": "TideStat 存储网站事件并提供可视化分析。你只需给网站添加埋点，分析服务由我们运行。", "Sign in to TideStat": "登录 TideStat", "and add your website URL. Select the website to open its setup guide. Your website ID and registered origin are supplied for you.": "并添加网站链接，选择网站后打开接入引导。平台会生成网站 ID 并注册网站来源。", "Publish the changes to your own website, check its connection in TideStat, then open the website and allow analytics through its consent flow. Visit a page and check for a new pageview. Once verified, explore your dashboard, live visitors and site journeys.": "将改动发布到你的网站，在 TideStat 检查连接，再打开网站并通过现有同意流程允许分析。访问页面后检查新访问事件；验证通过即可查看仪表盘、实时访客和网站足迹。", "You add the tracker and control visitor consent on your website. TideStat receives and stores the events, isolates your websites, and provides visual reports. Never place private credentials in the tracker.": "你负责添加埋点和网站的访客同意流程。TideStat 负责接收、存储事件，隔离各网站数据并提供可视化报表。不要将私有凭证放入埋点代码。", "Pageviews do not require a payment integration. Verified revenue requires a separately configured Stripe or Shopify connector. Connector activation currently needs TideStat operator assistance; a self-service credential form is not yet available. Do not deploy your own analytics service or send signing secrets in an Agent task.": "页面访问不依赖支付接入。已验证收入需要单独配置 Stripe 或 Shopify 连接器，目前需 TideStat 运营方协助开通，尚无自助凭证配置页面。无需自行部署分析服务，也不要在 Agent 任务中传递签名密钥。", "Recommended: copy the Agent task from Website setup into your website project. It reads the TideStat Skill, adds the hosted tracker and connects your existing consent flow. You can also": "推荐将网站接入页的 Agent 指令复制到你的网站项目。Agent 会读取 Skill、添加托管埋点并连接现有同意流程。你也可以", "download the Skill": "下载 Skill", "or follow the": "或参照", "manual browser guide": "手动埋点指南", ". No npm package, TideStat repository or server deployment is required for the hosted tracker.": "。使用托管埋点不需要安装 npm 包、获取 TideStat 仓库或部署服务器。"});
const links = [...document.querySelectorAll('nav a[data-page]')];
const pages = [...document.querySelectorAll('article[data-page]')];
const sidebar = document.querySelector('.sidebar');
const menu = document.querySelector('.menu');
function showPage() {
  const requested = location.hash.slice(1) || 'start';
  if (requested === 'content') return;
  const selected = pages.find(page => page.dataset.page === requested) || pages[0];
  pages.forEach(page => { page.hidden = page !== selected; });
  links.forEach(link => { if (link.dataset.page === selected.dataset.page) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  updateTitle(selected);
  sidebar.classList.remove('open'); menu.setAttribute('aria-expanded', 'false');
  window.scrollTo(0, 0);
}
function updateTitle(selected = pages.find(page => !page.hidden)) {
  if (selected) document.title = tr(selected.dataset.docTitle) + ' · ' + tr('TideStat Docs');
}
window.addEventListener('hashchange', showPage);
menu.addEventListener('click', () => { const open = sidebar.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); });
function filterPages() {
  const query = document.querySelector('.search').value.trim().toLocaleLowerCase(locale());
  links.forEach(link => { const page = pages.find(p => p.dataset.page === link.dataset.page); link.hidden = !page.textContent.toLocaleLowerCase(locale()).includes(query); });
  document.querySelectorAll('.nav-group').forEach(group => { group.hidden = ![...group.nextElementSibling.querySelectorAll('a')].some(a => !a.hidden); });
  document.querySelector('.empty').hidden = links.some(link => !link.hidden);
}
document.querySelector('.search').addEventListener('input', filterPages);
window.addEventListener('tide:languagechange', () => { updateTitle(); filterPages(); document.querySelectorAll('.copy').forEach(button => { button.textContent = tr('Copy'); button.setAttribute('aria-label', tr('Copy code example')); }); });
document.querySelectorAll('pre').forEach(pre => {
  const wrap = document.createElement('div'); wrap.className = 'code-wrap'; pre.before(wrap); wrap.append(pre);
  const button = document.createElement('button'); button.className = 'copy'; button.type = 'button'; button.setAttribute('data-no-translate', ''); button.textContent = tr('Copy'); button.setAttribute('aria-label', tr('Copy code example'));
  button.addEventListener('click', async () => { try { await navigator.clipboard.writeText(pre.textContent); button.textContent = tr('Copied'); } catch { button.textContent = tr('Select to copy'); const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(pre); selection.removeAllRanges(); selection.addRange(range); } setTimeout(() => { button.textContent = tr('Copy'); }, 2000); }); wrap.append(button);
});
showPage();
