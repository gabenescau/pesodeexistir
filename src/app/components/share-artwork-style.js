export function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.closePath();
}

export function drawLogoMark(ctx, x, y, size, color = "#f5f5f5") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(4, size * 0.08);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(x + size * 0.5, y + size * 0.5, size * 0.34, size * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + size * 0.5, y + size * 0.06);
  ctx.lineTo(x + size * 0.5, y + size * 0.94);
  ctx.stroke();
  ctx.restore();
}

export function drawBrandHeader(ctx, { x = 100, y = 100, date = "" } = {}) {
  drawLogoMark(ctx, x, y, 58);
  ctx.fillStyle = "#f5f5f5";
  ctx.font = "700 30px Arial, sans-serif";
  ctx.fillText("OPE CLUB", x + 86, y + 25);
  ctx.fillStyle = "#a4a4a4";
  ctx.font = "400 22px Arial, sans-serif";
  ctx.fillText("biblioteca + comunidade", x + 86, y + 58);
  if (date) {
    ctx.fillStyle = "#a4a4a4";
    ctx.font = "400 22px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(date, 980, y + 25);
    ctx.textAlign = "start";
  }
}

export function drawDivider(ctx, x, y, width) {
  ctx.save();
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
  ctx.restore();
}

export function drawBrandFooter(ctx, { x = 100, y = 1710 } = {}) {
  drawDivider(ctx, x, y - 42, 880);
  drawLogoMark(ctx, x, y, 40);
  ctx.fillStyle = "#f5f5f5";
  ctx.font = "700 23px Arial, sans-serif";
  ctx.fillText("OPE CLUB", x + 62, y + 27);
  ctx.fillStyle = "#777777";
  ctx.font = "400 21px Arial, sans-serif";
  ctx.fillText("|", x + 195, y + 27);
  ctx.fillStyle = "#a4a4a4";
  ctx.font = "400 21px Arial, sans-serif";
  ctx.fillText("Leia, pense, compartilhe.", x + 225, y + 27);
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

