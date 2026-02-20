const API_BASE = '';

function $(sel, el = document) {
  return el.querySelector(sel);
}

function render(app) {
  const root = document.getElementById('app');
  root.innerHTML = '';
  root.appendChild(app);
}

function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value' && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) el.value = v == null ? '' : v;
    else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k !== 'value' && v != null && v !== false) el.setAttribute(k, v === true ? '' : String(v));
  });
  children.forEach((c) => {
    if (typeof c === 'string') el.appendChild(document.createTextNode(c));
    else if (c) el.appendChild(c);
  });
  return el;
}

function App() {
  let query = '';
  let loading = false;
  let result = null; // { parsed, items } or { error }
  let mounted = false;

  function setState(updates) {
    if (updates.query !== undefined) query = updates.query;
    if (updates.loading !== undefined) loading = updates.loading;
    if (updates.result !== undefined) result = updates.result;
    if (mounted) updateDOM();
  }

  async function doSearch() {
    const q = (query || '').trim();
    if (!q) return;
    setState({ loading: true, result: null });
    try {
      const res = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      const result = {
        error: data.error || null,
        parsed: data.parsed || null,
        items: data.items || [],
        fallbackLinks: data.fallbackLinks || [],
        zhetaokeSearchUrl: data.zhetaokeSearchUrl || null,
        htmlContent: data.htmlContent || null,
      };
      setState({ result, loading: false });
    } catch (e) {
      setState({ result: { error: e.message || '网络错误' }, loading: false });
    }
  }

  function updateDOM() {
    const container = $('.app');
    if (!container) return;

    const parsedEl = $('.parsed-wrap', container);
    const msgEl = $('.message-wrap', container);
    const listEl = $('.results-wrap', container);

    if (parsedEl) {
      parsedEl.textContent = '';
      if (result?.parsed) {
        parsedEl.appendChild(
          createElement('div', { className: 'parsed' }, [
            createElement('span', {}, ['已解析：关键词「']),
            createElement('strong', {}, [result.parsed.keyword]),
            createElement('span', {}, ['」，价格区间 ']),
            createElement('strong', {}, [`${result.parsed.minPrice} - ${result.parsed.maxPrice} 元`]),
          ])
        );
      }
    }

    if (msgEl) {
      msgEl.textContent = '';
      if (loading) msgEl.appendChild(createElement('div', { className: 'message' }, ['正在搜索…']));
      else if (result?.error && !result?.zhetaokeSearchUrl) msgEl.appendChild(createElement('div', { className: 'message error' }, [result.error]));
    }

    const links = result?.fallbackLinks || [];

    if (listEl) {
      listEl.textContent = '';
      if (result && result.items && result.items.length > 0) {
        const list = createElement('div', { className: 'results' });
        result.items.forEach((it) => {
          const link = it.link || '#';
          const itemEl = createElement(
            'a',
            { className: 'item item-link', href: link, target: '_blank', rel: 'noopener noreferrer' },
            [
              createElement('img', { className: 'item-pic', src: it.pic || '', alt: '' }),
              createElement('div', { className: 'item-body' }, [
                createElement('h3', { className: 'item-title' }, [it.title || '商品']),
                createElement('div', { className: 'item-meta' }, [
                  createElement('span', { className: 'item-price' }, [`¥ ${Number(it.price).toFixed(2)}`]),
                  it.coupon ? createElement('span', { className: 'item-coupon' }, [it.coupon]) : null,
                ]),
              ]),
              createElement('span', { className: 'item-go' }, ['去购买']),
            ]
          );
          list.appendChild(itemEl);
        });
        listEl.appendChild(list);
        if (result.fallbackLinks?.length) {
          const tip = createElement('p', { className: 'fallback-tip secondary' }, ['或前往：']);
          const linkRow = createElement('div', { className: 'fallback-links' });
          result.fallbackLinks.forEach((l) => {
            linkRow.appendChild(
              createElement('a', { className: 'fallback-link', href: l.url, target: '_blank', rel: 'noopener noreferrer' }, [l.name])
            );
          });
          listEl.appendChild(tip);
          listEl.appendChild(linkRow);
        }
      } else if (result && links.length > 0) {
        const tip = createElement('p', { className: 'fallback-tip' }, ['您也可以直接前往各平台搜索：']);
        const linkRow = createElement('div', { className: 'fallback-links' });
        links.forEach((l) => {
          linkRow.appendChild(createElement('a', { className: 'fallback-link', href: l.url, target: '_blank', rel: 'noopener noreferrer' }, [l.name]));
        });
        listEl.appendChild(tip);
        listEl.appendChild(linkRow);
      }
    }
  }

  const app = createElement('div', { className: 'app' }, [
    createElement('header', { className: 'header' }, [
      createElement('h1', {}, ['优惠购']),
      createElement('p', {}, ['输入需求，自动解析关键词与价格，按价格从低到高展示']),
    ]),
    createElement('div', { className: 'search-box' }, [
      createElement('input', {
        type: 'text',
        placeholder: '例如：价格1000元左右的手机',
        value: query,
        oninput(e) {
          setState({ query: e.target.value });
        },
        onkeydown(e) {
          if (e.key === 'Enter') doSearch();
        },
      }),
      createElement('button', {
        type: 'button',
        disabled: loading,
        onclick: doSearch,
      }, ['搜索']),
    ]),
    createElement('div', { className: 'parsed-wrap' }),
    createElement('div', { className: 'message-wrap' }),
    createElement('div', { className: 'results-wrap' }),
  ]);

  mounted = true;
  updateDOM();
  return app;
}

render(App());
