export interface TextSegment { text: string; color?: string; bold?: boolean; italic?: boolean; underline?: boolean; size?: number; icon?: boolean }
/** A small allowlisted game-markup parser; unknown HTML remains escaped literal text. */
export function gameTextSegments(value: string): TextSegment[] {
  const result: TextSegment[] = [], stack: { tag: string; style: Omit<TextSegment, 'text'> }[] = [];
  const input = value.replace(/\\n/g, '\n');
  const tokens = /<[^<>]{1,160}>/g;
  let position = 0;
  const append = (text: string, extra: Omit<TextSegment, 'text'> = {}) => { if (text) result.push({ ...Object.assign({}, ...stack.map(s => s.style)), ...extra, text }); };
  const icons: Record<string, string> = { Icon_Normal: '●', Icon_Special: '◆', Icon_SpecialReady: '◆', Icon_Evade: '↪', Icon_QTE: '✦', Icon_UltimateReady: '✦', Icon_Switch: '⇄' };
  for (const match of input.matchAll(tokens)) {
    append(input.slice(position, match.index)); position = match.index! + match[0].length;
    const token = match[0], close = /^<\/(color|size|b|i|u)>$/i.exec(token), open = /^<(color|size|b|i|u)(?:=([^>]+))?>$/i.exec(token), icon = /^<IconMap:([A-Za-z0-9_]+)>$/.exec(token);
    if (/^<br\s*\/?>$/i.test(token)) append('\n');
    else if (icon) append(icons[icon[1]] ?? '◈', { icon: true });
    else if (close && stack[stack.length - 1]?.tag === close[1].toLowerCase()) stack.pop();
    else if (open && stack.length < 16) {
      const tag = open[1].toLowerCase(), parameter = open[2];
      if (tag === 'color' && /^#(?:[a-f\d]{6}|[a-f\d]{8})$/i.test(parameter ?? '')) stack.push({ tag, style: { color: parameter } });
      else if (tag === 'size' && /^\d{1,3}$/.test(parameter ?? '')) stack.push({ tag, style: { size: Math.min(32, Math.max(10, Number(parameter))) } });
      else if (tag === 'b' && !parameter) stack.push({ tag, style: { bold: true } });
      else if (tag === 'i' && !parameter) stack.push({ tag, style: { italic: true } });
      else if (tag === 'u' && !parameter) stack.push({ tag, style: { underline: true } });
      else append(token);
    } else append(token);
  }
  append(input.slice(position)); return result;
}
