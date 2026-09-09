/* Shared by the browser and Node's dependency-free regression checks. */
(function (root) {
  "use strict";
  function parse(text) {
    const data = JSON.parse(text);
    const object = value => value && typeof value === "object" && !Array.isArray(value);
    if (!object(data) || !Array.isArray(data.items) || !Array.isArray(data.people)) {
      throw new Error("请选择 SeatMate 导出的 JSON 布局文件");
    }
    if (data.items.length > 10000 || data.people.length > 10000) throw new Error("布局或名单超过 10000 个，请拆分后导入");
    const ids = new Set();
    const validId = (id, prefix) => {
      if (id === undefined || id === null || id === "") { let index = ids.size; while (ids.has(`${prefix}-import-${index}`)) index++; return `${prefix}-import-${index}`; }
      if (typeof id !== "string" || ids.has(id)) throw new Error("布局文件包含重复或无效的对象编号");
      return id;
    };
    const number = (value, fallback, positive = false) => {
      if (value === undefined) return fallback;
      const result = Number(value);
      if (!Number.isFinite(result) || Math.abs(result) > 100000 || (positive && result <= 0)) throw new Error("布局文件包含无效的尺寸或坐标");
      return result;
    };
    const string = (value, fallback = "") => typeof value === "string" ? value : fallback;
    const items = data.items.map(item => {
      if (!object(item) || !["table", "seat", "shape", "label"].includes(item.type)) throw new Error("布局文件包含无法识别的对象");
      const id = validId(item.id, "item"); ids.add(id);
      return {
        id, type: item.type, x: number(item.x, 0), y: number(item.y, 0),
        w: number(item.w, item.type === "seat" ? 86 : 160, true), h: number(item.h, item.type === "seat" ? 48 : 80, true),
        rotation: number(item.rotation, 0), label: string(item.label), text: string(item.text),
        fill: string(item.fill), stroke: string(item.stroke), kind: ["rect", "roundRect", "circle", "triangle"].includes(item.kind) ? item.kind : "rect",
        groupId: string(item.groupId) || undefined, personId: string(item.personId) || null,
        size: number(item.size, 28, true), nameSize: number(item.nameSize, 24, true), nameColor: string(item.nameColor, "#4e3721"),
        fontFamily: ["sans", "hei", "song", "kai"].includes(item.fontFamily) ? item.fontFamily : undefined,
        color: string(item.color, "#4e3721"), textColor: string(item.textColor, "#6f4b20"), boxText: !!item.boxText, textLayoutVersion: item.textLayoutVersion === 2 ? 2 : 0,
        isTable: !!item.isTable, showUnit: !!item.showUnit, tableId: string(item.tableId) || undefined,
        dockSide: ["top","bottom","left","right","round"].includes(item.dockSide) ? item.dockSide : undefined,
        dockOffset: number(item.dockOffset, 0.5), dockAngle: number(item.dockAngle, 0),
        baseW: item.baseW === undefined ? undefined : number(item.baseW, 0, true),
        baseH: item.baseH === undefined ? undefined : number(item.baseH, 0, true)
      };
    });
    const people = data.people.map(person => {
      if (!object(person) || typeof person.name !== "string") throw new Error("布局文件包含无效的参会人员");
      const id = validId(person.id, "person"); ids.add(id);
      return { id, name: person.name, unit: string(person.unit), kind: person.kind === "organization" ? "organization" : person.kind === "person" ? "person" : undefined, assignedSeatId: null };
    });
    const byPerson = new Map(people.map(person => [person.id, person]));
    items.filter(item => item.type === "seat").forEach(seat => {
      if (seat.tableId && (!seat.dockSide || !items.some(item => item.id === seat.tableId && (item.type === "table" || item.isTable)))) seat.tableId = undefined;
      const person = byPerson.get(seat.personId);
      if (!person || person.assignedSeatId) seat.personId = null;
      else person.assignedSeatId = seat.id;
    });
    const view = object(data.view) ? data.view : {};
    const selectedIds = (Array.isArray(data.selectedIds) ? data.selectedIds : [data.selectedId]).filter(id => items.some(item => item.id === id));
    let draftImage = null;
    if (data.draftImage) {
      if (!object(data.draftImage) || !/^data:image\/(png|jpeg|webp|gif);base64,/i.test(data.draftImage.src || "")) throw new Error("草稿必须是布局文件内嵌的 PNG、JPG、WebP 或 GIF 图片");
      draftImage = { src: data.draftImage.src, name: string(data.draftImage.name), importedAt: string(data.draftImage.importedAt) };
    }
    return {
      version: 1, themeVersion: data.themeVersion === 2 ? 2 : 0, title: string(data.title, "未命名会议室").slice(0, 80), items, people, draftImage,
      selectedIds, selectedId: selectedIds[0] || null,
      view: { x: number(view.x, 0), y: number(view.y, 0), w: number(view.w, 1600, true), h: number(view.h, 1000, true) },
      settings: { snap: data.settings?.snap !== false, showReference: !!data.settings?.showReference, snapTables: data.settings?.snapTables !== false, drawFill: string(data.settings?.drawFill, "#edbe4c"), drawText: string(data.settings?.drawText, "#4e3721"), drawFont: ["sans", "hei", "song", "kai"].includes(data.settings?.drawFont) ? data.settings.drawFont : "sans" }
    };
  }
  if (typeof module === "object" && module.exports) module.exports = { parse };
  else root.SeatMateProject = { parse };
})(typeof globalThis !== "undefined" ? globalThis : this);
