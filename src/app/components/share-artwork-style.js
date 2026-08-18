export function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.closePath();
}

export function drawLogoMark(ctx, x, y, size, color = "#ffffff") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3.5, size * 0.095);
  ctx.lineCap = "square";
  ctx.lineJoin = "round";
  const cx = x + size * 0.5;
  const top = y + size * 0.08;
  const bottom = y + size * 0.94;
  const left = x + size * 0.12;
  const right = x + size * 0.88;
  const middle = y + size * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx, bottom);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.bezierCurveTo(left + size * 0.12, top, left, y + size * 0.26, left, middle);
  ctx.bezierCurveTo(left, y + size * 0.74, left + size * 0.12, bottom, cx, bottom);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.bezierCurveTo(right - size * 0.12, top, right, y + size * 0.26, right, middle);
  ctx.bezierCurveTo(right, y + size * 0.74, right - size * 0.12, bottom, cx, bottom);
  ctx.stroke();
  ctx.restore();
}

export function drawXMark(ctx, x, y, size, color = "#f5f5f5") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size * 0.08);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + size * 0.12, y + size * 0.12);
  ctx.lineTo(x + size * 0.88, y + size * 0.88);
  ctx.moveTo(x + size * 0.88, y + size * 0.12);
  ctx.lineTo(x + size * 0.12, y + size * 0.88);
  ctx.stroke();
  ctx.restore();
}

export function drawBrandHeader(ctx, { x = 100, y = 100, date = "" } = {}) {
  drawLogoMark(ctx, x, y, 56);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 30px Arial, sans-serif";
  ctx.fillText("OPE CLUB", x + 84, y + 25);
  ctx.fillStyle = "#888888";
  ctx.font = "400 22px Arial, sans-serif";
  ctx.fillText("biblioteca + comunidade", x + 84, y + 57);
  if (date) {
    ctx.fillStyle = "#888888";
    ctx.font = "400 22px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(date, 930, y + 25);
    ctx.textAlign = "start";
  }
}

export function drawDivider(ctx, x, y, width) {
  ctx.save();
  ctx.strokeStyle = "#222225";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
  ctx.restore();
}

export function drawBrandFooter(ctx, { x = 100, y = 1710, width = 780 } = {}) {
  drawDivider(ctx, x, y - 42, width);
  drawLogoMark(ctx, x, y, 36);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 23px Arial, sans-serif";
  ctx.fillText("OPE CLUB", x + 54, y + 26);
  ctx.fillStyle = "#555555";
  ctx.font = "400 21px Arial, sans-serif";
  ctx.fillText("|", x + 185, y + 26);
  ctx.fillStyle = "#888888";
  ctx.font = "400 21px Arial, sans-serif";
  ctx.fillText("Leia, pense, compartilhe.", x + 215, y + 26);
}

export function drawMetricIcon(ctx, type, x, y) {
  const size = 68;
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = "#f5f5f5";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const cx = x + size / 2;
  const cy = y + size / 2;
  if (type === "clock") {
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - 12);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 10, cy + 7);
    ctx.stroke();
  } else if (type === "star") {
    ctx.beginPath();
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI) / 5;
      const radius = index % 2 === 0 ? 22 : 9;
      const pointX = cx + Math.cos(angle) * radius;
      const pointY = cy + Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(pointX, pointY);
      else ctx.lineTo(pointX, pointY);
    }
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.rect(cx - 18, cy - 19, 36, 38);
    ctx.moveTo(cx, cy - 19);
    ctx.lineTo(cx, cy + 19);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPersonIcon(ctx, x, y, color = "#888888") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.arc(x + 10, y + 6, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 10, y + 21, 9, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();
}

export function drawBookmarkIcon(ctx, x, y, color = "#888888") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 2);
  ctx.lineTo(x + 16, y + 2);
  ctx.lineTo(x + 16, y + 22);
  ctx.lineTo(x + 10, y + 16);
  ctx.lineTo(x + 4, y + 22);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

export function drawQuoteIcon(ctx, x, y, color = "#888888") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 6);
  ctx.lineTo(x + 9, y + 6);
  ctx.lineTo(x + 6, y + 16);
  ctx.moveTo(x + 12, y + 6);
  ctx.lineTo(x + 17, y + 6);
  ctx.lineTo(x + 14, y + 16);
  ctx.stroke();
  ctx.restore();
}
