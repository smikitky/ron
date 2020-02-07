import Handlebars from 'handlebars';
import formatReference from './formatReference';
import formatTag from './formatTag';

/**
 * Provides a custom markdown-it plug-in
 * for supporting custom backtick tags like `` `references` ``.
 * `register` is passed to `MarkdownIt.use()`.
 */
const replaceBacktick = () => {
  let ctx, reporter, refCounter, figCounter, tabCounter;

  const replace = (state, silent) => {
    if (state.src[state.pos] !== '`') return false;

    const regex = /^`((ref|fig|tab):([^`]+)|(references|figures|tables))`/;
    const match = state.src.slice(state.pos).match(regex);
    if (!match) return false;

    const [matched, , type1, tag, type2] = match;
    const type = type1 || type2;
    state.pos += matched.length;

    const addRawHtmlToken = html => {
      const token = state.push('html_inline', 'code', 0);
      token.markup = matched;
      token.content = html;
    };

    const {
      references,
      refTagMap,
      figures,
      figTagMap,
      tables,
      tabTagMap,
      styles
    } = ctx;

    const replaceRef = () => {
      const refs = tag.split(',');
      const indexes = [];
      refs.forEach(tag => {
        const reference = references[tag];
        if (!reference) throw new Error('Unknown reference tag: ' + tag);
        if (!refTagMap.has(tag)) {
          const refIndex = refCounter++;
          refTagMap.set(tag, refIndex);
          reporter.info(`ref #${refIndex} = ${tag}`);
        }
        if (indexes.indexOf(refTagMap.get(tag)) < 0)
          indexes.push(refTagMap.get(tag));
      });
      const html = Handlebars.compile(styles.citation.format)({
        items: formatTag(indexes, styles.citation).replace(
          /(\d+)/g,
          '<span class="ref">$1</span>'
        )
      });
      addRawHtmlToken(html);
    };

    const replaceFigOrTab = (list, map, name, className) => {
      const item = list[tag];
      if (!item) throw new Error(`Unknown ${name} tag: ` + tag);
      const index = map.has(tag)
        ? map.get(tag)
        : (() => {
            const index = name === 'figure' ? figCounter++ : tabCounter++;
            map.set(tag, index);
            reporter.info(`${name} #${index} = ${tag}`);
            return index;
          })();
      addRawHtmlToken(`<span class="${className}">${index}</span>`);
    };

    const replaceFig = () => {
      replaceFigOrTab(figures, figTagMap, 'figure', 'fig');
    };

    const replaceTab = () => {
      replaceFigOrTab(tables, tabTagMap, 'table', 'tab');
    };

    const replaceReferences = () => {
      const items = Object.keys(references)
        .filter(r => refTagMap.has(r))
        .sort((a, b) => refTagMap.get(a) - refTagMap.get(b))
        .map(k => {
          const item = references[k];
          const index = refTagMap.get(k);
          const formatted = formatReference(
            item,
            styles.reference.format
          ).trim();
          return `  <li id="ref-${index}" data-doi="${escape(
            item.doi || ''
          )}" value="${index}">${formatted}</li>`;
        })
        .join('\n');
      addRawHtmlToken(`<ol class="references">\n${items}\n</ol>`);
    };

    const replaceFigures = () => {
      const items = Object.keys(figures)
        .filter(f => figTagMap.has(f))
        .sort((a, b) => figTagMap.get(a) - figTagMap.get(b))
        .map(tag => {
          const index = figTagMap.get(tag);
          const figure = figures[tag];
          return (
            `<figure id="fig-${index}">\n` +
            `  <img src="fig-${index}.png" />\n` +
            `  <figcaption><b>Figure ${index}</b> ${figure.caption}</figcaption>\n` +
            `</figure>`
          );
        });
      addRawHtmlToken(items.join('\n'));
    };

    const replaceTables = () => {
      const items = Object.keys(tables)
        .filter(f => tabTagMap.has(f))
        .sort((a, b) => tabTagMap.get(a) - tabTagMap.get(b))
        .map(tag => {
          const index = tabTagMap.get(tag);
          const table = tables[tag];
          return (
            `<figure id="tab-${index}">\n` +
            `  ${table.content}\n` +
            `  <figcaption><b>Table ${index}</b> ${table.caption}</figcaption>\n` +
            `</figure>`
          );
        });
      addRawHtmlToken(items.join('\n'));
    };

    ({
      ref: replaceRef,
      fig: replaceFig,
      tab: replaceTab,
      references: replaceReferences,
      figures: replaceFigures,
      tables: replaceTables
    }[type]());
    return true;
  };

  const register = md => {
    // Inserted before markdown's default backtick parser
    md.inline.ruler.before('backticks', 'replaceref', replace);
  };

  const reset = (theContext, theReporter) => {
    ctx = theContext;
    reporter = theReporter;
    refCounter = 1;
    figCounter = 1;
    tabCounter = 1;
  };

  return { reset, register };
};

export default replaceBacktick;
