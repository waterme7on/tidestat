import { registerMessages, translate, tr } from './product-ui.js';
registerMessages({
  'TideStat — See the story behind every dollar.':'TideStat — 看见每一笔收入背后的故事。',
  'See the story behind every dollar. TideStat connects website visits, journeys and verified payments in one visual revenue story.':'TideStat 将网站访问、用户旅程和已验证付款串成直观的收入故事。',
  'Skip to content':'跳到正文', 'TideStat home':'TideStat 首页', 'Main navigation':'主导航', 'The story':'产品故事', 'Docs':'文档', 'Open dashboard':'打开控制台',
  'Every visit has a next chapter':'每一次访问，都有下一章', 'See the story':'每一笔收入', 'behind':'都有', 'every dollar.':'它的故事。',
  'From the first click to the final payment.':'从第一次点击，到最后一笔付款。',
  'Follow the people, paths and moments that bring your website revenue.':'看清访客走过的路径，以及带来网站收入的关键时刻。',
  'Explore the live demo':'体验交互演示', 'Connect your website':'接入你的网站', 'Your visitors. Their journeys. The revenue behind them.':'你的访客，他们的旅程，以及背后的收入。',
  'Illustrative revenue journey: organic search, article, pricing, returning visit, checkout and verified payment':'收入旅程示意：自然搜索、文章、价格页、回访、结账和已验证付款',
  'ONE JOURNEY. THE WHOLE STORY.':'一条旅程，看清整个故事。', 'ILLUSTRATION':'示意图', 'The first hello':'第一次相遇', 'Organic search':'自然搜索',
  'Something brought them back':'有些内容，让他再次回来', 'Returning visit':'再次访问', 'Checkout started':'开始结账', 'Now you know how it happened':'现在，你知道收入如何发生', 'Verified payment':'已验证付款',
  'Every step connected. No missing context invented.':'连起每一步，不编造缺失的信息。', 'Less guessing. More seeing.':'少一点猜测，多一点看见。', 'Take a story for a spin.':'亲手探索一个收入故事。',
  'Open full demo':'打开完整演示', 'TIDESTAT / REVENUE STORIES':'TIDESTAT / 收入故事', 'Interactive demo · sample data':'交互演示 · 示例数据',
  'Interactive TideStat Revenue Story demo with illustrative sample data':'TideStat 收入故事交互演示，使用示例数据', 'Explore the':'你也可以在新窗口打开', 'full interactive demo':'完整交互演示', 'in its own window.':'。',
  'Choose a journey. Open a visitor. Follow the payment.':'选择旅程，打开访客，追溯付款。', 'The dots were always there.':'线索一直都在。', 'Now they tell a story.':'现在，它们串成了故事。', 'A living website.':'看见网站的实时动态。', 'A traceable path to revenue.':'追溯每条收入路径。',
  'Visitors, in motion':'访客正在移动', '01 / THE PEOPLE':'01 / 访客', 'See your website come alive.':'看见网站活跃起来。',
  'Real-time visitors, moving characters and Website Footprints. See where the journey begins.':'实时访客、移动角色和网站足迹，带你看见旅程从哪里开始。', 'Explore the live map':'探索实时地图',
  'First visit':'首次访问', 'Pricing':'价格页', 'Checkout':'结账', '02 / THE PATH':'02 / 路径', 'Follow the moments that matter.':'跟随那些关键时刻。',
  'Connect sources, pages, return visits and checkout. One timeline, across sessions.':'将来源、页面、回访和结账，串成跨越多次访问的时间线。', 'Follow a journey':'跟随一条旅程',
  'PAYMENT RECEIVED':'已收到付款', 'Connected to a story':'已关联收入故事', '03 / THE REVENUE':'03 / 收入', 'Know where the money came from.':'知道这笔钱从哪里来。',
  'Verified payments meet observed behavior. Find valuable paths and investigate drop-off.':'将已验证付款关联到真实行为，发现有价值的路径，排查流失环节。', 'Understand attribution':'了解归因规则',
  'One story. Two ways in.':'一个故事，两种接入方式。', 'Start where your website lives.':'从你的网站开始。', 'NPM / Browser SDK':'NPM / 浏览器 SDK',
  'Your stack. A few meaningful events.':'沿用你的技术栈，记录关键事件。', 'Connect your custom website.':'接入自建网站。', 'Read the SDK guide →':'阅读 SDK 指南 →',
  'From storefront to paid order.':'从店铺浏览，到订单付款。', 'Keep the journey connected.':'让整条旅程连在一起。', 'Read the Shopify guide →':'阅读 Shopify 指南 →',
  'Signed Stripe & Shopify payments · Site-level data isolation · Aggregate-only Search Console context':'Stripe 与 Shopify 签名验证付款 · 网站间数据隔离 · Search Console 仅提供汇总数据',
  'There’s a story behind your next customer.':'你的下一位客户，也有自己的故事。', 'Make it visible.':'让它清晰可见。', 'Open your dashboard':'打开你的控制台', 'Start with the setup guide →':'从接入指南开始 →',
  'See the story behind every dollar.':'看见每一笔收入背后的故事。', 'Footer':'页脚导航', 'Privacy & data':'隐私与数据', 'Documentation':'使用文档'
});
translate();

const description="See the story behind every dollar. TideStat connects website visits, journeys and verified payments in one visual revenue story.";
const updateDescription=()=>document.querySelector('meta[name="description"]')?.setAttribute("content",tr(description));
updateDescription();
window.addEventListener("tide:languagechange",updateDescription);
