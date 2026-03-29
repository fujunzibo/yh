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

function copyBtn(label, textToCopy, title) {
  return createElement(
    'button',
    {
      type: 'button',
      className: 'btn-copy kouling-copy',
      title: title || '复制',
      onclick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(textToCopy).then(() => {
          const btn = e.target;
          const oldText = btn.textContent;
          btn.textContent = '已复制';
          setTimeout(() => { btn.textContent = oldText; }, 1500);
        });
      },
    },
    [label]
  );
}

function renderItemCard(it) {
  const link = it.link || '#';
  const retail = it.retailUrl && it.retailUrl !== link ? it.retailUrl : '';
  const hasTkl = !!(it.taoKouLing && it.taoKouLing.trim());
  const hasJkl = !!(it.jingKouLing && it.jingKouLing.trim());
  const commissionRow =
    it.commissionLabel || (it.commissionEstimate > 0)
      ? createElement('div', { className: 'item-commission' }, [
          it.commissionLabel ? createElement('span', { className: 'commission-label' }, [it.commissionLabel]) : null,
          it.commissionEstimate > 0 && !it.commissionLabel
            ? createElement('span', { className: 'commission-label' }, [`预估佣 ¥${Number(it.commissionEstimate).toFixed(2)}`])
            : null,
        ].filter(Boolean))
      : null;

  const koulingBtns = [
    hasTkl ? copyBtn('复制淘口令', it.taoKouLing, '复制后打开淘宝 App') : null,
    hasJkl ? copyBtn('复制京口令', it.jingKouLing, '复制后打开京东 App') : null,
    link && link !== '#' ? copyBtn('复制推广链接', link, '含您 PID 的推广链接') : null,
    retail ? copyBtn('复制商品页链接', retail, '原始商品页（非 PID 链）') : null,
  ].filter(Boolean);

  return createElement('div', { className: 'item-wrap' }, [
    createElement(
      'a',
      { className: 'item item-link', href: link, target: '_blank', rel: 'noopener noreferrer' },
      [
        createElement('img', { className: 'item-pic', src: it.pic || '', alt: '' }),
        createElement('div', { className: 'item-body' }, [
          createElement('h3', { className: 'item-title' }, [it.title || '商品']),
          createElement('div', { className: 'item-meta' }, [
            createElement('span', { className: 'item-price' }, [`¥ ${Number(it.price || 0).toFixed(2)}（参考）`]),
            it.source ? createElement('span', { className: 'item-source' }, [it.source]) : null,
            it.coupon ? createElement('span', { className: 'item-coupon' }, [it.coupon]) : null,
          ]),
          commissionRow,
        ]),
        createElement('span', { className: 'item-go' }, ['推广购买']),
      ]
    ),
    koulingBtns.length ? createElement('div', { className: 'item-kouling' }, koulingBtns) : null,
  ].filter(Boolean));
}

const CHANNELS = [
  { key: 'taobao', title: '淘宝客（折淘客 PID 转链）', source: '淘宝', listKey: 'taobaoItems', totalKey: 'taobaoTotal', retailUrlKey: 'taobaoRetailSearchUrl', pidLabel: 'ZHETAOKE_TAOBAO_PID' },
  { key: 'jd', title: '京东联盟（折京客 / 京东 PID 转链）', source: '京东', listKey: 'jdItems', totalKey: 'jdTotal', retailUrlKey: 'jdRetailSearchUrl', pidLabel: 'ZHETAOKE_JD_PID / unionId' },
  { key: 'douyin', title: '抖音联盟（关键词推广商品）', source: '抖音', listKey: 'douyinItems', totalKey: 'douyinTotal', retailUrlKey: 'douyinRetailSearchUrl', pidLabel: '抖音联盟参数（按后台授权）' },
  { key: 'vip', title: '唯品会联盟（关键词推广商品）', source: '唯品会', listKey: 'vipItems', totalKey: 'vipTotal', retailUrlKey: 'vipRetailSearchUrl', pidLabel: '唯品会联盟授权参数' },
  { key: 'pdd', title: '拼多多联盟（多多进宝）', source: '拼多多', listKey: 'pddItems', totalKey: 'pddTotal', retailUrlKey: 'pddRetailSearchUrl', pidLabel: '拼多多联盟参数（按后台授权）' },
];

