(function (root) {
  "use strict";
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const radians = angle => angle * Math.PI / 180;
  const rotate = (x, y, angle) => ({ x: x * Math.cos(radians(angle)) - y * Math.sin(radians(angle)), y: x * Math.sin(radians(angle)) + y * Math.cos(radians(angle)) });
  const chineseUnit = /公司|集团|企业|大学|学院|学校|医院|研究所|研究院|办公室|委员会|政府|协会|基金会|合作社|部门|中心|支部|(?:局|厅|处|科|部|院|厂|站|队)$/;
  // Latin units are recognised by legal suffixes and institution words; ambiguous two-letter
  // forms need the abbreviating period so a personal name is never mistaken for a unit.
  const latinUnit = /(?:^|[\s,.&/-])(?:inc|ltd|llc|llp|plc|corp|gmbh|pty|pte)\b|(?:^|[\s,.&/-])(?:co|sa|nv|bv)\.|\b(?:company|corporation|incorporated|limited|holdings?|group|university|college|school|academy|institute|hospital|foundation|association|society|committee|council|bureau|department|ministry|agency|authority|cent(?:er|re)|laborator(?:y|ies)|partners|consulting|technologies|systems|solutions|services)\b/i;
  const organization = name => chineseUnit.test(name) || latinUnit.test(name);

  // Entry separators: Chinese and Latin comma, semicolon, enumeration comma, bar, slash, tab and every line break.
  const separator = new RegExp("[、，,；;|｜/\\n\\r\\t\u2028\u2029]");
  // Quoted parts are reported so a name the writer protected with quotes is never taken apart again.
  function splitParts(text, whitespace = true) {
    const parts = []; let value = ""; let quoted = false, wasQuoted = false;
    const push = () => { parts.push({ value: value.trim(), quoted: wasQuoted }); value = ""; wasQuoted = false; };
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (char === '"') {
        if (quoted && text[index + 1] === '"') { value += '"'; index++; }
        else { quoted = !quoted; wasQuoted = true; }
      } else if (!quoted && (separator.test(char) || (whitespace && /\s/.test(char)))) {
        push();
      } else value += char;
    }
    push();
    return parts;
  }

  function splitEntries(text, whitespace = true) {
    return splitParts(text, whitespace).map(part => part.value);
  }

  // A pasted roster line reads "黄  成  市水路建设养护发展中心港口科科长": a name padded out to align
  // the column, then the unit with the job title run onto the end. These pick the three apart.
  const cjk = "\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff";
  const oneCjk = new RegExp(`^[${cjk}]$`);
  const cjkName = new RegExp(`^[${cjk}·•]{2,6}$`);

  // A unit name ends at one of these. Whole words come first, because they are unambiguous: 科技
  // must never be cut at its 科, and 集团有限公司 must not stop at 集团.
  const strongUnit = /服务中心|管理中心|指挥中心|研究中心|活动中心|培训中心|中心|委员会|管理委员会|研究院|研究所|设计院|基金会|合作社|事务所|办事处|股份有限公司|有限责任公司|有限公司|总公司|分公司|公司|集团|大学|学院|学校|医院|协会|商会|政府|银行|党委|工会|支部|部队|军区|海关|法院|检察院|电视台|报社|出版社/g;
  // Single characters that end a unit name. They are only consulted when no whole word matched,
  // and never at the very start, where they would leave a one-character unit.
  const weakUnit = /[局厅署办委院部处科室站所厂司队]/g;
  const companyTail = /^(?:股份|有限|责任|总|分)*公司/;
  const jobTitle = /书记|主任|局长|厅长|处长|科长|部长|院长|校长|厂长|站长|队长|组长|所长|馆长|台长|社长|理事长|董事长|总经理|副总经理|经理|总监|主管|主席|委员|干事|科员|专员|秘书|参谋|工程师|研究员|教授|讲师|老师|医师|医生|护士|记者|编辑|顾问|代表|领队|随员|翻译|职员|负责人|干部/;
  const departmentTail = /(部|科|处|室|局|厅|站|队|组|所|馆|台|园|校|司|院|厂)$/;

  // A keyword inside brackets belongs to an aside — "市园区办（投资促进局）" ends at 办, not at 局.
  function bracketed(text, index) {
    let depth = 0;
    for (let position = 0; position < index; position++) {
      if ("（(【[".includes(text[position])) depth++;
      else if ("）)】]".includes(text[position])) depth = Math.max(0, depth - 1);
    }
    return depth > 0;
  }

  function firstBoundary(value, pattern, minimumIndex) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(value))) {
      if (match.index >= minimumIndex && !bracketed(value, match.index)) return match;
    }
    return null;
  }

  // The unit is everything up to the first keyword that ends an organisation name; the job title
  // running onto the end is dropped. A line carrying only a title leaves the unit empty.
  function extractUnit(text) {
    const value = String(text || "").replace(/^[，,、:：\s·-]+/, "").trim();
    if (!value) return "";
    const match = firstBoundary(value, strongUnit, 0) || firstBoundary(value, weakUnit, 1);
    if (match) {
      let end = match.index + match[0].length;
      const tail = companyTail.exec(value.slice(end));
      if (tail) end += tail[0].length;
      return value.slice(0, end);
    }
    const title = jobTitle.exec(value);
    const head = (title ? value.slice(0, title.index) : value).trim();
    return departmentTail.test(head) ? head : "";
  }

  const describesUnit = text => Boolean(text) && (firstBoundary(text, strongUnit, 0) !== null || jobTitle.test(text) || organization(text));

  function rosterEntry(name, unit = "") {
    return { name, unit, kind: organization(name) ? "organization" : "person" };
  }

  const stripBullet = value => String(value || "").replace(/^[•●▪·]\s*/, "").replace(/^\d+[.．)）、]\s*/, "").trim();

  // One line that names a person and their unit, or null when the line is a list of names instead.
  function parseRecord(line) {
    const text = stripBullet(line);
    if (!text || text.includes('"')) return null;
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return null;

    // "黄  成" and "欧 阳 修" pad a name one character at a time to line the column up.
    const padded = [];
    while (padded.length < tokens.length && oneCjk.test(tokens[padded.length])) padded.push(tokens[padded.length]);
    if (padded.length >= 2 && padded.length <= 4) {
      const tail = tokens.slice(padded.length).join("");
      if (!tail) return rosterEntry(padded.join(""));
      if (describesUnit(tail)) return rosterEntry(padded.join(""), extractUnit(tail));
      return null;
    }

    const tail = tokens.slice(1).join("");
    if (cjkName.test(tokens[0]) && !organization(tokens[0]) && describesUnit(tail)) {
      return rosterEntry(tokens[0], extractUnit(tail));
    }
    return null;
  }

  // A pasted roster is one record per line. A line naming a person and their unit is kept whole,
  // so the 、 in "党组成员、副局长" never splits it into two people.
  function parseLine(line) {
    const record = parseRecord(line);
    if (record) return record.name ? [record] : [];
    return splitParts(line, true).flatMap(part => {
      const value = part.quoted ? part.value : stripBullet(part.value);
      return value ? [rosterEntry(value)] : [];
    });
  }

  function parseRoster(text) {
    const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) return [];
    const names = /^(姓名|名字|人员|参会人员|参会名称|名称|name|full name|person)$/i;
    const units = /^(单位|单位名称|部门|部门名称|公司|公司名称|机构|组织|unit|dept|department|company|organization)$/i;
    const header = splitEntries(lines[0], false);
    const nameIndex = header.findIndex(cell => names.test(cell));
    const unitIndex = header.findIndex(cell => units.test(cell));
    const hasHeader = nameIndex >= 0 || unitIndex >= 0;
    let people;
    if (hasHeader && header.length === 1) {
      people = splitEntries(lines.slice(1).join("\n")).map(name => ({ name, unit:"", kind:unitIndex >= 0 || organization(name) ? "organization" : "person" }));
    } else if (hasHeader) {
      people = lines.slice(1).map(line => {
        const row = splitEntries(line, false);
        const name = nameIndex >= 0 ? (row[nameIndex] || "") : "";
        const unit = unitIndex >= 0 ? (row[unitIndex] || "") : "";
        return { name: name || unit, unit: name ? unit : "", kind: !name || organization(name) ? "organization" : "person" };
      });
    } else {
      people = lines.flatMap(parseLine);
    }
    const seen = new Set();
    return people.filter(person => {
      const key = `${person.name}::${person.unit}`;
      if (!person.name || seen.has(key)) return false;
      seen.add(key); return true;
    });
  }

  const estimatedWidth = (text, size) => Array.from(text).reduce((sum, char) => sum + (/[^\u0000-\u00ff]/.test(char) ? size : size * 0.58), 0);
  const breakAnywhere = /[ᄀ-ᇿ⺀-〿぀-鿿가-힯豈-﫿︰-﹏＀-￯]/;

  // Chinese may wrap between any two characters; a Latin word stays whole so a name never splits mid-word.
  function tokenize(paragraph) {
    const tokens = [];
    let word = "";
    for (const char of Array.from(paragraph)) {
      if (/\s/.test(char) || breakAnywhere.test(char)) {
        if (word) { tokens.push(word); word = ""; }
        tokens.push(/\s/.test(char) ? " " : char);
      } else word += char;
    }
    if (word) tokens.push(word);
    return tokens;
  }

  function wrap(text, width, size, measure = estimatedWidth) {
    const lines = [];
    String(text).split("\n").forEach(paragraph => {
      let line = "";
      const push = () => { lines.push(line.replace(/ +$/, "")); line = ""; };
      for (const token of tokenize(paragraph)) {
        if (token === " ") { if (line) line += " "; continue; }
        let piece = token;
        if (line && measure(line + piece, size) > width) push();
        while (measure(piece, size) > width && Array.from(piece).length > 1) {
          let head = "";
          for (const char of Array.from(piece)) {
            if (head && measure(head + char, size) > width) break;
            head += char;
          }
          line = head; push();
          piece = piece.slice(head.length);
        }
        line += piece;
      }
      push();
    });
    return lines;
  }

  function fitText(text, width, height, preferredSize = 24, measure = estimatedWidth) {
    width = Math.max(1, width); height = Math.max(1, height);
    let size = Math.max(1, preferredSize), lines = [];
    while (size >= 1) {
      lines = wrap(text, width, size, measure);
      if (lines.length * size * 1.3 <= height && lines.every(line => measure(line, size) <= width)) break;
      size -= 0.5;
    }
    size = Math.max(1, size);
    return { lines, size, lineHeight: size * 1.3, height: lines.length * size * 1.3, width };
  }

  // The widest run wrap() will not break, so a caller can size a box that keeps every word whole.
  function widestWord(text, size, measure = estimatedWidth) {
    return tokenize(String(text)).reduce((widest, token) => token === " " ? widest : Math.max(widest, measure(token, size)), 0);
  }

  function resizeBox(origin, handle, delta, snap = false, minimum = 24) {
    const local = rotate(delta.x, delta.y, -(origin.rotation || 0));
    let w = origin.w, h = origin.h;
    if (handle.includes("e")) w += local.x;
    if (handle.includes("w")) w -= local.x;
    if (handle.includes("s")) h += local.y;
    if (handle.includes("n")) h -= local.y;
    if (snap) { if (/[ew]/.test(handle)) w = Math.round(w / 10) * 10; if (/[ns]/.test(handle)) h = Math.round(h / 10) * 10; }
    w = Math.max(minimum, w); h = Math.max(minimum, h);
    const shift = rotate(handle.includes("e") ? (w - origin.w) / 2 : handle.includes("w") ? (origin.w - w) / 2 : 0,
      handle.includes("s") ? (h - origin.h) / 2 : handle.includes("n") ? (origin.h - h) / 2 : 0, origin.rotation || 0);
    return { x: origin.x + origin.w / 2 + shift.x - w / 2, y: origin.y + origin.h / 2 + shift.y - h / 2, w, h };
  }

  // The text stays upright while its chair rotates. Fit its actual rotated bounds.
  function fitRotatedText(text, width, height, angle, preferredSize = 24, measure = estimatedWidth) {
    const c=Math.abs(Math.cos(radians(angle))), s=Math.abs(Math.sin(radians(angle)));
    for (let size=preferredSize; size>=1; size-=0.5) {
      for (let count=1; count<=Math.min(100,Array.from(String(text)).length || 1); count++) {
        const h=count*size*1.3;
        if (s*h>width || c*h>height) break;
        const w=Math.min(c>1e-6 ? (width-s*h)/c : Infinity, s>1e-6 ? (height-c*h)/s : Infinity);
        if (w<=0) continue;
        const lines=wrap(text,w,size,measure);
        if (lines.length<=count && lines.every(line=>measure(line,size)<=w)) return {lines,size,lineHeight:size*1.3,height:lines.length*size*1.3,width:w};
      }
    }
    return fitText(text,Math.max(1,Math.min(width,height)/2),Math.max(1,Math.min(width,height)/2),1,measure);
  }

  function seatAtDock(seat, table, dock) {
    const gap = 10;
    const halfDepth = seat.h / 2 + gap;
    let x, y, rotation;
    if (dock.side === "round") {
      const angle = dock.angle || 0;
      const nx = Math.cos(angle) / (table.w / 2), ny = Math.sin(angle) / (table.h / 2);
      const length = Math.hypot(nx, ny);
      x = Math.cos(angle) * table.w / 2 + nx / length * halfDepth;
      y = Math.sin(angle) * table.h / 2 + ny / length * halfDepth;
      rotation = Math.atan2(ny, nx) * 180 / Math.PI - 90;
    } else {
      const offset = clamp(dock.offset ?? 0.5, 0, 1);
      if (dock.side === "top" || dock.side === "bottom") {
        const span = Math.max(0, table.w - seat.w);
        x = (offset - 0.5) * span;
        y = (table.h / 2 + halfDepth) * (dock.side === "top" ? -1 : 1);
        rotation = dock.side === "top" ? 180 : 0;
      } else {
        const span = Math.max(0, table.h - seat.w);
        x = (table.w / 2 + halfDepth) * (dock.side === "left" ? -1 : 1);
        y = (offset - 0.5) * span;
        rotation = dock.side === "left" ? 90 : -90;
      }
    }
    const point = rotate(x, y, table.rotation || 0);
    return { x: table.x + table.w / 2 + point.x - seat.w / 2, y: table.y + table.h / 2 + point.y - seat.h / 2, rotation: rotation + (table.rotation || 0), tableId: table.id, dockSide: dock.side, dockOffset: dock.offset ?? 0.5, dockAngle: dock.angle || 0 };
  }

  function findSeatDock(seat, tables, threshold = 75) {
    let best = null;
    for (const table of tables) {
      const local = rotate(seat.x + seat.w / 2 - table.x - table.w / 2, seat.y + seat.h / 2 - table.y - table.h / 2, -(table.rotation || 0));
      const sides = table.kind === "circle" ? ["round"] : ["top", "bottom", "left", "right"];
      for (const side of sides) {
        const horizontal = side === "top" || side === "bottom";
        const span = Math.max(1, (horizontal ? table.w : table.h) - seat.w);
        const dock = { side, offset: clamp((horizontal ? local.x : local.y) / span + 0.5, 0, 1), angle: Math.atan2(local.y / table.h, local.x / table.w) };
        const result = seatAtDock(seat, table, dock);
        const distance = Math.hypot(result.x - seat.x, result.y - seat.y);
        if (distance <= threshold && (!best || distance < best.distance)) best = { ...result, distance };
      }
    }
    return best;
  }

  const api = { parseRoster, parseLine, extractUnit, isOrganization: organization, wrap, widestWord, fitText, fitRotatedText, resizeBox, findSeatDock, seatAtDock };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SeatMateCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
