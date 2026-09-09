const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../project-format.js');
const parseObject = value => parse(JSON.stringify(value));
const project = () => ({
  title: '产品会议', items: [{ id: 's1', type: 'seat', x: 100, y: 200, w: 86, h: 48, personId: 'p1' }],
  people: [{ id: 'p1', name: '林嘉宁', unit: '设计部' }],
  view: { x: 10, y: 20, w: 800, h: 500 }, settings: { snap: false, showReference: false }
});

test('restores a saved project, roster, assignment and viewport', () => {
  const result = parseObject(project());
  assert.equal(result.title, '产品会议');
  assert.equal(result.people[0].unit, '设计部');
  assert.equal(result.people[0].assignedSeatId, 's1');
  assert.deepEqual(result.view, { x: 10, y: 20, w: 800, h: 500 });
  assert.equal(result.settings.snap, false);
  assert.deepEqual(parseObject(result), result);
});

test('rejects invalid structures before the caller can replace its project', () => {
  for (const value of [null, [], {}, { items: [null], people: [] }, { items: [], people: [null] }, { items: [{ type: 'unknown' }], people: [] }]) {
    assert.throws(() => parseObject(value));
  }
  assert.throws(() => parse('{ broken json'));
});

test('rejects malformed viewports, duplicate ids and invalid geometry', () => {
  const zeroView = project(); zeroView.view.w = 0;
  const badSeat = project(); badSeat.items[0].w = -10;
  const duplicate = project(); duplicate.items.push({ ...duplicate.items[0] });
  const infinity = project(); infinity.view.h = 'Infinity';
  for (const value of [zeroView, badSeat, duplicate, infinity]) assert.throws(() => parseObject(value));
});

test('repairs dangling and duplicate person assignments', () => {
  const value = project();
  value.items.push({ id: 's2', type: 'seat', personId: 'p1' }, { id: 's3', type: 'seat', personId: 'missing' });
  const result = parseObject(value);
  assert.equal(result.items[0].personId, 'p1');
  assert.equal(result.items[1].personId, null);
  assert.equal(result.items[2].personId, null);
  assert.equal(result.people[0].assignedSeatId, 's1');
});

test('retains embedded reference images and rejects external image sources', () => {
  const value = project();
  value.draftImage = { src: 'data:image/png;base64,iVBORw0KGgo=', name: '会场.png' };
  assert.equal(parseObject(value).draftImage.name, '会场.png');
  value.draftImage.src = 'https://example.com/tracking.png';
  assert.throws(() => parseObject(value));
});

test('supports legacy layouts with omitted dimensions and single selection', () => {
  const result = parseObject({ items: [{ id: 'legacy-seat', type: 'seat' }], people: [], selectedId: 'legacy-seat' });
  assert.deepEqual(result.selectedIds, ['legacy-seat']);
  assert.equal(result.items[0].w, 86);
  assert.equal(result.items[0].h, 48);
  assert.deepEqual(result.view, { x: 0, y: 0, w: 1600, h: 1000 });
});

test('round-trips palette colors, text boxes, organizations and chair attachments', () => {
  const value=project();
  value.themeVersion=2;
  value.items.push({id:'t1',type:'shape',kind:'circle',isTable:true,fill:'#edbe4c',textColor:'#544335'});
  Object.assign(value.items[0],{fill:'#e9c89a',nameColor:'#ad6252',tableId:'t1',dockSide:'round',dockAngle:1.2,dockOffset:0.5,textLayoutVersion:2});
  value.items.push({id:'text1',type:'label',text:'会议服务中心',w:200,h:60,boxText:true,color:'#c18b54'});
  value.people[0]={id:'p1',name:'市文化和旅游发展服务中心',kind:'organization'};
  Object.assign(value.settings,{snapTables:true,drawFill:'#e9c89a',drawText:'#544335'});
  const parsed=parseObject(value);
  assert.deepEqual(parseObject(parsed),parsed);
  assert.equal(parsed.items[0].tableId,'t1');
  assert.equal(parsed.items[0].nameColor,'#ad6252');
  assert.equal(parsed.items[2].boxText,true);
  assert.equal(parsed.people[0].kind,'organization');
});

test('detaches invalid table links and generates missing ids without collisions', () => {
  const parsed=parseObject({items:[{id:'item-import-1',type:'seat',tableId:'missing',dockSide:'top'},{type:'table'}],people:[]});
  assert.equal(parsed.items[0].tableId,undefined);
  assert.notEqual(parsed.items[0].id,parsed.items[1].id);
});

test('remembers whether a chair was filled from the name column or the unit column', () => {
  const value = project();
  value.items[0].showUnit = true;
  value.items.push({ id: 's2', type: 'seat', personId: null, showUnit: false });
  value.items.push({ id: 's3', type: 'seat', personId: null });
  const parsed = parseObject(value);
  assert.equal(parsed.items[0].showUnit, true);
  assert.equal(parsed.items.find(item => item.id === 's2').showUnit, false);
  // A chair saved before the setting existed shows the name, as it always did.
  assert.equal(parsed.items.find(item => item.id === 's3').showUnit, false);
  assert.deepEqual(parseObject(parsed), parsed);
  // Anything that is not a real flag is normalised rather than trusted.
  const messy = project();
  messy.items[0].showUnit = 'unit';
  assert.equal(parseObject(messy).items[0].showUnit, true);
});