function App() {
  let keyword = '';
  let priceMin = '';
  let priceMax = '';
  let loading = false;
  /** 请求进行中的目标页码（用于区分「搜索」与「下一页」加载提示；勿用旧 result.page） */
  let loadingPage = null;
  let result = null;
  let mounted = false;

  function setState(updates) {
    if (updates.keyword !== undefined) keyword = updates.keyword;
    if (updates.priceMin !== undefined) priceMin = updates.priceMin;
    if (updates.priceMax !== undefined) priceMax = updates.priceMax;
    if (updates.loading !== undefined) loading = updates.loading;
    if (updates.loadingPage !== undefined) loadingPage = updates.loadingPage;
    if (updates.result !== undefined) result = updates.result;
    if (mounted) updateDOM();
  }

  function buildSearchBody(page, { resetSession = false, nextPageIntent = false } = {}) {
    const kw = (keyword || '').trim();
    const body = { keyword: kw, page, pageSize: 20 };
    if (resetSession) body.resetSession = true;
    if (nextPageIntent) body.nextPageIntent = true;
    const minStr = String(priceMin || '').trim();
    const maxStr = String(priceMax || '').trim();
    if (minStr !== '') {
      const n = parseFloat(minStr);
      if (Number.isFinite(n) && n >= 0) body.minPrice = n;
    }
    if (maxStr !== '') {
      const n = parseFloat(maxStr);
      if (Number.isFinite(n) && n >= 0) body.maxPrice = n;
    }
    return body;
  }

  function resolveSearchPage(raw) {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) return Math.floor(raw);
    return 1;
  }

  async function doSearch(rawPage, { resetSession = false, nextPageIntent = false } = {}) {
    const page = resolveSearchPage(rawPage);
    const kw = (keyword || '').trim();
    if (!kw) return;
    setState({ loading: true, loadingPage: page, result: page === 1 && resetSession ? null : result });
    try {
      const res = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSearchBody(page, { resetSession, nextPageIntent })),
      });
      const rawText = await res.text();
      let data = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch (_) {
        data = null;
      }
      if (!data || typeof data !== 'object') {
        throw new Error(
          '后端未返回有效 JSON（通常是 server 未启动或已崩溃）。请先运行 npm run server，再重试。'
        );
      }
      setState({
        result: {
          error: data.error || null,
          apiHint: data.apiHint || null,
          parsed: data.parsed || null,
          taobaoItems: data.taobaoItems || [],
          jdItems: data.jdItems || [],
          taobaoTotal: data.taobaoTotal ?? 0,
          jdTotal: data.jdTotal ?? 0,
          taobaoTotalPages: data.taobaoTotalPages ?? 1,
          jdTotalPages: data.jdTotalPages ?? 1,
          items: data.items || [],
          total: data.total ?? 0,
          page: data.page ?? 1,
          pageSize: data.pageSize ?? 20,
          totalPages: data.totalPages ?? 1,
          fallbackLinks: data.fallbackLinks || [],
          zhetaokeSearchUrl: data.zhetaokeSearchUrl || null,
          dataSource: data.dataSource || null,
          quoteNote: data.quoteNote || null,
          flowNote: data.flowNote || null,
          taobaoRetailSearchUrl: data.taobaoRetailSearchUrl || null,
          jdRetailSearchUrl: data.jdRetailSearchUrl || null,
          douyinItems: data.douyinItems || [],
          vipItems: data.vipItems || [],
          pddItems: data.pddItems || [],
          douyinTotal: data.douyinTotal ?? 0,
          vipTotal: data.vipTotal ?? 0,
          pddTotal: data.pddTotal ?? 0,
          douyinRetailSearchUrl: data.douyinRetailSearchUrl || null,
          vipRetailSearchUrl: data.vipRetailSearchUrl || null,
          pddRetailSearchUrl: data.pddRetailSearchUrl || null,
          channelHints: data.channelHints || [],
          moreWavesAvailable: data.moreWavesAvailable !== false,
          newTaobaoCount: data.newTaobaoCount,
          newJdCount: data.newJdCount,
        },
        loading: false,
        loadingPage: null,
      });
    } catch (e) {
      setState({ result: { error: e.message || '网络错误' }, loading: false, loadingPage: null });
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
      if (loading) {
        const targetPage = loadingPage != null ? loadingPage : result?.page ?? 1;
        const msg =
          targetPage > 1
            ? '正在加载下一页（若需续拉联盟，本次最多合并一波新数据）…'
            : '正在搜索淘宝客与京东联盟商品…';
        msgEl.appendChild(createElement('div', { className: 'message' }, [msg]));
      }
      else if (result?.apiHint) {
        msgEl.appendChild(createElement('div', { className: 'message warn' }, [result.apiHint]));
      } else if (result?.error && !result?.zhetaokeSearchUrl) {
        msgEl.appendChild(createElement('div', { className: 'message error' }, [result.error]));
      } else if (result?.newTaobaoCount != null || result?.newJdCount != null) {
        const nt = result.newTaobaoCount ?? 0;
        const nj = result.newJdCount ?? 0;
        if (nt + nj > 0) {
          msgEl.appendChild(
            createElement('div', { className: 'message info' }, [
              `本次从联盟补充并合并：淘宝 ${nt} 条、京东 ${nj} 条（已去重）。`,
            ])
          );
        }
      }
    }

    const links = result?.fallbackLinks || [];

    if (listEl) {
      listEl.textContent = '';

      if (result?.flowNote) {
        listEl.appendChild(createElement('div', { className: 'flow-note' }, [result.flowNote]));
      }
      if (result?.channelHints?.length) {
        listEl.appendChild(
          createElement(
            'div',
            { className: 'flow-note' },
            [createElement('strong', {}, ['渠道诊断：']), ' ', result.channelHints.join(' ')]
          )
        );
      }

      const hasAnyItems = CHANNELS.some((c) => (result?.[c.listKey] || []).length > 0);
      /** 已有多页或当前不在第 1 页时，即使本屏无商品也要保留分页，否则会整页空白且无法返回 */
      const keepNavShell =
        result &&
        (hasAnyItems || (result.page ?? 1) > 1 || (result.totalPages ?? 1) > 1);

      if (keepNavShell) {
        if (hasAnyItems) {
          const wrap = createElement('div', { className: 'results-dual' });

          if (result.dataSource || result.quoteNote) {
            wrap.appendChild(
              createElement('div', { className: 'data-source-hint' }, [
                result.dataSource
                  ? createElement('span', {}, [
                      createElement('span', { className: 'data-source-label' }, ['数据：']),
                      createElement('strong', {}, [result.dataSource]),
                    ])
                  : null,
                result.quoteNote ? createElement('span', { className: 'quote-note' }, [` ${result.quoteNote}`]) : null,
              ].filter(Boolean))
            );
          }

          CHANNELS.forEach((ch, idx) => {
            const items = result?.[ch.listKey] || [];
            const total = result?.[ch.totalKey] ?? 0;
            const retailUrl = result?.[ch.retailUrlKey] || null;
            const header = createElement('div', { className: 'channel-header' }, [
              createElement('h2', { className: 'channel-title' }, [`${idx + 1}、${ch.title}`]),
              createElement('p', { className: 'channel-sub' }, [
                '关键词已在该平台联盟推广商品中匹配；可用参数 ',
                createElement('strong', {}, [ch.pidLabel]),
                `。本列共 ${total} 条，本页展示 ${items.length} 条。`,
              ]),
              retailUrl
                ? createElement('a', {
                  className: 'channel-retail-link',
                  href: retailUrl,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                }, [`打开${ch.source}官网搜索对照 →`])
                : null,
            ].filter(Boolean));
            const block = createElement('section', { className: 'channel-block' }, [
              header,
              createElement('div', { className: 'results' }, items.map(renderItemCard)),
            ]);
            wrap.appendChild(block);
          });
          listEl.appendChild(wrap);
        } else {
          listEl.appendChild(
            createElement('div', { className: 'page-empty-banner' }, [
              createElement('p', { className: 'page-empty-title' }, ['本页暂无商品']),
              createElement('p', { className: 'page-empty-desc' }, [
                '这一屏在去重后与前面页重复或联盟未返回新数据。请点「上一页」回到有商品的页，或再试「下一页」/ 换关键词搜索。',
              ]),
            ])
          );
        }

        if (result.totalPages > 1) {
          listEl.appendChild(
            createElement('div', { className: 'pagination' }, [
              createElement('button', {
                type: 'button',
                className: 'pagination-btn',
                disabled: result.page <= 1,
                onclick: () => doSearch(result.page - 1),
              }, ['上一页']),
              createElement('span', { className: 'pagination-info' }, [
                `第 ${result.page} / ${result.totalPages} 页 · 淘宝 ${result.taobaoTotal ?? 0} · 京东 ${result.jdTotal ?? 0} · 抖音 ${result.douyinTotal ?? 0} · 唯品会 ${result.vipTotal ?? 0} · 拼多多 ${result.pddTotal ?? 0}`,
                result.moreWavesAvailable
                  ? createElement('span', { className: 'pagination-waves-hint' }, [
                      ' · 在最后一页点「下一页」时，若列表不够会续拉一波联盟数据',
                    ])
                  : null,
              ].filter(Boolean)),
              createElement('button', {
                type: 'button',
                className: 'pagination-btn',
                title: '翻到下一页；若当前合并列表不够该页，会自动向联盟再拉一批并合并',
                disabled: loading || (result.page >= result.totalPages && !result.moreWavesAvailable),
                onclick: () => doSearch(result.page + 1, { nextPageIntent: true }),
              }, ['下一页']),
            ])
          );
        } else if (result.moreWavesAvailable && hasAnyItems) {
          listEl.appendChild(
            createElement('div', { className: 'pagination' }, [
              createElement('span', { className: 'pagination-info' }, [
                `当前共 ${result.totalPages} 页；点「下一页」可继续翻页，不足时会自动续拉联盟数据。`,
              ]),
              createElement('button', {
                type: 'button',
                className: 'pagination-btn',
                title: '继续拉取联盟数据并合并到当前搜索结果',
                disabled: loading,
                onclick: () => doSearch(result.totalPages + 1, { nextPageIntent: true }),
              }, ['下一页']),
            ])
          );
        }

        if (links.length) {
          listEl.appendChild(createElement('p', { className: 'fallback-tip secondary' }, ['更多入口：']));
          const linkRow = createElement('div', { className: 'fallback-links' });
          links.forEach((l) => {
            linkRow.appendChild(
              createElement('a', { className: 'fallback-link', href: l.url, target: '_blank', rel: 'noopener noreferrer' }, [l.name])
            );
          });
          listEl.appendChild(linkRow);
        }
      } else if (result && links.length > 0) {
        listEl.appendChild(createElement('p', { className: 'fallback-tip' }, ['暂无联盟商品数据，您可前往：']));
        const linkRow = createElement('div', { className: 'fallback-links' });
        links.forEach((l) => {
          linkRow.appendChild(
            createElement('a', { className: 'fallback-link', href: l.url, target: '_blank', rel: 'noopener noreferrer' }, [l.name])
          );
        });
        listEl.appendChild(linkRow);
      }
    }
  }

  const app = createElement('div', { className: 'app' }, [
    createElement('header', { className: 'header' }, [
      createElement('h1', {}, ['优惠购']),
      createElement('p', {}, ['一次搜索：淘宝客高佣商品 + 京东联盟商品，分别生成推广链接']),
    ]),
    createElement('div', { className: 'search-box' }, [
      createElement('div', { className: 'search-row' }, [
        createElement('label', { className: 'search-label', htmlFor: 'search-keyword' }, ['品名']),
        createElement('input', {
          id: 'search-keyword',
          type: 'text',
          className: 'search-input search-input-grow',
          placeholder: '例如：荣耀手机、蓝牙耳机',
          value: keyword,
          oninput(e) {
            setState({ keyword: e.target.value });
          },
          onkeydown(e) {
            if (e.key === 'Enter') doSearch(1, { resetSession: true });
          },
        }),
      ]),
      createElement('div', { className: 'search-row search-row-actions' }, [
        createElement('label', { className: 'search-label', htmlFor: 'search-price-min' }, ['价格']),
        createElement('div', { className: 'price-range' }, [
          createElement('input', {
            id: 'search-price-min',
            type: 'number',
            className: 'search-input search-input-price',
            placeholder: '最低',
            min: '0',
            step: '1',
            value: priceMin,
            oninput(e) {
              setState({ priceMin: e.target.value });
            },
            onkeydown(e) {
              if (e.key === 'Enter') doSearch(1, { resetSession: true });
            },
          }),
          createElement('span', { className: 'price-sep' }, ['—']),
          createElement('input', {
            id: 'search-price-max',
            type: 'number',
            className: 'search-input search-input-price',
            placeholder: '最高',
            min: '0',
            step: '1',
            value: priceMax,
            oninput(e) {
              setState({ priceMax: e.target.value });
            },
            onkeydown(e) {
              if (e.key === 'Enter') doSearch(1, { resetSession: true });
            },
          }),
          createElement('span', { className: 'price-unit' }, ['元']),
        ]),
        createElement('button', {
          type: 'button',
          className: 'search-submit',
          disabled: loading,
          onclick: () => doSearch(1, { resetSession: true }),
        }, ['搜索']),
      ]),
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
