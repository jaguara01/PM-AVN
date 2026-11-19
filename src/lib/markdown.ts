/**
 * A small Markdown renderer for text written by a model: headings, lists, tables, bold, italic, code and [#n] line references.
 * Everything is HTML-escaped first, so model output can never inject markup.
 */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function renderMarkdown(src: string, lineHref?: (n: number) => string): string {
  const inline = (s: string) =>
    s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>')
      .replace(/\[#(\d+)\]/g, (_m, n) => (lineHref ? `<a class="ref" href="${lineHref(Number(n))}">${n}</a>` : `<span class="ref">${n}</span>`));
  const lines = esc(src).split('\n');
  let out = '';
  let list: 'ul' | 'ol' | null = null;
  const close = () => {
    if (list) out += `</${list}>`;
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m: RegExpMatchArray | null;
    if (/^\s*\|.*\|\s*$/.test(l) && lines[i + 1] && /^\s*\|[\s:\-|]+\|\s*$/.test(lines[i + 1])) {
      close();
      const row = (r: string) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      out += '<div class="tw"><table><thead><tr>' + row(l).map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) out += '<tr>' + row(lines[i++]).map((c) => `<td>${c}</td>`).join('') + '</tr>';
      i--;
      out += '</tbody></table></div>';
    } else if ((m = l.match(/^(#{1,4})\s+(.*)/))) {
      close();
      out += `<h${m[1].length + 2}>${inline(m[2])}</h${m[1].length + 2}>`;
    } else if ((m = l.match(/^\s*[-*]\s+(?:\[[ x]\]\s+)?(.*)/))) {
      if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; }
      out += `<li>${inline(m[1])}</li>`;
    } else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) {
      if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; }
      out += `<li>${inline(m[1])}</li>`;
    } else if (/^\s*---+\s*$/.test(l)) {
      close();
      out += '<hr>';
    } else if (!l.trim()) close();
    else {
      close();
      out += `<p>${inline(l)}</p>`;
    }
  }
  close();
  return out;
}
