const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseRoster, extractUnit, widestWord, fitText, fitRotatedText, resizeBox, seatAtDock, findSeatDock } = require('../editor-core.js');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`);
const rotate = (x, y, angle) => ({ x:x*Math.cos(angle)-y*Math.sin(angle), y:x*Math.sin(angle)+y*Math.cos(angle) });
const anchor = (box, x, y) => { const p=rotate(x*box.w/2,y*box.h/2,(box.rotation||0)*Math.PI/180); return {x:box.x+box.w/2+p.x,y:box.y+box.h/2+p.y}; };

test('parses mixed people and organizations with punctuation and whitespace on every line', () => {
  const people = parseRoster('张三、李四；市财政局\n华景科技有限公司，王五|陈六 / 赵七\t周八　张三');
  assert.deepEqual(people.map(p=>p.name), ['张三','李四','市财政局','华景科技有限公司','王五','陈六','赵七','周八']);
  assert.equal(people[2].kind,'organization');
  assert.equal(people[3].kind,'organization');
  assert.equal(people[0].kind,'person');
});
test('supports unit-only CSV and blank personal names, without swallowing organization names as headers', () => {
  assert.deepEqual(parseRoster('单位名称\n市文化和旅游发展服务中心\n华景科技有限公司').map(p=>p.kind), ['organization','organization']);
  const people = parseRoster('序号,姓名,单位\n1,张三,设计部\n2,,市财政局');
  assert.deepEqual(people, [{name:'张三',unit:'设计部',kind:'person'},{name:'市财政局',unit:'',kind:'organization'}]);
  assert.equal(parseRoster('华景科技有限公司\n张三').length,2);
  assert.equal(parseRoster('单位名称\n市财政局、华景科技有限公司').length,2);
  assert.equal(parseRoster('姓名,单位,职务\n张三,设计部,设计师')[0].name,'张三');
});
test('preserves quoted names and only merges entries with the same name and unit', () => {
  assert.equal(parseRoster('"North Star, Inc."、张三')[0].name,'North Star, Inc.');
  assert.equal(parseRoster('姓名,单位\n张三,设计部\n张三,设计部\n张三,财务部').length,2);
});
test('fits full long Chinese organization names without truncation or overflowing the box', () => {
  const name='市文化和旅游发展服务中心';
  const measure=(text,size)=>Array.from(text).length*size;
  for (const [w,h] of [[100,60],[48,120],[220,40]]) {
    const fit=fitText(name,w,h,24,measure);
    assert.equal(fit.lines.join(''),name);
    assert.ok(fit.height<=h);
    fit.lines.forEach(line=>assert.ok(measure(line,fit.size)<=w));
  }
});
test('eight resize handles retain the opposite anchor at 0, 90, 180, 270 and arbitrary rotations', () => {
  for (const rotation of [0,90,180,270,37]) for (const handle of ['nw','n','ne','e','se','s','sw','w']) {
    const original={x:70,y:90,w:140,h:80,rotation};
    const local=rotate(35,25,rotation*Math.PI/180);
    const resized={...original,...resizeBox(original,handle,local)};
    const x=handle.includes('e')?-1:handle.includes('w')?1:0;
    const y=handle.includes('s')?-1:handle.includes('n')?1:0;
    const before=anchor(original,x,y), after=anchor(resized,x,y);
    close(before.x,after.x); close(before.y,after.y);
    if (!/[ew]/.test(handle)) assert.equal(resized.w,original.w);
    if (!/[ns]/.test(handle)) assert.equal(resized.h,original.h);
  }
});

test('upright seat labels stay within chair bounds at every rotation', () => {
  const measure=(text,size)=>Array.from(text).length*size;
  for (const angle of [0,30,60,90,120,180,270,320]) {
    const fit=fitRotatedText('市文化和旅游发展服务中心',104,84,angle,24,measure);
    const width=Math.max(...fit.lines.map(line=>measure(line,fit.size)));
    const c=Math.abs(Math.cos(angle*Math.PI/180)),s=Math.abs(Math.sin(angle*Math.PI/180));
    assert.ok(c*width+s*fit.height<=104.001);
    assert.ok(s*width+c*fit.height<=84.001);
    assert.equal(fit.lines.join(''),'市文化和旅游发展服务中心');
  }
});
test('resize clamps dimensions and snaps only the dimensions being changed', () => {
  const box={x:0,y:0,w:103,h:87,rotation:0};
  assert.deepEqual(resizeBox(box,'e',{x:11,y:500},true),{x:0,y:0,w:110,h:87});
  assert.equal(resizeBox(box,'w',{x:1000,y:0},false,40).w,40);
});
test('chairs dock on all four sides with a ten-unit gap, and follow rotated tables', () => {
  const seat={x:0,y:0,w:120,h:80};
  for (const rotation of [0,90,180,270,25]) for (const side of ['top','bottom','left','right']) {
    const table={id:'t1',x:300,y:220,w:600,h:300,rotation};
    const dock=seatAtDock(seat,table,{side,offset:.25});
    const local=rotate(dock.x+60-table.x-300,dock.y+40-table.y-150,-rotation*Math.PI/180);
    close(side==='top'||side==='bottom'?Math.abs(local.y)-150-40:Math.abs(local.x)-300-40,10);
    const found=findSeatDock({...seat,x:dock.x+2,y:dock.y+1},[table]);
    assert.equal(found.tableId,'t1'); assert.equal(found.dockSide,side);
    close(found.rotation,dock.rotation);
  }
});
test('round and elliptical tables attach chairs along the surface normal; distant chairs stay free', () => {
  const seat={x:0,y:0,w:100,h:70};
  const table={id:'round',x:500,y:400,w:300,h:200,rotation:90,kind:'circle'};
  for (const angle of [0,Math.PI/3,Math.PI,Math.PI*1.5]) {
    const dock=seatAtDock(seat,table,{side:'round',angle});
    const actual=findSeatDock({...seat,x:dock.x,y:dock.y},[table]);
    assert.equal(actual.tableId,'round');
    assert.ok(actual.distance<15);
  }
  assert.equal(findSeatDock(seat,[table]),null);
});

test('recognises Latin units by legal suffix and institution word, leaving personal names alone', () => {
  const kind = name => parseRoster(`"${name}"`)[0].kind;
  ['North Star, Inc.', 'Acme Ltd', 'Blue Ridge LLC', 'Hanjing Corp.', 'Siemens GmbH', 'Riverside Co.',
   'Pacific Holdings', 'Tsinghua University', 'Fraunhofer Institute', 'City Transport Bureau',
   'Metro Health Foundation', 'Research Center', 'Nordic Consulting'].forEach(name =>
    assert.equal(kind(name), 'organization', name));
  ['John Smith', 'Maria Garcia', 'Sam Coleman', 'Ada Lovelace', 'Nina Sato'].forEach(name =>
    assert.equal(kind(name), 'person', name));
});
test('wraps Latin names between words and only splits a word that cannot fit alone', () => {
  const measure = (text, size) => Array.from(text).reduce((sum, char) => sum + (/[^\u0000-\u00ff]/.test(char) ? size : size * 0.58), 0);
  const fit = fitText('North Star, Inc.', 120, 90, 24, measure);
  assert.ok(fit.lines.length > 1);
  fit.lines.forEach(line => {
    assert.equal(line, line.trim());
    assert.ok(measure(line, fit.size) <= 120);
  });
  assert.equal(fit.lines.join(' '), 'North Star, Inc.');
  // A single word wider than the box still fills each line instead of overflowing.
  const narrow = fitText('Kraftfahrzeughaftpflichtversicherung', 40, 40, 12, measure);
  narrow.lines.forEach(line => assert.ok(measure(line, narrow.size) <= 40));
  assert.equal(narrow.lines.join(''), 'Kraftfahrzeughaftpflichtversicherung');
  // Chinese keeps wrapping between characters, with no spaces introduced.
  const chinese = fitText('市文化和旅游发展服务中心', 100, 60, 24, measure);
  assert.equal(chinese.lines.join(''), '市文化和旅游发展服务中心');
});

test('reports the usable line width and the widest unbreakable run, upright and rotated', () => {
  const measure = (text, size) => Array.from(text).reduce((sum, char) => sum + (/[^ -ÿ]/.test(char) ? size : size * 0.58), 0);
  assert.equal(fitText('North Star', 200, 90, 24, measure).width, 200);
  for (const angle of [0, 90, 180, 270]) {
    const fit = fitRotatedText('Nordic Consulting', 120, 80, angle, 24, measure);
    assert.ok(fit.width > 0);
    fit.lines.forEach(line => assert.ok(measure(line, fit.size) <= fit.width + 0.001));
  }
  // A chair only keeps words whole once its line is as wide as the longest word.
  assert.equal(widestWord('Nordic Consulting', 10, measure), measure('Consulting', 10));
  // Chinese breaks between characters, so a single character is the widest unbreakable run.
  assert.equal(widestWord('市文化和旅游发展服务中心', 10, measure), 10);
});

test('splits a pasted roster line into the padded name, its unit and the job title it drops', () => {
  assert.deepEqual(parseRoster('黄  成  市水路建设养护发展中心港口科科长'),
    [{ name: '黄成', unit: '市水路建设养护发展中心', kind: 'person' }]);
  assert.deepEqual(parseRoster('欧 阳 修  市文化和旅游发展服务中心'),
    [{ name: '欧阳修', unit: '市文化和旅游发展服务中心', kind: 'person' }]);
  assert.deepEqual(parseRoster('1. 黄成  市水路建设养护发展中心港口科科长'),
    [{ name: '黄成', unit: '市水路建设养护发展中心', kind: 'person' }]);
  assert.deepEqual(parseRoster('李 建 国  市财政局办公室主任'),
    [{ name: '李建国', unit: '市财政局', kind: 'person' }]);
  // A padded name with nothing after it is still one name, not two entries.
  assert.deepEqual(parseRoster('黄  成'), [{ name: '黄成', unit: '', kind: 'person' }]);
  // A bare job title names no unit, but a department does.
  assert.equal(parseRoster('赵四  高级工程师')[0].unit, '');
  assert.equal(parseRoster('赵四  财务科科长')[0].unit, '财务科');
  assert.equal(extractUnit('市水路建设养护发展中心港口科科长'), '市水路建设养护发展中心');
  assert.equal(extractUnit('主任'), '');
});
test('keeps splitting plain name lists on spaces, and keeps quoted names whole', () => {
  assert.deepEqual(parseRoster('张三 李四 王五').map(p => p.name), ['张三', '李四', '王五']);
  assert.deepEqual(parseRoster('张三 李四 王五').map(p => p.unit), ['', '', '']);
  assert.deepEqual(parseRoster('John Smith').map(p => p.name), ['John', 'Smith']);
  assert.deepEqual(parseRoster('"North Star, Inc."、张三'),
    [{ name: 'North Star, Inc.', unit: '', kind: 'organization' }, { name: '张三', unit: '', kind: 'person' }]);
  // A quoted name is taken as written, never mined for a unit.
  assert.deepEqual(parseRoster('"黄 成 市财政局办公室主任"'),
    [{ name: '黄 成 市财政局办公室主任', unit: '', kind: 'organization' }]);
  assert.deepEqual(parseRoster('市文化和旅游发展服务中心'),
    [{ name: '市文化和旅游发展服务中心', unit: '', kind: 'organization' }]);
});

test('takes a whole pasted meeting roster down to a name column and a unit column', () => {
  const paste = [
    '骆玉婷  市工业和信息化局装备工业科科长',
    '黄良驹  梧州海事局副局长',
    '任宝才  梧州海事局通航管理处处长',
    '郭  俊  市自然资源局建设项目规划科科长',
    '潘丽玉  市园区办（投资促进局）投资二科副科长',
    '卢禹成  梧州航道和船检管理中心办公室负责人',
    '邱安平  市港务发展集团有限公司党委委员、副总经理',
    '杨军平  粤桂合作特别试验区（梧州）管理委员会规划建设局业务板块负责人',
    '刘  昱  中船桂江造船有限公司总经理',
    '',
    '吴柏松  市交通运输局党组成员、副局长',
    '李家华  市水路建设养护发展中心副主任（主持工作）',
    '黄  成  市水路建设养护发展中心港口科科长'
  ].join('\n');
  assert.deepEqual(parseRoster(paste).map(p => [p.name, p.unit]), [
    ['骆玉婷', '市工业和信息化局'],
    ['黄良驹', '梧州海事局'],
    ['任宝才', '梧州海事局'],
    ['郭俊', '市自然资源局'],
    ['潘丽玉', '市园区办'],
    ['卢禹成', '梧州航道和船检管理中心'],
    ['邱安平', '市港务发展集团有限公司'],
    ['杨军平', '粤桂合作特别试验区（梧州）管理委员会'],
    ['刘昱', '中船桂江造船有限公司'],
    ['吴柏松', '市交通运输局'],
    ['李家华', '市水路建设养护发展中心'],
    ['黄成', '市水路建设养护发展中心']
  ]);
  assert.equal(parseRoster(paste).every(p => p.kind === 'person'), true);
});
test('cuts a unit at its own name, not inside a word, a bracket or a company suffix', () => {
  // 科技 must not be cut at its 科, and 集团 must carry its 有限公司 along.
  assert.equal(extractUnit('华景科技有限公司项目经理'), '华景科技有限公司');
  assert.equal(extractUnit('市港务发展集团有限公司党委委员、副总经理'), '市港务发展集团有限公司');
  assert.equal(extractUnit('西部机场集团股份有限公司总经理'), '西部机场集团股份有限公司');
  // A keyword inside brackets belongs to an aside.
  assert.equal(extractUnit('市园区办（投资促进局）投资二科副科长'), '市园区办');
  // A single character never stands alone as the whole unit.
  assert.equal(extractUnit('办公室主任'), '办公室');
  assert.equal(extractUnit('交通运输部综合规划司司长'), '交通运输部');
  // Only a title, so no unit is invented.
  assert.equal(extractUnit('高级工程师'), '');
  assert.equal(extractUnit('副主任（主持工作）'), '');
});
test('keeps a line that names one person whole, even when a job title contains a separator', () => {
  // The 、 in 党组成员、副局长 must not split the line into two people.
  assert.deepEqual(parseRoster('吴柏松  市交通运输局党组成员、副局长'),
    [{ name: '吴柏松', unit: '市交通运输局', kind: 'person' }]);
  // A line that is genuinely a list of names still splits on the same separator.
  assert.deepEqual(parseRoster('张三、李四、王五').map(p => p.name), ['张三', '李四', '王五']);
  assert.deepEqual(parseRoster('市财政局、华景科技有限公司').map(p => p.kind), ['organization', 'organization']);
});
