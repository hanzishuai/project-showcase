(function () {
  "use strict";
  const script = document.getElementById("projects");
  if (!script) { return; }
  let data;
  try { data = JSON.parse(script.textContent || ""); } catch (error) { return; }
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const byId = new Map(projects.map((project) => [project.id, project]));
  const cells = document.querySelectorAll(".cell-progress[data-project-id]");
  cells.forEach((cell) => {
    const id = cell.getAttribute("data-project-id");
    const project = byId.get(id);
    if (!project) { return; }
    const row = cell.closest("tr");
    const statusCell = row ? row.querySelector(".cell-status") : null;
    const updatedCell = row ? row.querySelector(".cell-updated") : null;
    const value = cell.querySelector(".progress-empty");
    const track = cell.querySelector(".progress-track");
    const fill = cell.querySelector(".progress-fill");
    const progress = project.progress;
    if (progress === 0) {
      if (value) { value.className = "progress-value"; value.textContent = "0%"; }
      if (track) { track.setAttribute("aria-hidden", "false"); }
      if (fill) { fill.hidden = false; fill.style.width = "0%"; }
      cell.setAttribute("aria-label", "进度 0%");
    } else if (progress == null) {
      /* 缺失值由 CSS ::after 显示为 — */
      if (value) { value.className = "progress-empty"; value.textContent = ""; }
      if (track) { track.setAttribute("aria-hidden", "true"); }
      if (fill) { fill.hidden = true; fill.style.width = ""; }
      cell.setAttribute("aria-label", "进度未提供，显示 —");
    } else {
      const n = Math.max(0, Math.min(100, Number(progress)));
      if (!Number.isFinite(n)) { return; }
      if (value) { value.className = "progress-value"; value.textContent = n + "%"; }
      if (track) { track.setAttribute("aria-hidden", "false"); }
      if (fill) { fill.hidden = false; fill.style.width = n + "%"; }
      cell.setAttribute("aria-label", "进度 " + n + "%");
    }
    if (statusCell) {
      if (project.status == null) {
        statusCell.textContent = "—";
        statusCell.setAttribute("aria-label", "状态未提供");
      } else {
        statusCell.textContent = String(project.status);
        statusCell.setAttribute("aria-label", "状态 " + String(project.status));
      }
    }
    if (updatedCell) {
      if (project.updatedAt == null) {
        updatedCell.textContent = "—";
        updatedCell.setAttribute("aria-label", "更新时间未提供");
      } else {
        updatedCell.textContent = String(project.updatedAt);
        updatedCell.setAttribute("aria-label", "更新时间 " + String(project.updatedAt));
      }
    }
  });
})();
