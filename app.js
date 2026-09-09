(() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const STORAGE_KEY = "seatmate.meeting.layout.v3";
  const LEGACY_STORAGE_KEY = "tableset.meeting.layout.v3";
  const DRAFT_PLACEHOLDER = "assets/draft-placeholder.svg";
  const WORKSPACE = { width: 1600, height: 1000 };
  const PALETTE = ["#f1dba3", "#efd0ad", "#e9d4bd", "#f4dfa6", "#e4caa8", "#edcfb5", "#f2e4c9", "#dbc6a5", "#eed1bc", "#e6d9b5"];


  // Locally installed families only, so a layout renders and exports the same without any web font.
  const FONT_STACKS = {
    sans: '"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif',
    hei: '"SimHei", "Heiti SC", "Noto Sans CJK SC", "Arial Black", sans-serif',
    song: '"SimSun", "Songti SC", "Source Han Serif SC", Georgia, serif',
    kai: '"KaiTi", "Kaiti SC", STKaiti, "Segoe Script", serif'
  };
  const FONT_LABELS = { sans: "默认（雅黑）", hei: "黑体", song: "宋体", kai: "楷体" };
  const fontStack = family => FONT_STACKS[family] || FONT_STACKS.sans;


  const els = {
    stage: document.querySelector("#stage"),
    referenceLayer: document.querySelector("#referenceLayer"),
    itemsLayer: document.querySelector("#itemsLayer"),
    draftLayer: document.querySelector("#draftLayer"),
    statusLine: document.querySelector("#statusLine"),
    roomNameInput: document.querySelector("#roomNameInput"),
    canvasTitle: document.querySelector("#canvasTitle"),
    selectionHint: document.querySelector("#selectionHint"),
    toolGrid: document.querySelector("#toolGrid"),
    undoBtn: document.querySelector("#undoBtn"),
    redoBtn: document.querySelector("#redoBtn"),
    saveBtn: document.querySelector("#saveBtn"),
    exportPngBtn: document.querySelector("#exportPngBtn"),
    exportJsonBtn: document.querySelector("#exportJsonBtn"),
    importJsonBtn: document.querySelector("#importJsonBtn"),
    clearLayoutBtn: document.querySelector("#clearLayoutBtn"),
    projectFile: document.querySelector("#projectFile"),
    draftImportBtn: document.querySelector("#draftImportBtn"),
    draftAutoBtn: document.querySelector("#draftAutoBtn"),
    draftClearBtn: document.querySelector("#draftClearBtn"),
    draftFile: document.querySelector("#draftFile"),
    zoomOutBtn: document.querySelector("#zoomOutBtn"),
    fitBtn: document.querySelector("#fitBtn"),
    zoomInBtn: document.querySelector("#zoomInBtn"),
    snapToggle: document.querySelector("#snapToggle"),
    referenceToggle: document.querySelector("#referenceToggle"),
    referenceSection: document.querySelector("#referenceSection"),
    referenceImage: document.querySelector("#referenceImage"),
    referencePreviewBtn: document.querySelector("#referencePreviewBtn"),
    draftViewer: document.querySelector("#draftViewer"),
    draftViewerTitle: document.querySelector("#draftViewerTitle"),
    draftViewerStage: document.querySelector("#draftViewerStage"),
    draftViewerImage: document.querySelector("#draftViewerImage"),
    draftViewerZoomOut: document.querySelector("#draftViewerZoomOut"),
    draftViewerReset: document.querySelector("#draftViewerReset"),
    draftViewerZoomIn: document.querySelector("#draftViewerZoomIn"),
    draftViewerClose: document.querySelector("#draftViewerClose"),
    selectAllBtn: document.querySelector("#selectAllBtn"),
    rotateLeftBtn: document.querySelector("#rotateLeftBtn"),
    rotateRightBtn: document.querySelector("#rotateRightBtn"),
    groupBtn: document.querySelector("#groupBtn"),
    ungroupBtn: document.querySelector("#ungroupBtn"),
    duplicateBtn: document.querySelector("#duplicateBtn"),
    deleteBtn: document.querySelector("#deleteBtn"),
    peopleInput: document.querySelector("#peopleInput"),
    loadPeopleBtn: document.querySelector("#loadPeopleBtn"),
    peopleFileBtn: document.querySelector("#peopleFileBtn"),
    peopleFile: document.querySelector("#peopleFile"),
    personSearch: document.querySelector("#personSearch"),
    autoAssignBtn: document.querySelector("#autoAssignBtn"),
    clearAssignBtn: document.querySelector("#clearAssignBtn"),
    clearPeopleBtn: document.querySelector("#clearPeopleBtn"),
    peopleList: document.querySelector("#peopleList"),
    rosterCount: document.querySelector("#rosterCount"),
    inspector: document.querySelector("#inspector")
  };

  const ui = Object.fromEntries(["canvasEmpty", "blankStartBtn", "zoomValue", "saveState", "toolHint", "totalPeople", "assignedPeople", "pendingPeople", "assignmentProgress", "progressText", "rosterFilter", "rosterImport", "rosterPanel", "inspectorPanel", "editPropertiesBtn", "focusBtn", "helpBtn", "appDialog", "dialogTitle", "dialogMessage", "dialogContent", "dialogCancel", "dialogConfirm", "toast", "toastMessage", "toastUndo", "toastClose", "paletteHint", "customColor", "colorValue", "snapTablesToggle"].map(id => [id, document.getElementById(id)]));
  const textMeasureContext = document.createElement("canvas").getContext("2d");
  let colorTarget = "fill";
  let dismissedEmpty = false;
  let spaceTool = null;
  let toastTimer = null;
  let rosterDrag = null;
  let suppressRosterClickUntil = 0;
  let state = loadState() || createInitialState();
  let currentTool = "select";
  let action = null;
  let draft = null;
  let history = [];
  let redoStack = [];
  let saveTimer = null;
  let draftViewer = { scale: 1, x: 0, y: 0, drag: null };

  normalizeState();
  bindEvents();
  bindWorkspaceEvents();
  renderAll();
  new ResizeObserver(entries => { if (entries[0].contentRect.width > 0) renderStage(); }).observe(els.stage);
  saveLocal();

  function bindWorkspaceEvents() {
    ui.rosterImport.open = !state.people.length;
    document.querySelectorAll("[data-color-target]").forEach(button => button.addEventListener("click", () => { colorTarget = button.dataset.colorTarget; renderPalette(); }));
    document.querySelectorAll("[data-color]").forEach(button => button.addEventListener("click", () => applyPaletteColor(button.dataset.color)));
    let colorEditStarted = false;
    ui.customColor.addEventListener("input", () => {
      if (!colorEditStarted && getSelectedIds().length) commitHistory();
      colorEditStarted = true; applyPaletteColor(ui.customColor.value, false);
    });
    ui.customColor.addEventListener("change", () => { colorEditStarted = false; });
    ui.snapTablesToggle.addEventListener("change", () => { state.settings.snapTables = ui.snapTablesToggle.checked; scheduleSave(); });
    els.peopleList.addEventListener("pointerdown", onPeoplePointerDown);
    document.addEventListener("pointermove", onPeoplePointerMove);
    document.addEventListener("pointerup", event => finishPeoplePointer(event, false));
    document.addEventListener("pointercancel", event => finishPeoplePointer(event, true));
    document.querySelectorAll("[data-history]").forEach(button => button.addEventListener("click", button.dataset.history === "undo" ? undo : redo));
    document.querySelector("#renameRoomBtn").addEventListener("click", async () => {
      if (!await openDialog("为会场起个名字", "一个清晰的名称，让布局更容易查找和分享。", { input: state.title, confirm: "保存名称" })) return;
      // Another dialog may have taken over the shared content area before this one resolved.
      const title = (ui.dialogContent.querySelector("input")?.value || "").trim().slice(0, 80);
      if (!title || title === state.title) return;
      commitHistory(); state.title = title; renderAll(); scheduleSave();
    });
    document.querySelectorAll("[data-template]").forEach(button => button.addEventListener("click", () => applyTemplate(button.dataset.template)));
    document.querySelectorAll("[data-panel]").forEach(button => button.addEventListener("click", () => switchPanel(button.dataset.panel)));
    document.querySelectorAll("[data-mobile-panel]").forEach(button => button.addEventListener("click", () => showMobilePanel(button.dataset.mobilePanel)));
    ui.blankStartBtn.addEventListener("click", () => { dismissedEmpty = true; setTool("table"); els.stage.focus(); });
    ui.rosterFilter.addEventListener("change", renderPeople);
    ui.editPropertiesBtn.addEventListener("click", () => { switchPanel("inspector"); showMobilePanel("right"); });
    ui.focusBtn.addEventListener("click", () => {
      const focused = document.querySelector(".app-shell").classList.toggle("is-focused");
      ui.focusBtn.setAttribute("aria-pressed", String(focused));
      ui.focusBtn.querySelector("span").textContent = focused ? "退出专注" : "专注模式";
    });
    ui.helpBtn.addEventListener("click", showHelp);
    ui.toastClose.addEventListener("click", () => { ui.toast.hidden = true; });
    ui.toastUndo.addEventListener("click", () => { undo(); ui.toast.hidden = true; });
    document.addEventListener("click", event => {
      const menu = document.querySelector(".file-menu");
      if (!menu.contains(event.target) || event.target.closest(".menu-popover button")) menu.open = false;
    });
    document.addEventListener("keyup", event => { if (event.code === "Space") releasePan(); });
    window.addEventListener("blur", releasePan);
    window.addEventListener("pagehide", saveLocal);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveLocal(); });
    els.stage.addEventListener("dblclick", event => {
      const node = event.target.closest("[data-id]");
      if (!node || currentTool !== "select") return;
      setSelection([node.dataset.id]); renderAll(); switchPanel("inspector"); showMobilePanel("right");
      els.inspector.querySelector("input,textarea,select")?.focus();
    });
    els.stage.addEventListener("dragleave", event => {
      if (!els.stage.contains(event.relatedTarget)) els.stage.querySelectorAll(".is-drop-target").forEach(node => node.classList.remove("is-drop-target"));
    });
    document.addEventListener("dragend", () => els.stage.querySelectorAll(".is-drop-target").forEach(node => node.classList.remove("is-drop-target")));
    els.toolGrid.addEventListener("click", event => { if (event.target.closest("[data-tool]")) { showMobilePanel("canvas"); els.stage.focus(); } });
    setTool("select");
  }

  function releasePan() {
    if (spaceTool === null) return;
    const previous = spaceTool;
    spaceTool = null;
    setTool(previous);
  }

  function onPeoplePointerDown(event) {
    if (event.button !== 0 || event.target.closest("button")) return;
    const card = event.target.closest("[data-person-id]");
    if (!card) return;
    const field = event.target.closest("[data-assign-field]")?.dataset.assignField || "name";
    rosterDrag = { personId: card.dataset.personId, field, x: event.clientX, y: event.clientY, pointerId: event.pointerId, ghost: null };
  }

  function onPeoplePointerMove(event) {
    if (!rosterDrag || event.pointerId !== rosterDrag.pointerId) return;
    if (!rosterDrag.ghost) {
      if (Math.hypot(event.clientX - rosterDrag.x, event.clientY - rosterDrag.y) < 6) return;
      // Leave vertical touch gestures available for scrolling the roster.
      if (event.pointerType === "touch" && Math.abs(event.clientY - rosterDrag.y) > Math.abs(event.clientX - rosterDrag.x)) return;
      rosterDrag.ghost = document.createElement("div");
      rosterDrag.ghost.className = "person-drag-ghost";
      const dragged = getPerson(rosterDrag.personId);
      rosterDrag.ghost.textContent = (rosterDrag.field === "unit" && dragged?.unit) || dragged?.name || "";
      document.body.append(rosterDrag.ghost);
      els.peopleList.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    rosterDrag.ghost.style.left = `${event.clientX + 14}px`;
    rosterDrag.ghost.style.top = `${event.clientY + 14}px`;
    els.stage.querySelectorAll(".is-drop-target").forEach(node => node.classList.remove("is-drop-target"));
    document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-seat-id]")?.classList.add("is-drop-target");
  }

  function finishPeoplePointer(event, cancelled) {
    if (!rosterDrag || event.pointerId !== rosterDrag.pointerId) return;
    const drag = rosterDrag;
    rosterDrag = null;
    if (els.peopleList.hasPointerCapture(event.pointerId)) els.peopleList.releasePointerCapture(event.pointerId);
    drag.ghost?.remove();
    els.stage.querySelectorAll(".is-drop-target").forEach(node => node.classList.remove("is-drop-target"));
    if (!drag.ghost) return;
    suppressRosterClickUntil = Date.now() + 350;
    if (cancelled) return;
    const seatNode = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-seat-id]");
    const person = getPerson(drag.personId);
    if (!seatNode || !person) { showToast("请将姓名拖到一个座位上"); return; }
    if (person.assignedSeatId === seatNode.dataset.seatId) return;
    commitHistory();
    assignPersonToSeat(person.id, seatNode.dataset.seatId, drag.field);
    setSelection([seatNode.dataset.seatId]);
    renderAll(); scheduleSave();
    showToast(`已将 ${seatPersonText(getItem(seatNode.dataset.seatId))} 安排到 ${seatLabel(seatNode.dataset.seatId)}`, true);
  }

  function switchPanel(panel) {
    ui.rosterPanel.hidden = panel !== "roster";
    ui.inspectorPanel.hidden = panel !== "inspector";
    document.querySelectorAll("[data-panel]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.panel === panel);
      button.setAttribute("aria-selected", String(button.dataset.panel === panel));
    });
  }

  function showMobilePanel(panel) {
    document.querySelector(".app-shell").dataset.mobile = panel;
    document.querySelectorAll("[data-mobile-panel]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.mobilePanel === panel);
      button.setAttribute("aria-current", button.dataset.mobilePanel === panel ? "page" : "false");
    });
    if (panel === "canvas") renderStage();
  }

  function showToast(message, reversible = false) {
    clearTimeout(toastTimer);
    ui.toastMessage.textContent = message;
    ui.toastUndo.hidden = !reversible || !history.length;
    ui.toast.hidden = false;
    toastTimer = window.setTimeout(() => { ui.toast.hidden = true; }, reversible ? 6500 : 4500);
  }

  function openDialog(title, message, options = {}) {
    if (ui.appDialog.open) return Promise.resolve(false);
    ui.dialogTitle.textContent = title;
    ui.dialogMessage.textContent = message;
    ui.dialogContent.replaceChildren();
    ui.dialogCancel.hidden = !!options.info;
    ui.dialogConfirm.textContent = options.confirm || "确定";
    if (options.input !== undefined) {
      const input = document.createElement("input");
      input.className = "dialog-text-input"; input.value = options.input; input.maxLength = 200;
      input.setAttribute("aria-label", "文字内容");
      input.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); ui.dialogConfirm.click(); } });
      ui.dialogContent.append(input);
    }
    if (options.fields) options.fields.forEach(field => {
      const row = document.createElement("label");
      row.className = "dialog-field";
      const caption = document.createElement("span");
      caption.textContent = field.label;
      const input = document.createElement("input");
      input.className = "dialog-text-input";
      input.value = field.value || "";
      input.maxLength = 200;
      input.dataset.field = field.key;
      input.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); ui.dialogConfirm.click(); } });
      row.append(caption, input);
      ui.dialogContent.append(row);
    });
    if (options.shortcuts) options.shortcuts.forEach(([label, shortcut]) => {
      const row = document.createElement("div"); row.className = "shortcut-row";
      const text = document.createElement("span"); text.textContent = label;
      const key = document.createElement("kbd"); key.textContent = shortcut;
      row.append(text, key); ui.dialogContent.append(row);
    });
    const previousFocus = document.activeElement;
    ui.appDialog.returnValue = "cancel";
    return new Promise(resolve => {
      let settled = false;
      // Resolve from the buttons as well as from "close": some engines never deliver the close
      // event when a dialog form submits, which would leave every caller waiting forever.
      const finish = confirmed => {
        if (settled) return;
        settled = true;
        ui.appDialog.removeEventListener("click", onDialogClick);
        ui.appDialog.removeEventListener("cancel", onCancel);
        ui.appDialog.removeEventListener("close", onClose);
        if (ui.appDialog.open) ui.appDialog.close(confirmed ? "confirm" : "cancel");
        previousFocus?.focus({ preventScroll: true });
        resolve(confirmed);
      };
      const onDialogClick = event => {
        const button = event.target.closest("button[value]");
        if (button) finish(button.value === "confirm");
      };
      const onCancel = () => finish(false);
      const onClose = () => finish(ui.appDialog.returnValue === "confirm");
      ui.appDialog.addEventListener("click", onDialogClick);
      ui.appDialog.addEventListener("cancel", onCancel);
      ui.appDialog.addEventListener("close", onClose);
      ui.appDialog.showModal();
      const input = ui.dialogContent.querySelector("input");
      if (input) { input.focus(); input.select(); }
      else (options.info ? ui.dialogConfirm : ui.dialogCancel).focus();
    });
  }

  function showHelp() {
    openDialog("更顺手地安排每一席", "先选模板或绘制桌椅，再添加名单；拖动姓名到座位，或一键自动排座。双击对象可以编辑属性。", {
      info: true, confirm: "开始排座", shortcuts: [
        ["选择 / 平移", "V / H"], ["椅子 / 椅子排", "C / S"], ["矩形 / 文字", "R / T"],
        ["临时平移 / 适配画布", "按住空格 / F"], ["追加多选", "Shift + 点击"],
        ["朝向上 / 右 / 下 / 左", "↑ 0° / → 90° / ↓ 180° / ← 270°"], ["复制 / 撤销 / 保存", "Ctrl + D / Z / S"],
        ["搜索名单 / 关闭操作", "/ / Esc"]
      ]
    });
  }

  async function applyTemplate(kind) {
    const titles = { boardroom: "围桌会议", classroom: "课堂培训", banquet: "圆桌交流" };
    if (!titles[kind]) return;
    if ((state.items.length || state.draftImage) && !await openDialog(`使用${titles[kind]}模板？`, "当前布局会替换为新模板，名单会保留，人员需要重新排座。你可以随时撤销。", { confirm: "应用模板" })) return;
    const items = [];
    let seatNumber = 0;
    const seat = (x, y, rotation = 0, w = 120, h = 80) => {
      items.push(createSeat(x, y, `S${String(++seatNumber).padStart(2, "0")}`, rotation, w, h));
    };
    const heading = createLabel(690, 125, titles[kind], 26);
    items.push(heading);
    if (kind === "boardroom") {
      items.push(createTable(400, 335, 800, 300, "会议桌", "#ebce92"));
      for (let i = 0; i < 6; i++) { seat(409 + i * 132, 245, 180); seat(409 + i * 132, 650); }
      for (let i = 0; i < 2; i++) { seat(275, 370 + i * 140, 90); seat(1205, 370 + i * 140, -90); }
      items.push(createLabel(729, 826, "主入口", 17));
    } else if (kind === "classroom") {
      items.push(createTable(600, 225, 400, 60, "讲台", "#e8d3a9"));
      for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
        const x = 355 + col * 315, y = 310 + row * 145;
        items.push(createTable(x, y, 255, 50, "", "#f0dcb4"));
        seat(x + 8, y + 60, 0, 112, 72); seat(x + 135, y + 60, 0, 112, 72);
      }
    } else {
      for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
        const cx = 540 + col * 510, cy = 310 + row * 460;
        const table = createShape(cx - 90, cy - 90, 180, 180, "circle");
        table.fill = "#eed5a3"; table.stroke = "#b18c55"; table.isTable = true; table.label = `${row * 2 + col + 1} 号桌`; items.push(table);
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          seat(cx + Math.cos(angle) * 158 - 52, cy + Math.sin(angle) * 158 - 36, angle * 180 / Math.PI - 90, 104, 72);
        }
      }
    }
    commitHistory();
    state.items = items; state.draftImage = null;
    getSeats().forEach(seat => orientSeatTowardNearestTable(seat));
    state.people.forEach(person => { person.assignedSeatId = null; });
    if (state.title === "未命名会议室" || Object.values(titles).includes(state.title)) state.title = titles[kind];
    clearSelection(); dismissedEmpty = false; setTool("select");
    state.view = { x: 110, y: 65, w: 1380, h: 862.5 };
    renderAll(); scheduleSave(); showMobilePanel("canvas");
    showToast(`已创建${titles[kind]}，共 ${seatNumber} 个座位`, true);
  }

  function measureText(text, size, family) {
    textMeasureContext.font = `600 ${size}px ${fontStack(family)}`;
    return textMeasureContext.measureText(text).width;
  }

  // Declared, not assigned, so the first render can measure before this line is reached.
  function measurerFor(item) {
    return (text, size) => measureText(text, size, item.fontFamily);
  }

  // Grow a text box so its own font size fits: wide enough to keep every word whole, tall enough for the lines.
  function ensureLabelTextRoom(item) {
    const size = Math.max(6, item.size || 28);
    const measure = measurerFor(item);
    const text = item.text || "标注";
    // Wide enough to keep a short label on one line, and never so narrow that a word has to break.
    const longest = Math.max(...String(text).split("\n").map(line => measure(line, size)));
    item.w = Math.max(item.w, Math.min(1200, longest + 16), SeatMateCore.widestWord(text, size, measure) + 16);
    item.h = Math.max(item.h, SeatMateCore.fitText(text, item.w - 16, 1e6, size, measure).height + 12);
  }

  function seatTextLayout(item, name, empty = false) {
    return SeatMateCore.fitRotatedText(name, Math.max(12,item.w-20), Math.max(12,item.h-28), item.rotation || 0, empty ? 17 : item.nameSize || 24, measureText);
  }

  function ensureSeatTextRoom(seat, name) {
    const center = itemCenter(seat);
    // Refit from the chair's own size, so rotating it again never compounds the extra room.
    if (seat.baseW === undefined) { seat.baseW = seat.w; seat.baseH = seat.h; }
    seat.w = seat.baseW; seat.h = seat.baseH;
    // Keep ordinary two-to-four-character names on one line, including side seats.
    if (Array.from(name).length <= 4) {
      const width = measureText(name, seat.nameSize || 24), height = (seat.nameSize || 24)*1.3;
      const c=Math.abs(Math.cos((seat.rotation || 0)*Math.PI/180)), s=Math.abs(Math.sin((seat.rotation || 0)*Math.PI/180));
      seat.w=Math.max(seat.w,c*width+s*height+20);
      seat.h=Math.max(seat.h,s*width+c*height+28);
    }
    const minimumSize = Math.min(20, seat.nameSize || 24);
    for (let i = 0; i < 40; i++) {
      // Grow until the name is readable and wide enough that no word breaks across lines.
      const layout = seatTextLayout(seat, name);
      if (layout.size >= minimumSize && SeatMateCore.widestWord(name, layout.size, measureText) <= layout.width) break;
      seat.w += 6; seat.h += 5;
    }
    seat.x = center.x - seat.w / 2; seat.y = center.y - seat.h / 2;
    if (seat.tableId) {
      const table = getItem(seat.tableId);
      if (table) Object.assign(seat, SeatMateCore.seatAtDock(seat, table, { side:seat.dockSide, offset:seat.dockOffset, angle:seat.dockAngle }));
    }
  }

  // A seat shows whichever roster column was used to fill it: the person, or the unit they came from.
  function seatPersonText(seat, person) {
    const occupant = person || (seat && seat.personId ? getPerson(seat.personId) : null);
    if (!occupant) return "";
    return seat.showUnit && occupant.unit ? occupant.unit : occupant.name;
  }

  // A rotated chair turns its narrow side to the reader, so give its name room again.
  function refitSeatText(item) {
    const seat = typeof item === "string" ? getItem(item) : item;
    if (!seat || seat.type !== "seat" || !seat.personId) return;
    const person = getPerson(seat.personId);
    if (person) ensureSeatTextRoom(seat, seatPersonText(seat, person));
  }

  function getTables() {
    return state.items.filter(item => item.type === "table" || item.isTable);
  }

  function updateDockedSeats(tableId) {
    const table = getItem(tableId);
    if (!table || (table.type !== "table" && !table.isTable)) return;
    getSeats().filter(seat => seat.tableId === tableId).forEach(seat => {
      Object.assign(seat, SeatMateCore.seatAtDock(seat, table, { side:seat.dockSide, offset:seat.dockOffset, angle:seat.dockAngle }));
      refitSeatText(seat);
    });
  }

  function movableItems(ids) {
    const moving = new Set(ids);
    getSeats().forEach(seat => { if (seat.tableId && moving.has(seat.tableId)) moving.add(seat.id); });
    return state.items.filter(item => moving.has(item.id));
  }

  function rotateSelectionTo(angle) {
    const selected = getSelectedItems();
    if (!selected.length || selected.every(item => normalizeAngle(item.rotation || 0) === angle)) return;
    commitHistory();
    const ids = new Set(selected.map(item => item.id));
    selected.forEach(item => { item.rotation = angle; if (item.type === "seat" && !ids.has(item.tableId)) delete item.tableId; });
    selected.forEach(item => { updateDockedSeats(item.id); refitSeatText(item); });
    renderAll(); scheduleSave();
  }

  function paletteProperty(item) {
    if (item.type === "label") return "color";
    if (colorTarget === "text") return item.type === "seat" ? "nameColor" : "textColor";
    return "fill";
  }

  function applyPaletteColor(color, record = true) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    const items = getSelectedItems();
    if (items.length && record) commitHistory();
    items.forEach(item => { item[paletteProperty(item)] = color; });
    state.settings[colorTarget === "text" || items[0]?.type === "label" ? "drawText" : "drawFill"] = color;
    renderAll(); scheduleSave();
  }

  function renderPalette() {
    const items = getSelectedItems();
    const item = items[0];
    const color = item?.[paletteProperty(item)] || state.settings[colorTarget === "text" || item?.type === "label" ? "drawText" : "drawFill"] || "#edbe4c";
    ui.paletteHint.textContent = items.length ? `修改 ${items.length} 个选中对象` : "用于新绘制的对象";
    document.querySelectorAll("[data-color-target]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.colorTarget === colorTarget);
      button.setAttribute("aria-pressed", String(button.dataset.colorTarget === colorTarget));
    });
    document.querySelectorAll("[data-color]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.color.toLowerCase() === color.toLowerCase());
      button.setAttribute("aria-pressed", String(button.dataset.color.toLowerCase() === color.toLowerCase()));
    });
    if (/^#[0-9a-f]{6}$/i.test(color)) ui.customColor.value = color;
    ui.colorValue.textContent = color.toUpperCase();
  }

  function createInitialState() {
    const initial = createEmptyState();
    return initial;
  }

  function createEmptyState() {
    return {
      version: 1,
      title: "未命名会议室",
      items: [],
      people: [],
      selectedId: null,
      selectedIds: [],
      draftImage: null,
      view: { x: 0, y: 0, w: WORKSPACE.width, h: WORKSPACE.height },
      settings: { snap: true, showReference: false, snapTables: true, drawFill: "#edbe4c", drawText: "#4e3721", drawFont: "sans" }
    };
  }

  function bindEvents() {
    els.toolGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tool]");
      if (!button) return;
      setTool(button.dataset.tool);
    });

    els.stage.addEventListener("pointerdown", onPointerDown);
    els.stage.addEventListener("pointermove", onPointerMove);
    els.stage.addEventListener("pointerup", onPointerUp);
    els.stage.addEventListener("pointercancel", onPointerUp);
    els.stage.addEventListener("wheel", onWheel, { passive: false });
    els.stage.addEventListener("dragover", onStageDragOver);
    els.stage.addEventListener("drop", onStageDrop);

    els.undoBtn.addEventListener("click", undo);
    els.redoBtn.addEventListener("click", redo);
    els.saveBtn.addEventListener("click", () => {
      if (saveLocal()) showToast("布局已保存到此浏览器");
    });

    els.exportPngBtn.addEventListener("click", exportPng);
    els.exportJsonBtn.addEventListener("click", exportJson);
    els.importJsonBtn.addEventListener("click", () => els.projectFile.click());
    els.clearLayoutBtn.addEventListener("click", clearLayout);
    els.projectFile.addEventListener("change", importProjectFile);
    els.roomNameInput.addEventListener("input", () => {
      state.title = els.roomNameInput.value.trim() || "未命名会议室";
      renderStatus();
      scheduleSave();
    });

    els.draftImportBtn.addEventListener("click", () => els.draftFile.click());
    els.draftFile.addEventListener("change", importDraftFile);
    els.draftAutoBtn.addEventListener("click", autoLayoutFromDraft);
    els.draftClearBtn.addEventListener("click", clearDraftImage);

    els.zoomOutBtn.addEventListener("click", () => zoomAtCenter(1.22));
    els.fitBtn.addEventListener("click", fitView);
    els.zoomInBtn.addEventListener("click", () => zoomAtCenter(0.82));

    els.snapToggle.addEventListener("change", () => {
      state.settings.snap = els.snapToggle.checked;
      scheduleSave();
    });
    els.referenceToggle.addEventListener("change", () => {
      state.settings.showReference = els.referenceToggle.checked;
      renderReference();
      scheduleSave();
    });
    els.referencePreviewBtn.addEventListener("click", openDraftViewer);
    els.draftViewerClose.addEventListener("click", closeDraftViewer);
    els.draftViewerZoomOut.addEventListener("click", () => zoomDraftViewer(0.82));
    els.draftViewerZoomIn.addEventListener("click", () => zoomDraftViewer(1.22));
    els.draftViewerReset.addEventListener("click", resetDraftViewer);
    els.draftViewerStage.addEventListener("pointerdown", onDraftViewerPointerDown);
    els.draftViewerStage.addEventListener("pointermove", onDraftViewerPointerMove);
    els.draftViewerStage.addEventListener("pointerup", onDraftViewerPointerUp);
    els.draftViewerStage.addEventListener("pointercancel", onDraftViewerPointerUp);
    els.draftViewerStage.addEventListener("wheel", onDraftViewerWheel, { passive: false });

    els.selectAllBtn.addEventListener("click", selectAllItems);
    els.rotateLeftBtn.addEventListener("click", () => rotateSelectionBy(-90));
    els.rotateRightBtn.addEventListener("click", () => rotateSelectionBy(90));
    els.groupBtn.addEventListener("click", groupSelected);
    els.ungroupBtn.addEventListener("click", ungroupSelected);
    els.duplicateBtn.addEventListener("click", duplicateSelected);
    els.deleteBtn.addEventListener("click", deleteSelected);

    els.loadPeopleBtn.addEventListener("click", loadPeopleFromTextarea);
    els.peopleFileBtn.addEventListener("click", () => els.peopleFile.click());
    els.peopleFile.addEventListener("change", importPeopleFile);
    els.personSearch.addEventListener("input", renderPeople);
    els.autoAssignBtn.addEventListener("click", autoAssign);
    els.clearAssignBtn.addEventListener("click", clearAssignments);
    els.clearPeopleBtn.addEventListener("click", clearPeople);
    els.peopleList.addEventListener("dragstart", onPersonDragStart);
    els.peopleList.addEventListener("click", onPeopleListClick);

    document.addEventListener("keydown", onKeyDown);
  }

  function setTool(tool) {
    currentTool = tool;
    draft = null;
    action = null;
    els.stage.dataset.tool = tool;
    if (tool !== "select") dismissedEmpty = true;
    els.toolGrid.querySelectorAll(".tool-btn").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tool === tool);
      button.setAttribute("aria-pressed", String(button.dataset.tool === tool));
    });
    const hints = { select: "拖出选框批量选择 · 方向键旋转 · 空格平移", pan: "拖动画布平移 · 滚轮缩放", table: "拖动绘制桌面 · Esc 返回选择", seat: "点击画布添加座位 · Esc 返回选择", "seat-row": "拖出一排等距椅子 · Esc 返回选择", label: "点击画布添加文字 · Esc 返回选择" };
    ui.toolHint.textContent = hints[tool] || "拖动绘制图形 · Shift 约束比例 · 完成后自动选择";
    renderDraft();
    renderStatus();
  }

  async function onPointerDown(event) {
    if (event.button !== 0 && event.button !== 1) return;
    els.stage.focus({ preventScroll: true });
    const point = svgPoint(event);
    if (currentTool === "pan" || event.button === 1) {
      event.preventDefault();
      action = { type: "pan", startClient: { x: event.clientX, y: event.clientY }, view: { ...state.view }, pointerId: event.pointerId };
      els.stage.setPointerCapture(event.pointerId);
      return;
    }
    const resizeHandle = event.target.closest("[data-resize]");
    const rotateHandle = event.target.closest("[data-rotate]");
    const itemNode = event.target.closest("[data-id]");

    if (resizeHandle) {
      const item = getItem(resizeHandle.dataset.id);
      if (!item) return;
      setSelection([item.id]);
      action = {
        type: "resize",
        id: item.id,
        handle: resizeHandle.dataset.resize,
        start: point,
        origin: cloneItem(item),
        pointerId: event.pointerId
      };
      els.stage.setPointerCapture(event.pointerId);
      renderAll();
      return;
    }

    if (rotateHandle) {
      const item = getItem(rotateHandle.dataset.id);
      if (!item) return;
      if (!isSelected(item.id)) setSelection(idsForItemSelection(item));
      const ids = getSelectedIds();
      const center = selectionCenter(ids);
      action = {
        type: "rotate",
        ids,
        center,
        startAngle: angleFromCenter(center, point),
        origins: movableItems(ids).map(cloneItem),
        pointerId: event.pointerId
      };
      els.stage.setPointerCapture(event.pointerId);
      renderAll();
      return;
    }

    if (currentTool === "pan" || event.button === 1) {
      action = {
        type: "pan",
        startClient: { x: event.clientX, y: event.clientY },
        view: { ...state.view },
        pointerId: event.pointerId
      };
      els.stage.setPointerCapture(event.pointerId);
      return;
    }

    if (itemNode && currentTool === "select") {
      const item = getItem(itemNode.dataset.id);
      if (!item) return;
      if (event.shiftKey) {
        toggleSelectionGroup(item);
        renderAll();
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        if (!isSelected(item.id)) setSelection(idsForItemSelection(item));
        action = {
          type: "copyMaybe",
          start: point,
          ids: getSelectedIds(),
          origins: movableItems(getSelectedIds()).map(cloneItem),
          pointerId: event.pointerId
        };
        els.stage.setPointerCapture(event.pointerId);
        renderAll();
        return;
      }
      if (!isSelected(item.id)) setSelection(idsForItemSelection(item));
      const ids = getSelectedIds();
      action = {
        type: "drag",
        ids,
        start: point,
        origins: movableItems(ids).map(cloneItem),
        pointerId: event.pointerId
      };
      els.stage.setPointerCapture(event.pointerId);
      renderAll();
      return;
    }

    if (itemNode && isSelected(itemNode.dataset.id) && !["table", "seat", "label"].includes(currentTool) && !currentTool.startsWith("shape-")) {
      const ids = getSelectedIds();
      action = {
        type: "drag",
        ids,
        start: point,
        origins: movableItems(ids).map(cloneItem),
        pointerId: event.pointerId
      };
      els.stage.setPointerCapture(event.pointerId);
      renderAll();
      return;
    }

    if (itemNode && currentTool !== "select") {
      const item = getItem(itemNode.dataset.id);
      setSelection(item ? idsForItemSelection(item) : [itemNode.dataset.id]);
      renderAll();
      return;
    }

    if (currentTool === "table" || currentTool.startsWith("shape-")) {
      const kind = currentTool === "table" ? "table" : currentTool.replace("shape-", "");
      draft = { type: "draw", kind, x: point.x, y: point.y, w: 0, h: 0 };
      action = {
        type: "draw",
        kind,
        start: point,
        pointerId: event.pointerId
      };
      els.stage.setPointerCapture(event.pointerId);
      renderDraft();
      return;
    }
    if (currentTool === "seat-row") {
      draft = { type: "seatRow", start: point, end: point };
      action = { type: "seatRow", start: point, pointerId: event.pointerId };
      els.stage.setPointerCapture(event.pointerId);
      renderDraft();
      return;
    }


    if (currentTool === "seat") {
      commitHistory();
      const seat = createSeat(point.x - 60, point.y - 40, nextSeatLabel(), 0);
      seat.fill = state.settings.drawFill;
      orientSeatTowardNearestTable(seat);
      state.items.push(seat);
      setSelection([seat.id]);
      setTool("select");
      renderAll();
      scheduleSave();
      return;
    }

    if (currentTool === "label") {
      const accepted = await openDialog("添加文字", "为会场添加讲台、入口或区域说明。", { input: "标注", confirm: "添加文字" });
      if (!accepted) return;
      const text = (ui.dialogContent.querySelector("input")?.value || "").trim();
      if (!text) return;
      commitHistory();
      const label = createLabel(point.x, point.y, text);
      state.items.push(label);
      setSelection([label.id]);
      setTool("select");
      renderAll();
      scheduleSave();
      return;
    }

    if (currentTool === "select") {
      draft = { type: "marquee", x: point.x, y: point.y, w: 0, h: 0 };
      action = {
        type: "marquee",
        start: point,
        append: event.ctrlKey || event.metaKey,
        pointerId: event.pointerId
      };
      els.stage.setPointerCapture(event.pointerId);
      renderDraft();
      return;
    }

    clearSelection();
    renderAll();
  }

  function onPointerMove(event) {
    if (!action) return;

    if (action.type === "pan") {
      const matrix = els.stage.getScreenCTM().inverse();
      const dx = (event.clientX - action.startClient.x) * matrix.a;
      const dy = (event.clientY - action.startClient.y) * matrix.d;
      state.view.x = action.view.x - dx;
      state.view.y = action.view.y - dy;
      setViewBox();
      return;
    }

    const point = svgPoint(event);

    if (action.type === "draw") {
      const rect = drawRectFromPoints(action.start, point, event.shiftKey, action.kind);
      draft = { type: "draw", kind: action.kind, ...rect };
      renderDraft();
      return;
    }

    if (["drag", "resize", "rotate"].includes(action.type) && !action.historyCommitted) {
      if (action.start && Math.hypot(point.x - action.start.x, point.y - action.start.y) < 1) return;
      commitHistory();
      action.historyCommitted = true;
    }
    if (action.type === "drag") {
      const dx = point.x - action.start.x;
      const dy = point.y - action.start.y;
      action.origins.forEach((origin) => {
        const item = getItem(origin.id);
        if (!item) return;
        item.x = origin.x + dx;
        item.y = origin.y + dy;
        if (state.settings.snap) {
          item.x = snap(item.x);
          item.y = snap(item.y);
        }
      });
      action.origins.forEach(origin => updateDockedSeats(origin.id));
      const movingIds = new Set(action.origins.map(item => item.id));
      action.origins.forEach(origin => {
        const item = getItem(origin.id);
        if (item?.type !== "seat" || (item.tableId && movingIds.has(item.tableId))) return;
        if (event.altKey) delete item.tableId;
        else orientSeatTowardNearestTable(item);
      });
      renderStage();
      renderStatus();
      return;
    }

    if (action.type === "copyMaybe") {
      const dx = point.x - action.start.x;
      const dy = point.y - action.start.y;
      if (Math.hypot(dx, dy) < 8) return;
      commitHistory();
      const copies = cloneSelectedItemsForDrag(action.origins);
      if (!copies.length) return;
      state.items.push(...copies);
      setSelection(copies.map((copy) => copy.id));
      action = {
        ...action,
        type: "drag",
        historyCommitted: true,
        ids: copies.map((copy) => copy.id),
        origins: copies.map(cloneItem)
      };
      action.origins.forEach((origin) => {
        const item = getItem(origin.id);
        if (!item) return;
        item.x = origin.x + dx;
        item.y = origin.y + dy;
        if (state.settings.snap) {
          item.x = snap(item.x);
          item.y = snap(item.y);
        }
      });
      renderStage();
      renderStatus();
      return;
    }

    if (action.type === "rotate") {
      const delta = angleFromCenter(action.center, point) - action.startAngle;
      rotateItems(action, delta);
      action.ids.forEach(id => { const item = getItem(id); if (item?.type === "seat" && !action.ids.includes(item.tableId)) delete item.tableId; });
      action.ids.forEach(updateDockedSeats);
      renderStage();
      renderStatus();
      return;
    }

    if (action.type === "marquee") {
      const rect = normalizedRect(action.start.x, action.start.y, point.x - action.start.x, point.y - action.start.y);
      draft = { type: "marquee", ...rect };
      renderDraft();
      return;
    }

    if (action.type === "seatRow") {
      draft = { type: "seatRow", start: action.start, end: point };
      renderDraft();
      ui.toolHint.textContent = `松开放置 ${seatRowPlan(draft.start, draft.end).count} 把椅子`;
      return;
    }

    if (action.type === "resize") {
      const item = getItem(action.id);
      if (!item) return;
      resizeItem(item, action, point);
      renderStage();
      renderStatus();
    }
  }

  function onPointerUp(event) {
    if (!action) return;

    if (action.type === "draw" && draft) {
      const minSize = 22;
      commitHistory();
      let item;
      if (Math.abs(draft.w) < minSize || Math.abs(draft.h) < minSize) {
        item = draft.kind === "table"
          ? createTable(draft.x - 110, draft.y - 45, 220, 90)
          : createShape(draft.x - 60, draft.y - 40, 120, 80, draft.kind);
      } else {
        item = draft.kind === "table"
          ? createTable(draft.x, draft.y, draft.w, draft.h)
          : createShape(draft.x, draft.y, draft.w, draft.h, draft.kind);
      }
      state.items.push(item);
      setSelection([item.id]);
      draft = null;
      renderAll();
      scheduleSave();
    } else if (action.type === "seatRow" && draft) {
      commitHistory();
      const seats = createSeatRow(draft.start, draft.end);
      setSelection(seats.map(seat => seat.id));
      draft = null;
      renderAll();
      scheduleSave();
      showToast(`已添加 ${seats.length} 把椅子`, true);
    } else if (action.type === "marquee" && draft) {
      const rect = { ...draft };
      if (rect.w < 6 && rect.h < 6) {
        if (!action.append) clearSelection();
      } else {
        selectItemsInRect(rect, action.append);
      }
      draft = null;
      renderAll();
      scheduleSave();
    } else if (action.type === "copyMaybe") {
      action.origins.forEach((origin) => {
        const item = getItem(origin.id);
        if (item) toggleSelectionGroup(item);
      });
      renderAll();
      scheduleSave();
    } else if (action.type === "drag" || action.type === "resize" || action.type === "rotate" || action.type === "pan") {
      if (action.type === "drag" || action.type === "resize" || action.type === "rotate") normalizeState();
      renderAll();
      scheduleSave();
    }

    try {
      els.stage.releasePointerCapture(action.pointerId || event.pointerId);
    } catch (error) {
      // The pointer may already be released by the browser.
    }
    const wasDrawing = action.type === "draw" || action.type === "seatRow";
    action = null;
    if (wasDrawing) setTool("select");
  }

  function onWheel(event) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 0.9 : 1.1;
    zoomAtPoint(svgPoint(event), factor);
  }

  function resizeItem(item, activeAction, point) {
    Object.assign(item, SeatMateCore.resizeBox(activeAction.origin, activeAction.handle, { x: point.x - activeAction.start.x, y: point.y - activeAction.start.y }, state.settings.snap, item.type === "seat" ? 40 : 24));
    if (item.type === "seat") { delete item.tableId; delete item.baseW; delete item.baseH; }
    if (item.type === "label" && activeAction.handle.length === 2) {
      const scale = Math.min(item.w / activeAction.origin.w, item.h / activeAction.origin.h);
      item.size = Math.min(400, Math.max(6, Math.round((activeAction.origin.size || 28) * scale)));
    }
    updateDockedSeats(item.id);
  }

  function orientSeatTowardNearestTable(seat) {
    if (!state.settings.snapTables) { delete seat.tableId; return; }
    const dock = SeatMateCore.findSeatDock(seat, getTables());
    if (dock) { const { distance, ...position } = dock; Object.assign(seat, position); }
    else delete seat.tableId;
  }

  function nearestTableForSeat(seat) {
    const dock = SeatMateCore.findSeatDock(seat, getTables());
    return dock ? getItem(dock.tableId) : null;
  }

  function selectItemsInRect(rect, append) {
    const matches = state.items
      .filter((item) => rectsIntersect(rect, boundsForItem(item)))
      .map((item) => item.id);
    setSelection(append ? [...getSelectedIds(), ...matches] : matches);
  }

  function rotateItems(activeAction, deltaRadians) {
    const deltaDegrees = (deltaRadians * 180) / Math.PI;
    activeAction.origins.forEach((origin) => {
      const item = getItem(origin.id);
      if (!item) return;
      const center = itemCenter(origin);
      const rotated = rotatePoint(center, activeAction.center, deltaRadians);
      const size = itemSize(origin);
      item.x = rotated.x - size.w / 2;
      item.y = rotated.y - size.h / 2;
      item.rotation = normalizeAngle((origin.rotation || 0) + deltaDegrees);
      if (state.settings.snap && activeAction.ids.length > 1) {
        item.x = snap(item.x);
        item.y = snap(item.y);
      }
    });
  }

  function alignSelected(kind) {
    const items = getSelectedItems();
    if (items.length < 2) return;
    commitHistory();
    const bounds = boundsForItems(items);
    items.forEach((item) => {
      const itemBounds = boundsForItem(item);
      if (kind === "left") item.x += bounds.x - itemBounds.x;
      if (kind === "right") item.x += bounds.x + bounds.w - (itemBounds.x + itemBounds.w);
      if (kind === "center") item.x += bounds.x + bounds.w / 2 - (itemBounds.x + itemBounds.w / 2);
      if (kind === "top") item.y += bounds.y - itemBounds.y;
      if (kind === "bottom") item.y += bounds.y + bounds.h - (itemBounds.y + itemBounds.h);
      if (kind === "middle") item.y += bounds.y + bounds.h / 2 - (itemBounds.y + itemBounds.h / 2);
      if (state.settings.snap) {
        item.x = snap(item.x);
        item.y = snap(item.y);
      }
    });
    renderAll();
    scheduleSave();
  }

  function selectionCenter(ids) {
    const items = ids.map(getItem).filter(Boolean);
    const bounds = boundsForItems(items);
    return {
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2
    };
  }

  function angleFromCenter(center, point) {
    return Math.atan2(point.y - center.y, point.x - center.x);
  }

  function boundsForItems(items) {
    if (!items.length) return { x: 0, y: 0, w: 0, h: 0 };
    const bounds = items.map(boundsForItem);
    const minX = Math.min(...bounds.map((bound) => bound.x));
    const minY = Math.min(...bounds.map((bound) => bound.y));
    const maxX = Math.max(...bounds.map((bound) => bound.x + bound.w));
    const maxY = Math.max(...bounds.map((bound) => bound.y + bound.h));
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function boundsForItem(item) {
    const center = itemCenter(item), angle = (item.rotation || 0) * Math.PI / 180;
    const w = Math.abs(Math.cos(angle)) * item.w + Math.abs(Math.sin(angle)) * item.h;
    const h = Math.abs(Math.sin(angle)) * item.w + Math.abs(Math.cos(angle)) * item.h;
    return { x: center.x - w / 2, y: center.y - h / 2, w, h };
  }

  function itemCenter(item) {
    const size = itemSize(item);
    return {
      x: item.x + size.w / 2,
      y: item.y + size.h / 2
    };
  }

  function itemSize(item) {
    return { w: Math.max(1, Number(item.w) || 1), h: Math.max(1, Number(item.h) || 1) };
  }

  function rectsIntersect(a, b) {
    return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
  }

  function rotatePoint(point, center, radians) {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos
    };
  }

  function onStageDragOver(event) {
    if (!hasDragType(event.dataTransfer, "text/person-id") && !hasDragType(event.dataTransfer, "text/plain")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    els.stage.querySelectorAll(".is-drop-target").forEach(node => node.classList.remove("is-drop-target"));
    event.target.closest("[data-seat-id]")?.classList.add("is-drop-target");
  }

  function onStageDrop(event) {
    els.stage.querySelectorAll(".is-drop-target").forEach(node => node.classList.remove("is-drop-target"));
    const personId = event.dataTransfer.getData("text/person-id") || event.dataTransfer.getData("text/plain");
    const seatNode = event.target.closest("[data-seat-id]");
    if (!getPerson(personId) || !seatNode) return;
    event.preventDefault();
    commitHistory();
    assignPersonToSeat(personId, seatNode.dataset.seatId, event.dataTransfer.getData("text/person-field") || "name");
    setSelection([seatNode.dataset.seatId]);
    renderAll();
    scheduleSave();
  }

  function onPersonDragStart(event) {
    const card = event.target.closest("[data-person-id]");
    if (!card) return;
    event.dataTransfer.setData("text/person-id", card.dataset.personId);
    event.dataTransfer.setData("text/person-field", event.target.closest("[data-assign-field]")?.dataset.assignField || "name");
    event.dataTransfer.setData("text/plain", card.dataset.personId);
    event.dataTransfer.effectAllowed = "move";
  }

  function onPeopleListClick(event) {
    if (Date.now() < suppressRosterClickUntil) return;
    const removeButton = event.target.closest("[data-remove-person]");
    if (removeButton) {
      removePerson(removeButton.dataset.removePerson);
      return;
    }
    const editButton = event.target.closest("[data-edit-person]");
    if (editButton) {
      editPerson(editButton.dataset.editPerson);
      return;
    }

    const card = event.target.closest("[data-person-id]");
    if (!card) return;
    const field = event.target.closest("[data-assign-field]")?.dataset.assignField || "name";
    const selected = getSelectedItem();
    if (selected && selected.type === "seat") {
      commitHistory();
      assignPersonToSeat(card.dataset.personId, selected.id, field);
      renderAll();
      scheduleSave();
      showToast(`已将 ${seatPersonText(selected)} 安排到 ${selected.label}`, true);
    } else {
      const person = getPerson(card.dataset.personId);
      if (person.assignedSeatId) {
        setSelection([person.assignedSeatId]);
        const seat = getItem(person.assignedSeatId);
        const center = itemCenter(seat);
        state.view.x = center.x - state.view.w / 2;
        state.view.y = center.y - state.view.h / 2;
        renderAll();
        showMobilePanel("canvas");
      } else showToast("先选中一个座位，再点击姓名；也可以使用一键自动排座");
    }
  }

  function onKeyDown(event) {
    const activeTag = document.activeElement ? document.activeElement.tagName : "";
    const editing = ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag);

    if (ui.appDialog.open) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (saveLocal()) showToast("布局已保存到此浏览器");
      return;
    }
    if (editing) return;
    if (event.code === "Space") {
      event.preventDefault();
      if (spaceTool === null) { spaceTool = currentTool; setTool("pan"); }
      return;
    }
    const shortcuts = { v: "select", h: "pan", r: "shape-rect", t: "label", c: "seat", s: "seat-row" };
    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      const key = event.key.toLowerCase();
      if (shortcuts[key]) { event.preventDefault(); setTool(shortcuts[key]); return; }
      if (key === "f") { event.preventDefault(); fitView(); return; }
      if (key === "/") { event.preventDefault(); switchPanel("roster"); showMobilePanel("right"); els.personSearch.focus(); return; }
      if (key === "?") { event.preventDefault(); showHelp(); return; }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && getSelectedIds().length) {
        event.preventDefault();
        if (!event.repeat) rotateSelectionTo({ ArrowUp: 0, ArrowRight: 90, ArrowDown: 180, ArrowLeft: 270 }[event.key]);
        return;
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }

    if (!editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      selectAllItems();
      return;
    }

    if (editing) return;

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelected();
    } else if (event.key === "[") {
      event.preventDefault();
      rotateSelectionBy(-90);
    } else if (event.key === "]") {
      event.preventDefault();
      rotateSelectionBy(90);
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
      event.preventDefault();
      duplicateSelected();
    } else if (event.key === "Escape") {
      if (els.draftViewer.classList.contains("is-open")) {
        closeDraftViewer();
        return;
      }
      draft = null;
      action = null;
      clearSelection();
      setTool("select");
      renderAll();
    }
  }

  function renderAll() {
    setViewBox();
    els.roomNameInput.value = state.title || "未命名会议室";
    els.snapToggle.checked = !!state.settings.snap;
    els.referenceToggle.checked = !!state.settings.showReference;
    renderReference();
    renderStage();
    renderPeople();
    renderInspector();
    renderStatus();
    updateHistoryButtons();
  }

  function renderReference() {
    els.referenceSection.classList.toggle("is-hidden", !state.settings.showReference);
    els.referenceImage.src = state.draftImage && state.draftImage.src ? state.draftImage.src : DRAFT_PLACEHOLDER;
    els.referenceImage.alt = state.draftImage && state.draftImage.name ? `导入草稿：${state.draftImage.name}` : "未导入草稿";
  }

  function openDraftViewer() {
    const src = state.draftImage && state.draftImage.src ? state.draftImage.src : DRAFT_PLACEHOLDER;
    els.draftViewerImage.src = src;
    els.draftViewerImage.alt = state.draftImage && state.draftImage.name ? `放大查看草稿：${state.draftImage.name}` : "放大查看草稿";
    els.draftViewerTitle.textContent = state.draftImage && state.draftImage.name ? state.draftImage.name : "草稿";
    els.draftViewer.classList.add("is-open");
    els.draftViewer.setAttribute("aria-hidden", "false");
    resetDraftViewer();
  }

  function closeDraftViewer() {
    els.draftViewer.classList.remove("is-open");
    els.draftViewer.setAttribute("aria-hidden", "true");
    draftViewer.drag = null;
  }

  function resetDraftViewer() {
    draftViewer = { scale: 1, x: 0, y: 0, drag: null };
    renderDraftViewerTransform();
  }

  function zoomDraftViewer(factor) {
    draftViewer.scale = clamp(draftViewer.scale * factor, 0.25, 6);
    renderDraftViewerTransform();
  }

  function renderDraftViewerTransform() {
    els.draftViewerImage.style.transform = `translate(calc(-50% + ${draftViewer.x}px), calc(-50% + ${draftViewer.y}px)) scale(${draftViewer.scale})`;
  }

  function onDraftViewerPointerDown(event) {
    draftViewer.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: draftViewer.x,
      y: draftViewer.y
    };
    els.draftViewerStage.setPointerCapture(event.pointerId);
  }

  function onDraftViewerPointerMove(event) {
    if (!draftViewer.drag) return;
    draftViewer.x = draftViewer.drag.x + event.clientX - draftViewer.drag.startX;
    draftViewer.y = draftViewer.drag.y + event.clientY - draftViewer.drag.startY;
    renderDraftViewerTransform();
  }

  function onDraftViewerPointerUp(event) {
    if (!draftViewer.drag) return;
    try {
      els.draftViewerStage.releasePointerCapture(draftViewer.drag.pointerId || event.pointerId);
    } catch (error) {
      // Pointer capture may already be released.
    }
    draftViewer.drag = null;
  }

  function onDraftViewerWheel(event) {
    event.preventDefault();
    zoomDraftViewer(event.deltaY < 0 ? 1.08 : 0.92);
  }

  function renderStage() {
    renderImportedDraft();
    els.itemsLayer.replaceChildren();
    const orderedItems = [...state.items].sort((a, b) => typeRank(a.type) - typeRank(b.type));
    orderedItems.forEach((item) => {
      if (item.type === "table") els.itemsLayer.appendChild(renderTable(item));
      if (item.type === "shape") els.itemsLayer.appendChild(renderShape(item));
      if (item.type === "seat") els.itemsLayer.appendChild(renderSeat(item));
      if (item.type === "label") els.itemsLayer.appendChild(renderLabel(item));
    });
    renderDraft();
  }

  function renderDraft() {
    els.draftLayer.replaceChildren();
    if (!draft) return;
    if (draft.type === "marquee") {
      els.draftLayer.appendChild(svgEl("rect", {
        class: "marquee-rect",
        x: draft.x,
        y: draft.y,
        width: Math.max(0, draft.w),
        height: Math.max(0, draft.h),
        rx: 4
      }));
      return;
    }
    if (draft.type === "seatRow") {
      const plan = seatRowPlan(draft.start, draft.end);
      plan.centers.forEach(center => els.draftLayer.appendChild(svgEl("rect", {
        class: "draft-rect",
        x: center.x - 60,
        y: center.y - 40,
        width: 120,
        height: 80,
        rx: 8,
        transform: `rotate(${plan.rotation} ${center.x} ${center.y})`
      })));
      return;
    }
    if (draft.type !== "draw") return;
    if (draft.kind === "circle") {
      els.draftLayer.appendChild(svgEl("ellipse", {
        class: "draft-rect",
        cx: draft.x + draft.w / 2,
        cy: draft.y + draft.h / 2,
        rx: Math.max(0, draft.w / 2),
        ry: Math.max(0, draft.h / 2)
      }));
      return;
    }
    if (draft.kind === "triangle") {
      els.draftLayer.appendChild(svgEl("polygon", {
        class: "draft-rect",
        points: `${draft.x + draft.w / 2},${draft.y} ${draft.x + draft.w},${draft.y + draft.h} ${draft.x},${draft.y + draft.h}`
      }));
      return;
    }
    els.draftLayer.appendChild(svgEl("rect", {
      class: "draft-rect",
      x: draft.x,
      y: draft.y,
      width: Math.max(0, draft.w),
      height: Math.max(0, draft.h),
      rx: draft.kind === "roundRect" || draft.kind === "table" ? 8 : 0
    }));
  }

  function renderImportedDraft() {
    els.referenceLayer.replaceChildren();
    if (!state.settings.showReference || !state.draftImage || !state.draftImage.src) return;
    els.referenceLayer.appendChild(svgEl("image", {
      class: "imported-draft",
      href: state.draftImage.src,
      x: 0,
      y: 0,
      width: WORKSPACE.width,
      height: WORKSPACE.height,
      preserveAspectRatio: "xMidYMid meet",
      opacity: 0.26
    }));
  }

  function renderTable(item) {
    const group = svgEl("g", {
      class: "item table-item",
      "data-id": item.id,
      transform: transformFor(item)
    });
    group.appendChild(svgEl("rect", {
      class: "table-rect",
      x: 0,
      y: 0,
      width: item.w,
      height: item.h,
      rx: 8,
      fill: item.fill || "#edcf95"
    }));
    if (item.label) {
      group.appendChild(svgText(item.label, item.w / 2, item.h / 2, {
        class: "table-label", fill: item.textColor || "#6f4b20", "font-size":22
      }));
    }
    if (isSelected(item.id)) addSelectionChrome(group, item, true);
    return group;
  }

  function renderSeat(item) {
    const person = item.personId ? getPerson(item.personId) : null;
    const color = item.fill || (person ? colorForUnit(person.unit || person.name) : "#fff8e9");
    const stroke = person ? shade(color, -42) : "#b49a72";
    const group = svgEl("g", {
      class: `item seat-item${item.tableId ? " is-docked" : ""}`,
      "data-id": item.id,
      "data-seat-id": item.id,
      transform: transformFor(item)
    });
    if (person) {
      group.appendChild(svgTitle(seatPersonText(item, person)));
    }

    group.appendChild(svgEl("rect", {
      class: "seat-shell",
      x: 3,
      y: 11,
      width: item.w - 6,
      height: item.h - 14,
      rx: 8,
      fill: color,
      stroke
    }));
    group.appendChild(svgEl("rect", {
      class: "seat-back",
      x: 8,
      y: item.h - 16,
      width: item.w - 16,
      height: 13,
      rx: 6,
      fill: person ? shade(color, -18) : "#ead8b7"
    }));
    group.appendChild(svgEl("path", {
      class: "seat-front",
      d: `M ${item.w / 2 - 8} 7 L ${item.w / 2} 2 L ${item.w / 2 + 8} 7`,
      fill: "none",
      stroke: person ? shade(color, -55) : "#b49a72",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    }));

    if (person) {
      renderSeatText(group, seatPersonText(item, person), item);
    } else {
      renderSeatText(group, item.label || "空位", item, true);
    }

    if (isSelected(item.id)) addSelectionChrome(group, item, true);
    return group;
  }

  function renderSeatText(group, name, item, empty = false) {
    const textGroup = svgEl("g", { transform:`rotate(${-(item.rotation || 0)} ${item.w / 2} ${item.h / 2})` });
    const layout = seatTextLayout(item, name, empty);
    const start = item.h / 2 - layout.height / 2 + layout.lineHeight / 2;
    layout.lines.forEach((line,index) => textGroup.appendChild(svgText(line, item.w / 2, start + index * layout.lineHeight, {
      class:empty ? "seat-empty" : "seat-name", "font-size":layout.size, fill:item.nameColor || "#4e3721", "dominant-baseline":"central"
    })));
    group.appendChild(textGroup);
  }

  function renderShape(item) {
    const group = svgEl("g", {
      class: "item shape-item",
      "data-id": item.id,
      transform: transformFor(item)
    });
    const fill = item.fill || "#efd39b";
    const stroke = item.stroke || "#b58b49";

    if (item.kind === "circle") {
      group.appendChild(svgEl("ellipse", {
        class: "shape-fill",
        cx: item.w / 2,
        cy: item.h / 2,
        rx: item.w / 2,
        ry: item.h / 2,
        fill,
        stroke
      }));
    } else if (item.kind === "triangle") {
      group.appendChild(svgEl("polygon", {
        class: "shape-fill",
        points: `${item.w / 2},0 ${item.w},${item.h} 0,${item.h}`,
        fill,
        stroke
      }));
    } else {
      group.appendChild(svgEl("rect", {
        class: "shape-fill",
        x: 0,
        y: 0,
        width: item.w,
        height: item.h,
        rx: item.kind === "roundRect" ? Math.min(24, item.w / 4, item.h / 4) : 0,
        fill,
        stroke
      }));
    }

    if (item.label) {
      group.appendChild(svgText(item.label, item.w / 2, item.h / 2, {
        class: "shape-label", fill: item.textColor || "#6f4b20", "font-size":20
      }));
    }
    if (isSelected(item.id)) addSelectionChrome(group, item, true);
    return group;
  }

  function renderLabel(item) {
    const group = svgEl("g", { class: "item label-item", "data-id": item.id, transform: transformFor(item) });
    group.appendChild(svgEl("rect", { class:"label-hitbox", x:0, y:0, width:item.w, height:item.h, rx:4 }));
    const layout = SeatMateCore.fitText(item.text || "标注", item.w - 16, item.h - 12, item.size || 28, measurerFor(item));
    const start = (item.h - layout.height) / 2 + layout.lineHeight / 2;
    layout.lines.forEach((line,index) => group.appendChild(svgText(line, 8, start + index * layout.lineHeight, { class:"layout-label", "font-size":layout.size, "font-family":fontStack(item.fontFamily), fill:item.color || "#4e3721", "dominant-baseline":"central" })));
    group.appendChild(svgTitle(item.text || "标注"));
    if (isSelected(item.id)) addSelectionChrome(group, item, true);
    return group;
  }

  function addSelectionChrome(group, item, resizable) {
    group.appendChild(svgEl("rect", { class: "selected-outline", x: 0, y: 0, width: item.w, height: item.h, rx: 4 }));
    addRotateHandle(group, item, item.w, item.h);
    if (resizable) addResizeHandles(group, item, item.w, item.h);
  }

  function addResizeHandles(group, item, width, height, xOffset = 0, yOffset = 0) {
    const scale = Math.hypot(els.stage.getScreenCTM()?.a || 1, els.stage.getScreenCTM()?.b || 0);
    const size = 9 / scale;
    const handles = [["nw",0,0],["n",width/2,0],["ne",width,0],["e",width,height/2],["se",width,height],["s",width/2,height],["sw",0,height],["w",0,height/2]];
    handles.forEach(([name,x,y]) => {
      const handle = svgEl("rect", { class: "resize-handle", "data-id": item.id, "data-resize": name, x: x+xOffset-size/2, y:y+yOffset-size/2, width:size, height:size, rx:name.length === 1 ? size/2 : size/5 });
      handle.appendChild(svgTitle(name.length === 1 ? (/[ew]/.test(name) ? "拖动调整宽度" : "拖动调整高度") : "拖动调整大小"));
      group.appendChild(handle);
    });
  }

  function addRotateHandle(group, item, width, height, xOffset = 0, yOffset = 0) {
    const cx = xOffset + width / 2;
    const cy = yOffset - 26;
    group.appendChild(svgEl("line", {
      class: "rotate-stem",
      x1: cx,
      y1: yOffset - 4,
      x2: cx,
      y2: cy + 8
    }));
    group.appendChild(svgEl("circle", {
      class: "rotate-handle",
      "data-id": item.id,
      "data-rotate": "true",
      cx,
      cy,
      r: 9
    }));
  }

  function renderPeople() {
    const query = els.personSearch.value.trim().toLowerCase();
    const people = state.people.filter((person) => {
      if (ui.rosterFilter.value === "pending" && person.assignedSeatId) return false;
      if (ui.rosterFilter.value === "assigned" && !person.assignedSeatId) return false;
      return !query || `${person.name} ${person.unit}`.toLowerCase().includes(query);
    });

    els.peopleList.replaceChildren();
    if (!people.length) {
      const empty = document.createElement("div");
      empty.className = "empty-list";
      empty.innerHTML = state.people.length ? '没有符合条件的人员<small>试试其他姓名或切换筛选条件</small>' : '<svg class="ui-icon" aria-hidden="true"><use href="#i-people"/></svg>等待第一位参会者<small>在上方粘贴姓名，开始安排座位</small>';
      els.peopleList.appendChild(empty);
      return;
    }

    people.forEach((person) => {
      const card = document.createElement("div");
      card.className = `person-card${person.assignedSeatId ? " is-assigned" : ""}`;
      card.draggable = false;
      card.dataset.personId = person.id;
      card.tabIndex = 0;
      card.setAttribute("aria-label", `${person.name}，${person.assignedSeatId ? seatLabel(person.assignedSeatId) : "待安排"}`);
      card.addEventListener("keydown", event => {
        if (event.target !== card || !["Enter", " "].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation(); card.click();
      });

      const swatch = document.createElement("span");
      swatch.className = "person-swatch";
      swatch.style.background = colorForUnit(person.unit || person.name);

      const text = document.createElement("div");
      text.className = "person-text";
      const name = document.createElement("div");
      name.className = "person-name";
      name.dataset.assignField = "name";
      name.textContent = person.name;
      name.title = `点击用「${person.name}」排座`;
      const unit = document.createElement("div");
      unit.className = "person-unit";
      unit.dataset.assignField = "unit";
      unit.textContent = person.unit || (person.kind === "organization" ? "单位" : "—");
      unit.title = person.unit ? `点击用「${person.unit}」排座` : "没有单独的单位，排座时使用左侧名称";
      unit.classList.toggle("is-empty", !person.unit);
      text.append(name, unit);

      const meta = document.createElement("div");
      meta.className = "person-meta";
      const seat = document.createElement("span");
      seat.className = "person-seat";
      seat.textContent = person.assignedSeatId ? seatLabel(person.assignedSeatId) : "待排";
      const edit = document.createElement("button");
      edit.className = "person-edit";
      edit.type = "button";
      edit.title = `修改 ${person.name} 的姓名和单位`;
      edit.setAttribute("aria-label", `修改 ${person.name}`);
      edit.dataset.editPerson = person.id;
      edit.textContent = "改";
      const remove = document.createElement("button");
      remove.className = "person-remove";
      remove.type = "button";
      remove.title = `移除 ${person.name}`;
      remove.setAttribute("aria-label", `移除 ${person.name}`);
      remove.dataset.removePerson = person.id;
      remove.textContent = "×";
      meta.append(seat, edit, remove);

      card.append(swatch, text, meta);
      els.peopleList.appendChild(card);
    });
  }

  function renderInspector() {
    const items = getSelectedItems();
    const item = items[0] || null;
    if (items.length > 1) {
      renderMultiInspector(items);
      return;
    }
    if (!item) {
      const seats = getSeats();
      const assigned = seats.filter((seat) => seat.personId).length;
      els.inspector.innerHTML = `
        <div class="inspector-empty">
          <svg class="ui-icon" aria-hidden="true"><use href="#i-sliders"/></svg>
          <strong>让每个细节恰到好处</strong><br>
          在画布中选择桌面、座位或文字，<br>即可调整大小、位置、颜色和人员。<br><br>
          Shift 点击多选，批量对齐更轻松。
        </div>
      `;
      return;
    }

    if (item.type === "table") renderTableInspector(item);
    if (item.type === "shape") renderShapeInspector(item);
    if (item.type === "seat") renderSeatInspector(item);
    if (item.type === "label") renderLabelInspector(item);
  }

  function renderMultiInspector(items) {
    const bounds = boundsForItems(items);
    const seats = items.filter((item) => item.type === "seat").length;
    const tables = items.filter((item) => item.type === "table").length;
    const shapes = items.filter((item) => item.type === "shape").length;
    const labels = items.filter((item) => item.type === "label").length;
    const groups = unique(items.map((item) => item.groupId)).length;
    els.inspector.innerHTML = `
      <div class="inspector-empty">
        <strong>${items.length}</strong> 个对象已选择<br>
        桌面 ${tables} · 图形 ${shapes} · 座位 ${seats} · 文字 ${labels}${groups ? ` · 组合 ${groups}` : ""}
      </div>
      <div class="field-grid">
        ${fieldHtml("整体旋转", "batchRotation", 0, "number", "full")}
      </div>
      <div class="align-grid">
        <button class="mini-btn" data-action="align-left" type="button">左对齐</button>
        <button class="mini-btn" data-action="align-center" type="button">水平居中</button>
        <button class="mini-btn" data-action="align-right" type="button">右对齐</button>
        <button class="mini-btn" data-action="align-top" type="button">顶对齐</button>
        <button class="mini-btn" data-action="align-middle" type="button">垂直居中</button>
        <button class="mini-btn" data-action="align-bottom" type="button">底对齐</button>
      </div>
      <div class="inspector-empty">
        范围：${round(bounds.w)} × ${round(bounds.h)}
      </div>
      <div class="inspector-actions">
        <button class="mini-btn" data-action="duplicate" type="button">复制</button>
        <button class="mini-btn danger" data-action="delete" type="button">删除</button>
      </div>
    `;
    bindInspectorInputs();
  }

  function renderTableInspector(item) {
    els.inspector.innerHTML = `
      <div class="field-grid">
        ${fieldHtml("名称", "label", item.label || "", "text", "full")}
        ${fieldHtml("X", "x", round(item.x), "number")}
        ${fieldHtml("Y", "y", round(item.y), "number")}
        ${fieldHtml("宽", "w", round(item.w), "number")}
        ${fieldHtml("高", "h", round(item.h), "number")}
        ${fieldHtml("旋转", "rotation", round(item.rotation || 0), "number")}
        <div class="field">
          <label>颜色</label>
          <input data-prop="fill" type="color" value="${escapeAttr(item.fill || "#edcf95")}">
        </div>
      </div>
      <div class="inspector-actions">
        <button class="mini-btn" data-action="duplicate" type="button">复制</button>
        <button class="mini-btn danger" data-action="delete" type="button">删除</button>
      </div>
    `;
    bindInspectorInputs();
  }

  function renderShapeInspector(item) {
    els.inspector.innerHTML = `
      <div class="field-grid">
        ${fieldHtml("名称", "label", item.label || "", "text", "full")}
        ${fieldHtml("X", "x", round(item.x), "number")}
        ${fieldHtml("Y", "y", round(item.y), "number")}
        ${fieldHtml("宽", "w", round(item.w), "number")}
        ${fieldHtml("高", "h", round(item.h), "number")}
        ${fieldHtml("旋转", "rotation", round(item.rotation || 0), "number")}
        <div class="field">
          <label>填充</label>
          <input data-prop="fill" type="color" value="${escapeAttr(item.fill || "#efd39b")}">
        </div>
        <div class="field">
          <label>描边</label>
          <input data-prop="stroke" type="color" value="${escapeAttr(item.stroke || "#b58b49")}">
        </div>
        ${item.kind !== "triangle" ? `<label class="check-row full"><input type="checkbox" data-prop="isTable" ${item.isTable ? "checked" : ""}>作为桌面，允许座椅贴合</label>` : ""}
      </div>
      <div class="inspector-actions">
        <button class="mini-btn" data-action="duplicate" type="button">复制</button>
        <button class="mini-btn danger" data-action="delete" type="button">删除</button>
      </div>
    `;
    bindInspectorInputs();
  }

  function renderSeatInspector(item) {
    const occupant = item.personId ? getPerson(item.personId) : null;
    const personOptions = [
      `<option value="">空位</option>`,
      ...state.people.map((person) => {
        const selected = item.personId === person.id ? " selected" : "";
        return `<option value="${escapeAttr(person.id)}"${selected}>${escapeHtml(person.name)}</option>`;
      })
    ].join("");

    els.inspector.innerHTML = `
      <div class="field-grid">
        ${fieldHtml("座位号", "label", item.label || "", "text", "full")}
        <div class="field full">
          <label>人员</label>
          <select id="seatPersonSelect">${personOptions}</select>
        </div>
        ${fieldHtml("X", "x", round(item.x), "number")}
        ${fieldHtml("Y", "y", round(item.y), "number")}
        ${fieldHtml("宽", "w", round(item.w), "number")}
        ${fieldHtml("高", "h", round(item.h), "number")}
        ${fieldHtml("名称字号", "nameSize", round(item.nameSize || 24), "number")}
        ${fieldHtml("旋转", "rotation", round(item.rotation || 0), "number")}
        ${occupant && occupant.unit ? selectHtml("座位显示", "showUnit", item.showUnit ? "unit" : "name", { name: `姓名（${occupant.name}）`, unit: `单位（${occupant.unit}）` }, "full") : ""}
        <div class="field full">
          <label>名称颜色</label>
          <input data-prop="nameColor" type="color" value="${escapeAttr(item.nameColor || "#211f1b")}">
        </div>
      </div>
      <div class="inspector-actions">
        <button class="mini-btn" data-action="unassign" type="button">置空</button>
        <button class="mini-btn danger" data-action="delete" type="button">删除</button>
      </div>
    `;
    bindInspectorInputs();
    const select = els.inspector.querySelector("#seatPersonSelect");
    select.addEventListener("change", () => {
      commitHistory();
      if (select.value) assignPersonToSeat(select.value, item.id, item.showUnit ? "unit" : "name");
      else unassignSeat(item.id);
      renderAll();
      scheduleSave();
    });
  }

  function renderLabelInspector(item) {
    els.inspector.innerHTML = `
      <div class="field-grid">
        <div class="field full">
          <label>文字</label>
          <textarea data-prop="text" rows="3">${escapeHtml(item.text || "")}</textarea>
        </div>
        ${fieldHtml("X", "x", round(item.x), "number")}
        ${fieldHtml("Y", "y", round(item.y), "number")}
        ${fieldHtml("宽", "w", round(item.w), "number")}
        ${fieldHtml("高", "h", round(item.h), "number")}
        ${fieldHtml("字号", "size", round(item.size || 24), "number")}
        ${fieldHtml("旋转", "rotation", round(item.rotation || 0), "number")}
        ${selectHtml("字体", "fontFamily", item.fontFamily || "sans", FONT_LABELS, "full")}
      </div>
      <div class="inspector-actions">
        <button class="mini-btn" data-action="duplicate" type="button">复制</button>
        <button class="mini-btn danger" data-action="delete" type="button">删除</button>
      </div>
    `;
    bindInspectorInputs();
  }

  function bindInspectorInputs() {
    els.inspector.querySelectorAll(".field").forEach((field, index) => {
      const input = field.querySelector("input,select,textarea");
      const label = field.querySelector("label");
      if (input && label) { input.id ||= `inspector-field-${index}`; label.htmlFor = input.id; }
    });
    els.inspector.querySelectorAll("[data-prop]").forEach((input) => {
      input.addEventListener("focus", () => commitHistory(), { once: true });
      input.addEventListener("input", () => {
        const prop = input.dataset.prop;
        let value = input.value;
        if (input.type === "checkbox") value = input.checked;
        if (input.type === "number") value = Number.parseFloat(input.value) || 0;
        if (prop === "batchRotation") {
          getSelectedItems().forEach((selectedItem) => {
            selectedItem.rotation = value;
            if (selectedItem.type === "seat") delete selectedItem.tableId;
            updateDockedSeats(selectedItem.id);
            refitSeatText(selectedItem);
          });
          renderStage();
          renderStatus();
          scheduleSave();
          return;
        }
        const item = getSelectedItem();
        if (!item) return;
        item[prop] = value;
        if (["w", "h"].includes(prop)) item[prop] = Math.max(16, item[prop]);
        if (item.type === "seat" && ["x","y","w","h","rotation"].includes(prop)) delete item.tableId;
        // A chair sized in the panel keeps that size as its own, and one turned there refits its name.
        if (item.type === "seat" && ["w","h"].includes(prop)) { delete item.baseW; delete item.baseH; }
        if (item.type === "seat" && prop === "rotation") refitSeatText(item);
        if (item.type === "seat" && prop === "showUnit") { item.showUnit = value === "unit"; refitSeatText(item); }
        if (item.type === "label" && ["size", "text", "fontFamily"].includes(prop)) {
          if (prop === "fontFamily") state.settings.drawFont = value;
          ensureLabelTextRoom(item);
        }
        if (["x", "y", "w", "h", "rotation"].includes(prop)) updateDockedSeats(item.id);
        if (prop === "isTable") {
          getSeats().forEach(seat => { if (value) orientSeatTowardNearestTable(seat); else if (seat.tableId === item.id) delete seat.tableId; });
        }
        renderStage();
        renderStatus();
        scheduleSave();
      });
    });

    els.inspector.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.action === "duplicate") duplicateSelected();
        if (button.dataset.action === "delete") deleteSelected();
        if (button.dataset.action && button.dataset.action.startsWith("align-")) alignSelected(button.dataset.action.replace("align-", ""));
        if (button.dataset.action === "unassign") {
          const item = getSelectedItem();
          if (item && item.type === "seat") {
            commitHistory();
            unassignSeat(item.id);
            renderAll();
            scheduleSave();
          }
        }
      });
    });
  }

  function renderStatus() {
    const seats = getSeats();
    const assigned = seats.filter((seat) => seat.personId).length;
    const peopleAssigned = state.people.filter((person) => person.assignedSeatId).length;
    renderPalette();
    ui.snapTablesToggle.checked = state.settings.snapTables !== false;
    els.statusLine.textContent = `${seats.length} 个座位 · ${seats.length - assigned} 个空位`;
    els.rosterCount.textContent = state.people.length;
    ui.totalPeople.textContent = state.people.length;
    ui.assignedPeople.textContent = peopleAssigned;
    ui.pendingPeople.textContent = state.people.length - peopleAssigned;
    const percent = state.people.length ? Math.round(peopleAssigned / state.people.length * 100) : 0;
    ui.assignmentProgress.style.width = `${percent}%`;
    ui.assignmentProgress.parentElement.setAttribute("aria-valuenow", percent);
    ui.progressText.textContent = state.people.length ? `已完成 ${percent}%` : "尚未添加人员";
    ui.canvasEmpty.hidden = !!state.items.length || !!state.draftImage || dismissedEmpty;
    ui.editPropertiesBtn.disabled = !getSelectedIds().length;
    els.autoAssignBtn.disabled = !state.people.some(person => !person.assignedSeatId);
    els.clearAssignBtn.disabled = !assigned;
    els.clearPeopleBtn.disabled = !state.people.length;
    els.draftAutoBtn.disabled = !state.draftImage;
    els.canvasTitle.textContent = state.title || "未命名会议室";

    const selected = getSelectedItem();
    const selectedItems = getSelectedItems();
    if (selectedItems.length > 1) {
      els.selectionHint.textContent = `已选择 ${selectedItems.length} 个对象`;
      return;
    }
    if (!selected) {
      els.selectionHint.textContent = `${peopleAssigned}/${state.people.length} 人已落座`;
      return;
    }
    if (selected.type === "table") els.selectionHint.textContent = `已选择桌面：${selected.label || "未命名"}`;
    if (selected.type === "shape") els.selectionHint.textContent = `已选择图形：${selected.label || "未命名"}`;
    if (selected.type === "seat") els.selectionHint.textContent = `已选择座位：${selected.label || selected.id}`;
    if (selected.type === "label") els.selectionHint.textContent = `已选择文字：${selected.text || ""}`;
  }

  function updateHistoryButtons() {
    const hasSelection = getSelectedIds().length > 0;
    const selectedItems = getSelectedItems();
    const hasGroup = selectedItems.some((item) => item.groupId);
    els.undoBtn.disabled = history.length === 0;
    els.redoBtn.disabled = redoStack.length === 0;
    document.querySelectorAll("[data-history]").forEach(button => { button.disabled = button.dataset.history === "undo" ? !history.length : !redoStack.length; });
    els.rotateLeftBtn.disabled = !hasSelection;
    els.rotateRightBtn.disabled = !hasSelection;
    els.groupBtn.disabled = selectedItems.length < 2;
    els.ungroupBtn.disabled = !hasGroup;
    els.duplicateBtn.disabled = !hasSelection;
    els.deleteBtn.disabled = !hasSelection;
    els.draftClearBtn.disabled = !state.draftImage;
  }

  function selectHtml(label, prop, value, options, extraClass = "") {
    const choices = Object.entries(options).map(([key, text]) =>
      `<option value="${escapeAttr(key)}"${key === value ? " selected" : ""}>${escapeHtml(text)}</option>`).join("");
    return `
      <div class="field ${extraClass}">
        <label for="prop-${escapeAttr(prop)}">${escapeHtml(label)}</label>
        <select id="prop-${escapeAttr(prop)}" data-prop="${escapeAttr(prop)}">${choices}</select>
      </div>
    `;
  }

  function fieldHtml(label, prop, value, type = "text", extraClass = "") {
    return `
      <div class="field ${extraClass}">
        <label for="prop-${escapeAttr(prop)}">${escapeHtml(label)}</label>
        <input id="prop-${escapeAttr(prop)}" data-prop="${escapeAttr(prop)}" type="${escapeAttr(type)}" value="${escapeAttr(String(value))}">
      </div>
    `;
  }

  function createTable(x, y, w, h, label = "", fill = state.settings.drawFill || "#edbe4c") {
    return {
      id: makeId("table"),
      type: "table",
      x,
      y,
      w,
      h,
      rotation: 0,
      label,
      textColor:state.settings.drawText || "#4e3721",
      fill
    };
  }

  // A dragged row of chairs: evenly spaced along the drag, all facing across it.
  const SEAT_ROW_SPACING = 136;

  function seatRowPlan(start, end) {
    const dx = end.x - start.x, dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    const count = Math.max(1, Math.min(60, Math.round(length / SEAT_ROW_SPACING) + 1));
    const rotation = count > 1 ? Math.round(Math.atan2(dy, dx) * 180 / Math.PI) : 0;
    const step = count > 1 ? { x: dx / (count - 1), y: dy / (count - 1) } : { x: 0, y: 0 };
    const centers = [];
    for (let index = 0; index < count; index++) centers.push({ x: start.x + step.x * index, y: start.y + step.y * index });
    return { count, rotation, centers };
  }

  function createSeatRow(start, end) {
    const plan = seatRowPlan(start, end);
    const seats = plan.centers.map(center => {
      const seat = createSeat(center.x - 60, center.y - 40, nextSeatLabel(), plan.rotation);
      seat.fill = state.settings.drawFill;
      state.items.push(seat);
      return seat;
    });
    seats.forEach(orientSeatTowardNearestTable);
    return seats;
  }

  function createSeat(x, y, label = "S01", rotation = 0, w = 120, h = 80) {
    return { id:makeId("seat"), type:"seat", x,y,w,h,rotation,label, personId:null, nameSize:24, nameColor:state.settings.drawText || "#4e3721", textLayoutVersion:2 };
  }

  function createShape(x, y, w, h, kind = "rect") {
    const names = {
      rect: "矩形",
      roundRect: "圆角矩形",
      circle: "圆形",
      triangle: "三角形"
    };
    return {
      id: makeId("shape"),
      type: "shape",
      kind,
      x,
      y,
      w,
      h,
      rotation: 0,
      label: "",
      fill: state.settings.drawFill || "#edbe4c",
      textColor:state.settings.drawText || "#4e3721",
      stroke: "#b58b49"
    };
  }

  function createLabel(x, y, text = "标注", size = 28) {
    const lines = String(text).split("\n");
    const family = state.settings.drawFont || "sans";
    return { id:makeId("label"), type:"label", x,y, w:Math.max(60,...lines.map(line => measureText(line,size,family)))+20, h:lines.length*size*1.3+16, rotation:0, text, size, fontFamily:family, color:state.settings.drawText || "#4e3721", boxText:true };
  }

  function addHorizontalStrip(items, x, y, w, h, count, prefix, label) {
    items.push(createTable(x, y, w, h, label, "#e4d1aa"));
    const cell = w / count;
    for (let index = 0; index < count; index += 1) {
      items.push(createSeat(x + index * cell + 5, y + h + 10, `${prefix}${index + 1}`, 0, cell - 10, 48));
    }
  }

  function importDraftFile() {
    const file = els.draftFile.files && els.draftFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      commitHistory();
      state.draftImage = {
        src: String(reader.result || ""),
        name: file.name,
        importedAt: new Date().toISOString()
      };
      state.settings.showReference = true;
      renderAll();
      scheduleSave();
      pulseButton(els.draftImportBtn, "已导入", "导入草稿");
    };
    reader.readAsDataURL(file);
    els.draftFile.value = "";
  }

  function clearDraftImage() {
    if (!state.draftImage) {
      pulseButton(els.draftClearBtn, "无草稿", "清除草稿");
      return;
    }
    commitHistory();
    state.draftImage = null;
    renderAll();
    scheduleSave();
  }

  function autoLayoutFromDraft() {
    if (!state.draftImage || !state.draftImage.src) {
      pulseButton(els.draftAutoBtn, "先导入草稿", "草稿自动布局");
      return;
    }

    analyzeDraftImage(state.draftImage.src)
      .then((analysis) => {
        commitHistory();
        state.items = buildAutoLayoutFromAnalysis(analysis);
        state.people.forEach((person) => {
          person.assignedSeatId = null;
        });
        clearSelection();
        fitView(false);
        renderAll();
        scheduleSave();
        pulseButton(els.draftAutoBtn, "已布局", "草稿自动布局");
      })
      .catch(() => {
        pulseButton(els.draftAutoBtn, "识别失败", "草稿自动布局");
      });
  }

  function analyzeDraftImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const maxWidth = 360;
        const scale = Math.min(1, maxWidth / image.naturalWidth);
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(image, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height).data;
        const pixels = [];
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          pixels.push(gray);
        }
        const sorted = [...pixels].sort((a, b) => a - b);
        const cutoff = sorted[Math.floor(sorted.length * 0.28)] || 120;
        const threshold = Math.min(170, Math.max(70, cutoff + 18));
        const rowInk = Array.from({ length: height }, () => 0);
        const colInk = Array.from({ length: width }, () => 0);
        let inkCount = 0;
        pixels.forEach((gray, index) => {
          if (gray > threshold) return;
          const x = index % width;
          const y = Math.floor(index / width);
          rowInk[y] += 1;
          colInk[x] += 1;
          inkCount += 1;
        });
        resolve({
          width,
          height,
          inkRatio: inkCount / pixels.length,
          horizontalBands: bandsFromProjection(rowInk, width * 0.035),
          verticalBands: bandsFromProjection(colInk, height * 0.035),
          bounds: inkBounds(pixels, width, height, threshold)
        });
      };
      image.onerror = reject;
      image.src = src;
    });
  }

  function bandsFromProjection(values, minimumInk) {
    const bands = [];
    let start = null;
    values.forEach((value, index) => {
      if (value >= minimumInk && start === null) start = index;
      if ((value < minimumInk || index === values.length - 1) && start !== null) {
        const end = value < minimumInk ? index - 1 : index;
        if (end - start >= 2) bands.push({ start, end, center: (start + end) / 2, size: end - start + 1 });
        start = null;
      }
    });
    return bands;
  }

  function inkBounds(pixels, width, height, threshold) {
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    pixels.forEach((gray, index) => {
      if (gray > threshold) return;
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    if (minX > maxX || minY > maxY) return null;
    return { minX, minY, maxX, maxY };
  }

  function buildAutoLayoutFromAnalysis(analysis) {
    if (!analysis || analysis.inkRatio < 0.001 || !analysis.bounds) throw new Error("草稿线条不足");
    const broadHorizontal = analysis.horizontalBands.filter((band) => band.size > analysis.height * 0.025);
    const broadVertical = analysis.verticalBands.filter((band) => band.size > analysis.width * 0.025);

    const items = [];
    const xScale = WORKSPACE.width / analysis.width;
    const yScale = WORKSPACE.height / analysis.height;
    const xBands = mergeCloseBands(broadVertical.length ? broadVertical : analysis.verticalBands, analysis.width * 0.04);
    const yBands = mergeCloseBands(broadHorizontal.length ? broadHorizontal : analysis.horizontalBands, analysis.height * 0.04);
    if (xBands.length < 2) {
      xBands.push({ center: analysis.bounds.minX }, { center: analysis.bounds.maxX });
    }
    if (yBands.length < 2) {
      yBands.push({ center: analysis.bounds.minY }, { center: analysis.bounds.maxY });
    }

    const minX = clamp(Math.min(...xBands.map((band) => band.center)) * xScale - 80, 60, WORKSPACE.width - 260);
    const maxX = clamp(Math.max(...xBands.map((band) => band.center)) * xScale + 80, minX + 220, WORKSPACE.width - 60);
    const minY = clamp(Math.min(...yBands.map((band) => band.center)) * yScale - 60, 80, WORKSPACE.height - 220);
    const maxY = clamp(Math.max(...yBands.map((band) => band.center)) * yScale + 60, minY + 160, WORKSPACE.height - 80);
    const tableW = clamp(maxX - minX, 220, 760);
    const tableH = clamp(maxY - minY, 100, 320);
    const tableX = clamp((minX + maxX - tableW) / 2, 60, WORKSPACE.width - tableW - 60);
    const tableY = clamp((minY + maxY - tableH) / 2, 80, WORKSPACE.height - tableH - 80);
    items.push(createTable(tableX, tableY, tableW, tableH, "", "#ead8b8"));

    const topCount = clamp(countBandsInRange(xBands, minX / xScale, maxX / xScale), 2, 10);
    const bottomCount = clamp(Math.max(topCount, Math.round(analysis.verticalBands.length / 3)), 2, 12);
    const sideCount = clamp(countBandsInRange(yBands, minY / yScale, maxY / yScale), 1, 6);

    distribute(topCount, tableX + 22, tableX + tableW - 22).forEach((x, index) => {
      items.push(createSeat(x - 43, tableY - 58, `A${index + 1}`, 180));
    });
    distribute(bottomCount, tableX + 22, tableX + tableW - 22).forEach((x, index) => {
      items.push(createSeat(x - 43, tableY + tableH + 10, `B${index + 1}`, 0));
    });
    distribute(sideCount, tableY + 18, tableY + tableH - 18).forEach((y, index) => {
      items.push(createSeat(tableX - 96, y - 24, `C${index + 1}`, 90));
      items.push(createSeat(tableX + tableW + 10, y - 24, `D${index + 1}`, -90));
    });

    const lowerBands = yBands.filter((band) => band.center * yScale > tableY + tableH + 120);
    lowerBands.slice(0, 3).forEach((band, rowIndex) => {
      const y = clamp(band.center * yScale, tableY + tableH + 130, WORKSPACE.height - 95);
      const count = clamp(Math.round(xBands.length * 1.4), 4, 10);
      items.push(createTable(tableX, y, tableW, 52, "", "#e4d1aa"));
      distribute(count, tableX + 20, tableX + tableW - 20).forEach((x, index) => {
        items.push(createSeat(x - 40, y + 62, `R${rowIndex + 1}-${index + 1}`, 0, 80, 46));
      });
    });

    const leftBands = xBands.filter((band) => band.center * xScale < tableX - 120);
    leftBands.slice(0, 4).forEach((band, colIndex) => {
      const x = clamp(band.center * xScale, 70, tableX - 120);
      const count = clamp(sideCount + 2, 3, 8);
      items.push(createTable(x, tableY, 58, clamp(tableH + 140, 220, 520), "", "#e8d3ac"));
      distribute(count, tableY + 28, tableY + Math.min(tableH + 110, 500)).forEach((y, index) => {
        items.push(createSeat(x - 92, y - 24, `L${colIndex + 1}-${index + 1}`, 90, 78, 50));
      });
    });

    if (!items.some((item) => item.type === "seat")) {
      throw new Error("未识别到座位结构");
    }
    return items;
  }

  function mergeCloseBands(bands, gap) {
    const sorted = [...bands].sort((a, b) => a.center - b.center);
    const merged = [];
    sorted.forEach((band) => {
      const last = merged[merged.length - 1];
      if (!last || band.center - last.center > gap) {
        merged.push({ ...band });
        return;
      }
      last.start = Math.min(last.start, band.start);
      last.end = Math.max(last.end, band.end);
      last.size += band.size;
      last.center = (last.start + last.end) / 2;
    });
    return merged;
  }

  function countBandsInRange(bands, min, max) {
    return bands.filter((band) => band.center >= min && band.center <= max).length;
  }

  function loadPeopleFromTextarea() {
    const parsed = parsePeopleText(els.peopleInput.value);
    if (!parsed.length) {
      showToast("请先输入或粘贴参会人员姓名");
      return;
    }
    commitHistory();
    const previousCount = state.people.length;
    appendPeople(parsed);
    els.peopleInput.value = "";
    renderAll();
    scheduleSave();
    const added = state.people.length - previousCount;
    if (added) ui.rosterImport.open = false;
    showToast(added ? `已添加 ${added} 位参会人员${parsed.length > added ? "，重复人员已跳过" : ""}` : "这些人员已在名单中，无需重复添加", !!added);
  }

  function importPeopleFile() {
    const file = els.peopleFile.files && els.peopleFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parsePeopleText(String(reader.result || ""));
      if (!parsed.length) {
        pulseButton(els.peopleFileBtn, "无名单", "文件");
        return;
      }
      commitHistory();
      appendPeople(parsed);
      renderAll();
      scheduleSave();
      ui.rosterImport.open = false;
      showToast("名单文件已导入，重复人员已跳过", true);
    };
    reader.readAsText(file, "utf-8");
    els.peopleFile.value = "";
  }

  function appendPeople(people) {
    const existing = new Set(state.people.map((person) => `${person.name}::${person.unit || ""}`));
    people.forEach((person) => {
      const key = `${person.name}::${person.unit || ""}`;
      if (existing.has(key)) return;
      state.people.push({
        id: makeId("person"),
        name: person.name,
        unit: person.unit || "",
        kind: person.kind || (SeatMateCore.isOrganization(person.name) ? "organization" : "person"),
        assignedSeatId: null
      });
      existing.add(key);
    });
  }

  function parsePeopleText(text) {
    return SeatMateCore.parseRoster(text);
  }

  function autoAssign() {
    const seats = getSeats()
      .filter((seat) => !seat.personId)
      .sort(positionSort);
    const people = state.people
      .filter((person) => !person.assignedSeatId)
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    if (!people.length) { showToast("所有人员都已安排座位"); return; }
    if (!seats.length) { showToast("没有可用座位，请先添加座位或使用布局模板"); return; }
    commitHistory();
    people.slice(0, seats.length).forEach((person, index) => assignPersonToSeat(person.id, seats[index].id));
    renderAll();
    scheduleSave();
    const remaining = Math.max(0, people.length - seats.length);
    showToast(remaining ? `已安排 ${seats.length} 人，还有 ${remaining} 人待安排，请增加座位` : `已为 ${people.length} 位参会人员安排座位`, true);
  }

  function clearAssignments() {
    if (!getSeats().some((seat) => seat.personId)) return;
    commitHistory();
    getSeats().forEach((seat) => {
      seat.personId = null;
    });
    state.people.forEach((person) => {
      person.assignedSeatId = null;
    });
    renderAll();
    scheduleSave();
  }

  async function clearPeople() {
    if (!state.people.length) return;
    if (!await openDialog("清空参会名单？", "所有参会人员及其座位分配将被移除，会场布局会保留。此操作可以撤销。", { confirm: "清空名单" })) return;
    commitHistory();
    state.people = [];
    getSeats().forEach((seat) => {
      seat.personId = null;
    });
    renderAll();
    scheduleSave();
  }

  // The name and the unit are edited as the two separate columns they are stored in.
  async function editPerson(personId) {
    const person = getPerson(personId);
    if (!person) return;
    const accepted = await openDialog("修改参会条目", "姓名单独一列，单位单独一列；单位留空时名单里显示为“—”。", {
      confirm: "保存修改",
      fields: [
        { key: "name", label: "姓名 / 名称", value: person.name },
        { key: "unit", label: "单位", value: person.unit || "" }
      ]
    });
    if (!accepted) return;
    const read = key => (ui.dialogContent.querySelector(`[data-field="${key}"]`)?.value || "").trim().slice(0, 200);
    const name = read("name");
    if (!name) { showToast("姓名不能为空，未做修改"); return; }
    const unit = read("unit");
    if (name === person.name && unit === (person.unit || "")) return;
    commitHistory();
    person.name = name;
    person.unit = unit;
    person.kind = SeatMateCore.isOrganization(name) ? "organization" : "person";
    const seat = person.assignedSeatId ? getItem(person.assignedSeatId) : null;
    if (seat) ensureSeatTextRoom(seat, seatPersonText(seat, person));
    renderAll();
    scheduleSave();
    showToast(`已更新 ${name}`, true);
  }

  function removePerson(personId) {
    const person = getPerson(personId);
    if (!person) return;
    commitHistory();
    if (person.assignedSeatId) {
      const seat = getItem(person.assignedSeatId);
      if (seat) seat.personId = null;
    }
    state.people = state.people.filter((item) => item.id !== personId);
    renderAll();
    scheduleSave();
  }

  async function clearLayout() {
    if (!state.items.length && !state.draftImage) {
      pulseButton(els.clearLayoutBtn, "已为空", "清空布局");
      return;
    }
    if (!await openDialog("重新开始布局？", "当前桌椅、图形和草稿将被清除，参会名单会保留。此操作可以撤销。", { confirm: "清空布局" })) return;
    dismissedEmpty = false;
    commitHistory();
    state.items = [];
    state.draftImage = null;
    state.people.forEach((person) => {
      person.assignedSeatId = null;
    });
    clearSelection();
    renderAll();
    scheduleSave();
  }

  function selectAllItems() {
    setSelection(state.items.map((item) => item.id));
    renderAll();
    scheduleSave();
  }

  function groupSelected() {
    const items = getSelectedItems();
    if (items.length < 2) return;
    commitHistory();
    const groupId = makeId("group");
    items.forEach((item) => {
      item.groupId = groupId;
    });
    setSelection(items.map((item) => item.id));
    renderAll();
    scheduleSave();
  }

  function ungroupSelected() {
    const items = getSelectedItems();
    const groupIds = unique(items.map((item) => item.groupId));
    if (!groupIds.length) return;
    commitHistory();
    state.items.forEach((item) => {
      if (groupIds.includes(item.groupId)) delete item.groupId;
    });
    renderAll();
    scheduleSave();
  }

  function assignPersonToSeat(personId, seatId, field = "name") {
    const person = getPerson(personId);
    const seat = getItem(seatId);
    if (!person || !seat || seat.type !== "seat") return;

    if (person.assignedSeatId) {
      const oldSeat = getItem(person.assignedSeatId);
      if (oldSeat) oldSeat.personId = null;
    }
    if (seat.personId) {
      const oldPerson = getPerson(seat.personId);
      if (oldPerson) oldPerson.assignedSeatId = null;
    }

    seat.personId = person.id;
    person.assignedSeatId = seat.id;
    seat.showUnit = field === "unit" && Boolean(person.unit);
    ensureSeatTextRoom(seat, seatPersonText(seat, person));
  }

  function unassignSeat(seatId) {
    const seat = getItem(seatId);
    if (!seat || seat.type !== "seat") return;
    if (seat.personId) {
      const person = getPerson(seat.personId);
      if (person) person.assignedSeatId = null;
    }
    seat.personId = null;
  }

  function deleteSelected() {
    const items = getSelectedItems();
    if (!items.length) return;
    commitHistory();
    const ids = new Set(items.map((item) => item.id));
    items.forEach((item) => {
      if (item.type === "seat") unassignSeat(item.id);
    });
    state.items = state.items.filter((entry) => !ids.has(entry.id));
    clearSelection();
    renderAll();
    scheduleSave();
  }

  function duplicateSelected() {
    const items = getSelectedItems();
    if (!items.length) return;
    commitHistory();
    const copies = cloneSelectedItemsForDrag();
    copies.forEach((copy) => {
      copy.x += 24;
      copy.y += 24;
    });
    state.items.push(...copies);
    setSelection(copies.map((copy) => copy.id));
    renderAll();
    scheduleSave();
  }

  function cloneSelectedItemsForDrag(sourceItems = null) {
    const items = sourceItems || movableItems(getSelectedIds());
    if (!items.length) return [];
    const groupMap = new Map();
    const idMap = new Map(items.map(item => [item.id, makeId(item.type)]));
    return items.map((item) => {
      const copy = cloneItem(item);
      copy.id = idMap.get(item.id);
      if (copy.groupId) {
        if (!groupMap.has(copy.groupId)) groupMap.set(copy.groupId, makeId("group"));
        copy.groupId = groupMap.get(copy.groupId);
      }
      if (copy.type === "seat") { copy.personId = null; copy.tableId = idMap.get(item.tableId); }
      return copy;
    });
  }

  function rotateSelectionBy(degrees) {
    const selected = getSelectedItems();
    if (!selected.length) return;
    commitHistory();
    const items = movableItems(getSelectedIds());
    const activeAction = { ids:items.map(item => item.id), center:selectionCenter(getSelectedIds()), origins:items.map(cloneItem) };
    rotateItems(activeAction, degrees * Math.PI / 180);
    const ids = new Set(selected.map(item => item.id));
    selected.forEach(item => { if (item.type === "seat" && !ids.has(item.tableId)) delete item.tableId; });
    selected.forEach(item => { updateDockedSeats(item.id); refitSeatText(item); });
    renderAll(); scheduleSave();
  }

  function undo() {
    if (!history.length) return;
    ui.toast.hidden = true;
    redoStack.push(JSON.stringify(state));
    state = JSON.parse(history.pop());
    normalizeState();
    renderAll();
    scheduleSave();
  }

  function redo() {
    if (!redoStack.length) return;
    ui.toast.hidden = true;
    history.push(JSON.stringify(state));
    state = JSON.parse(redoStack.pop());
    normalizeState();
    renderAll();
    scheduleSave();
  }

  function commitHistory() {
    ui.toastUndo.hidden = true;
    history.push(JSON.stringify(state));
    if (history.length > 80) history.shift();
    redoStack = [];
    updateHistoryButtons();
  }

  function exportJson() {
    saveLocal();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json;charset=utf-8" });
    downloadBlob(blob, `seatmate-layout-${timestamp()}.json`);
  }

  function importProjectFile() {
    const file = els.projectFile.files && els.projectFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const nextState = SeatMateProject.parse(String(reader.result || ""));
        if ((state.items.length || state.people.length || state.draftImage) && !await openDialog("导入这份布局？", "当前布局和名单将替换为文件中的内容。导入后可以撤销，恢复原有工作。", { confirm: "导入布局" })) return;
        commitHistory();
        state = nextState;
        dismissedEmpty = false;
        els.personSearch.value = "";
        ui.rosterFilter.value = "all";
        normalizeState();
        renderAll();
        scheduleSave();
        showToast("布局、名单及座位分配已恢复", true);
      } catch (error) {
        showToast(error instanceof SyntaxError ? "文件不是有效的 JSON，当前布局未改变" : `${error.message}，当前布局未改变`);
      }
    };
    reader.onerror = () => showToast("文件读取失败，请重新选择布局文件");
    reader.readAsText(file, "utf-8");
    els.projectFile.value = "";
  }

  function exportPng() {
    els.exportPngBtn.disabled = true;
    const svgSource = buildExportSvg();
    const blob = new Blob([svgSource], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = WORKSPACE.width * 2;
      canvas.height = WORKSPACE.height * 2;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((pngBlob) => {
        URL.revokeObjectURL(url);
        els.exportPngBtn.disabled = false;
        if (!pngBlob) { showToast("图片生成失败，请重试"); return; }
        downloadBlob(pngBlob, `seatmate-layout-${timestamp()}.png`);
        showToast("高清图片已生成（3200 × 2000）");
      }, "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      els.exportPngBtn.disabled = false;
      showToast("图片导出失败，请重试");
    };
    image.src = url;
  }

  function buildExportSvg() {
    const lines = [];
    for (let x = 0; x <= WORKSPACE.width; x += 100) {
      lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${WORKSPACE.height}" stroke="#f2e7d4" stroke-width="1"/>`);
    }
    for (let y = 0; y <= WORKSPACE.height; y += 100) {
      lines.push(`<line x1="0" y1="${y}" x2="${WORKSPACE.width}" y2="${y}" stroke="#f2e7d4" stroke-width="1"/>`);
    }

    const exportLayer = els.itemsLayer.cloneNode(true);
    exportLayer.querySelectorAll(".selected-outline,.resize-handle,.rotate-handle,.rotate-stem").forEach(node => node.remove());
    exportLayer.querySelectorAll(".is-drop-target").forEach(node => node.classList.remove("is-drop-target"));
    const itemMarkup = new XMLSerializer().serializeToString(exportLayer);

    const seats = getSeats();
    const assigned = seats.filter((seat) => seat.personId).length;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${WORKSPACE.width}" height="${WORKSPACE.height}" viewBox="0 0 ${WORKSPACE.width} ${WORKSPACE.height}">
        <rect width="100%" height="100%" fill="#fffcf5"/>
        <style>text{font-family:"Microsoft YaHei","PingFang SC","Segoe UI",sans-serif}.table-rect{stroke:#b58f58;stroke-width:1.5}.table-label,.shape-label{text-anchor:middle;dominant-baseline:middle;font-weight:500}.seat-name,.seat-empty{text-anchor:middle;font-weight:600}.seat-shell{stroke-width:1.4}.seat-back{opacity:.9}.shape-fill{stroke-width:2}.layout-label{font-weight:600}.label-hitbox{fill:transparent;stroke:none}</style>
        ${lines.join("")}
        <text x="42" y="48" font-size="26" font-weight="800" fill="#24211d" font-family="Arial, Microsoft YaHei, sans-serif">${escapeXml(state.title || "未命名会议室")}</text>
        <text x="42" y="78" font-size="15" font-weight="700" fill="#6e675c" font-family="Arial, Microsoft YaHei, sans-serif">${seats.length} 个座位 · ${assigned} 个已安排 · ${state.people.length} 位人员 / 单位</text>
        ${itemMarkup}
      </svg>
    `;
  }

  function setViewBox() {
    els.stage.setAttribute("viewBox", `${state.view.x} ${state.view.y} ${state.view.w} ${state.view.h}`);
    ui.zoomValue.textContent = `${Math.round(WORKSPACE.width / state.view.w * 100)}%`;
  }

  function fitView(save = true) {
    state.view = { x: 0, y: 0, w: WORKSPACE.width, h: WORKSPACE.height };
    setViewBox();
    if (save) scheduleSave();
  }

  function zoomAtCenter(factor) {
    zoomAtPoint(viewCenter(), factor);
  }

  function zoomAtPoint(point, factor) {
    const oldView = state.view;
    const nextW = clamp(oldView.w * factor, 320, WORKSPACE.width * 2);
    const nextH = nextW * oldView.h / oldView.w;
    const relX = (point.x - oldView.x) / oldView.w;
    const relY = (point.y - oldView.y) / oldView.h;
    state.view = {
      x: point.x - relX * nextW,
      y: point.y - relY * nextH,
      w: nextW,
      h: nextH
    };
    setViewBox();
    scheduleSave();
  }

  function svgPoint(event) {
    const point = els.stage.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(els.stage.getScreenCTM().inverse());
  }

  function viewCenter() {
    return {
      x: state.view.x + state.view.w / 2,
      y: state.view.y + state.view.h / 2
    };
  }

  function saveLocal() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      ui.saveState.textContent = "已自动保存";
      ui.saveState.classList.remove("is-error");
      return true;
    } catch (error) {
      ui.saveState.textContent = "保存失败";
      ui.saveState.classList.add("is-error");
      showToast("浏览器存储不可用或已满，请导出布局文件备份");
      return false;
    }
  }

  function scheduleSave() {
    ui.saveState.textContent = "正在保存…";
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveLocal, 350);
  }

  function loadState() {
    try {
      // Layouts saved under the old name are picked up once and re-saved under the new one.
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return null;
      return SeatMateProject.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function normalizeState() {
    const defaults = createEmptyState();
    state = {
      ...defaults,
      ...state,
      view: { ...defaults.view, ...(state.view || {}) },
      settings: { ...defaults.settings, ...(state.settings || {}) },
      items: Array.isArray(state.items) ? state.items : [],
      people: Array.isArray(state.people) ? state.people : [],
      selectedIds: Array.isArray(state.selectedIds) ? state.selectedIds : (state.selectedId ? [state.selectedId] : [])
    };

    state.items.forEach((item) => {
      item.id = item.id || makeId(item.type || "item");
      item.x = Number(item.x) || 0;
      item.y = Number(item.y) || 0;
      item.w = Number(item.w) || (item.type === "seat" ? 86 : 160);
      item.h = Number(item.h) || (item.type === "seat" ? 48 : 80);
      item.rotation = Number(item.rotation) || 0;
      if (item.type === "label" && !item.boxText) {
        item.x -= 8; item.y -= item.size || 24;
        item.h = Math.max(item.h, (item.size || 24) * 1.3 + 16); item.boxText = true;
      }
      if (!state.themeVersion) {
        const colors = { "#e3ebd8":"#ebce92", "#dbe8e6":"#efd39b", "#e2e9f0":"#e9ce9f", "#e5e9e0":"#e8d3a9", "#9dadc1":"#b69059", "#28766f":"#b58b49" };
        ["fill","stroke"].forEach(prop => { if (colors[item[prop]]) item[prop] = colors[item[prop]]; });
      }
      if (item.type === "table") item.fill = item.fill || "#edcf95";
      if (item.type === "shape") {
        item.kind = item.kind || "rect";
        item.fill = item.fill || "#efd39b";
        item.stroke = item.stroke || "#b58b49";
      }
      if (item.type === "seat") {
        if (item.personId === undefined) item.personId = null;
        item.nameSize = Number(item.nameSize) || 24;
        item.nameColor = item.nameColor || "#211f1b";
      }
    });

    state.people.forEach((person) => {
      person.id = person.id || makeId("person");
      person.name = String(person.name || "未命名");
      person.unit = String(person.unit || "");
      person.kind = person.kind || (SeatMateCore.isOrganization(person.name) ? "organization" : "person");
      person.assignedSeatId = null;
    });

    const peopleById = new Map(state.people.map((person) => [person.id, person]));
    getSeats().forEach((seat) => {
      if (seat.tableId && (!getTables().some(table => table.id === seat.tableId) || !seat.dockSide)) delete seat.tableId;
      if (!seat.personId || !peopleById.has(seat.personId)) {
        seat.personId = null;
        return;
      }
      peopleById.get(seat.personId).assignedSeatId = seat.id;
      if (!seat.textLayoutVersion) { seat.nameSize = Math.max(20, seat.nameSize); ensureSeatTextRoom(seat, peopleById.get(seat.personId).name); seat.textLayoutVersion = 2; }
    });

    state.themeVersion = 2;
    state.selectedIds = unique(state.selectedIds).filter((id) => !!getItem(id));
    state.selectedId = state.selectedIds[0] || null;
  }

  function transformFor(item) {
    const rotation = Number(item.rotation || 0);
    if (!rotation) return `translate(${item.x} ${item.y})`;
    return `translate(${item.x} ${item.y}) rotate(${rotation} ${item.w / 2} ${item.h / 2})`;
  }

  function getItem(id) {
    return state.items.find((item) => item.id === id);
  }

  function getSelectedItem() {
    return getSelectedItems()[0] || null;
  }

  function getSelectedItems() {
    return getSelectedIds().map(getItem).filter(Boolean);
  }

  function getSelectedIds() {
    if (Array.isArray(state.selectedIds) && state.selectedIds.length) {
      return unique(state.selectedIds).filter((id) => !!getItem(id));
    }
    return state.selectedId && getItem(state.selectedId) ? [state.selectedId] : [];
  }

  function setSelection(ids) {
    state.selectedIds = unique(ids).filter((id) => !!getItem(id));
    state.selectedId = state.selectedIds[0] || null;
  }

  function clearSelection() {
    state.selectedIds = [];
    state.selectedId = null;
  }

  function toggleSelection(id) {
    const ids = getSelectedIds();
    if (ids.includes(id)) setSelection(ids.filter((selectedId) => selectedId !== id));
    else setSelection([...ids, id]);
  }

  function toggleSelectionGroup(item) {
    const ids = idsForItemSelection(item);
    const current = getSelectedIds();
    const allSelected = ids.every((id) => current.includes(id));
    if (allSelected) setSelection(current.filter((id) => !ids.includes(id)));
    else setSelection([...current, ...ids]);
  }

  function idsForItemSelection(item) {
    if (!item || !item.groupId) return item ? [item.id] : [];
    return state.items.filter((entry) => entry.groupId === item.groupId).map((entry) => entry.id);
  }

  function isSelected(id) {
    return getSelectedIds().includes(id);
  }

  function getPerson(id) {
    return state.people.find((person) => person.id === id);
  }

  function getSeats() {
    return state.items.filter((item) => item.type === "seat");
  }

  function seatLabel(seatId) {
    const seat = getItem(seatId);
    return seat ? seat.label || "座位" : "座位";
  }

  function nextSeatLabel() {
    const used = new Set(getSeats().map(seat => seat.label));
    let number = 1;
    while (used.has(`S${String(number).padStart(2, "0")}`)) number++;
    return `S${String(number).padStart(2, "0")}`;
  }

  function makeId(prefix) {
    if (window.crypto && window.crypto.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function svgEl(tag, attrs = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      element.setAttribute(key, String(value));
    });
    return element;
  }

  function svgText(text, x, y, attrs = {}) {
    const element = svgEl("text", { x, y, ...attrs });
    element.textContent = text;
    return element;
  }

  function svgTitle(text) {
    const element = svgEl("title");
    element.textContent = text;
    return element;
  }

  function cloneItem(item) {
    return JSON.parse(JSON.stringify(item));
  }

  function normalizedRect(x, y, w, h) {
    return {
      x: w < 0 ? x + w : x,
      y: h < 0 ? y + h : y,
      w: Math.abs(w),
      h: Math.abs(h)
    };
  }

  function drawRectFromPoints(start, point, constrain, kind) {
    let w = point.x - start.x;
    let h = point.y - start.y;
    if (constrain && ["rect", "roundRect", "circle", "triangle"].includes(kind)) {
      const size = Math.max(Math.abs(w), Math.abs(h));
      w = Math.sign(w || 1) * size;
      if (kind === "triangle") {
        h = Math.sign(h || 1) * Math.max(1, Math.round(size * 0.866));
      } else {
        h = Math.sign(h || 1) * size;
      }
    }
    return normalizedRect(start.x, start.y, w, h);
  }

  function distribute(count, start, end) {
    if (count <= 1) return [start];
    const step = (end - start) / (count - 1);
    return Array.from({ length: count }, (_, index) => start + step * index);
  }

  function snap(value) {
    return Math.round(value / 10) * 10;
  }

  function round(value) {
    return Math.round(Number(value) || 0);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeAngle(value) {
    let angle = Number(value) || 0;
    while (angle > 180) angle -= 360;
    while (angle <= -180) angle += 360;
    return Math.round(angle * 10) / 10;
  }

  function unique(values) {
    return Array.from(new Set((values || []).filter(Boolean)));
  }

  function positionSort(a, b) {
    const dy = a.y - b.y;
    if (Math.abs(dy) > 20) return dy;
    return a.x - b.x;
  }

  function typeRank(type) {
    if (type === "table") return 0;
    if (type === "shape") return 1;
    if (type === "seat") return 2;
    if (type === "label") return 3;
    return 3;
  }

  function hasDragType(dataTransfer, type) {
    if (!dataTransfer || !dataTransfer.types) return false;
    return Array.from(dataTransfer.types).includes(type);
  }

  function colorForUnit(unit) {
    const value = String(unit || "未分组");
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return PALETTE[hash % PALETTE.length];
  }

  function shade(hex, amount) {
    const value = hex.replace("#", "");
    const number = Number.parseInt(value.length === 3 ? value.replace(/(.)/g, "$1$1") : value, 16);
    const r = clamp((number >> 16) + amount, 0, 255);
    const g = clamp(((number >> 8) & 255) + amount, 0, 255);
    const b = clamp((number & 255) + amount, 0, 255);
    return `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
  }

  function compact(text, maxLength) {
    const chars = Array.from(String(text || ""));
    if (chars.length <= maxLength) return chars.join("");
    return `${chars.slice(0, Math.max(1, maxLength - 2)).join("")}..`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function escapeXml(value) {
    return escapeHtml(value);
  }

  function downloadBlob(blob, filename) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function timestamp() {
    return new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  }

  function pulseButton(button, text, original) {
    showToast(text);
  }
})();
