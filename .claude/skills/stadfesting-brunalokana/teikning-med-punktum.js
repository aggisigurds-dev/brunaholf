// Keyra í eyðublaðssíðunni (javascript_tool) — býr til mynd af grunnmynd með grænum, númeruðum Ajour-punktum
// og geymir hana í skjalinu (values.teikning). Þarf: grunnmyndina aðgengilega yfir http með CORS (lítill node-þjónn á 8799),
// punkta úr skraningar.json (registrationCoordinates: x,y eru í pixlum grunnmyndarinnar) og útklipp [X0,Y0,X1,Y1].
// Sunnukriki 3: crop 12,430,1710,1950 (hæðin í heild eins og Ajour „Sýna hnit").
async function teiknaPunkta(imgUrl, PINS /* [[nr,x,y],…] */, [X0, Y0, X1, Y1]) {
  const img = await createImageBitmap(await (await fetch(imgUrl)).blob());
  const k = 1600 / (X1 - X0), W = Math.round((X1 - X0) * k), H = Math.round((Y1 - Y0) * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, X0, Y0, X1 - X0, Y1 - Y0, 0, 0, W, H);
  const P = PINS.map(([n, x, y]) => ({ n, px: (x - X0) * k, py: (y - Y0) * k }));
  const klasar = []; P.forEach((p) => { const kl = klasar.find((c2) => c2.some((q) => Math.hypot(q.px - p.px, q.py - p.py) < 26)); if (kl) kl.push(p); else klasar.push([p]); });
  const labels = []; klasar.forEach((kl) => { kl.sort((a, b) => a.px - b.px || a.py - b.py);
    const cx = kl.reduce((s, p) => s + p.px, 0) / kl.length, cy = kl.reduce((s, p) => s + p.py, 0) / kl.length;
    const ly = cy < H * 0.45 ? cy - 62 : cy + 78;                     // númer fá eigin pláss með leiðarlínu svo þau skarist ekki
    kl.forEach((p, i) => labels.push({ p, lx: cx + (i - (kl.length - 1) / 2) * 40, ly })); });
  g.strokeStyle = '#222'; g.lineWidth = 2;
  labels.forEach(({ p, lx, ly }) => { g.beginPath(); g.moveTo(p.px, p.py); g.lineTo(lx, ly + (ly < p.py ? 8 : -26)); g.stroke(); });
  P.forEach((p) => { g.beginPath(); g.arc(p.px, p.py, 10, 0, 7); g.fillStyle = '#28c828'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); });
  g.font = 'bold 32px Arial'; g.textAlign = 'center'; g.lineJoin = 'round';
  labels.forEach(({ p, lx, ly }) => { g.lineWidth = 7; g.strokeStyle = '#fff'; g.strokeText(String(p.n), lx, ly); g.fillStyle = '#000'; g.fillText(String(p.n), lx, ly); });
  return c.toDataURL('image/jpeg', 0.86);
}
// Notkun: values.teikning = await teiknaPunkta(...); values.teikningTexti = '…'; renderDoc(); const doc = await buildPdf();
// → POST {action:'save', skjal_id, gogn: values, contentBase64} á /api/eydublod (ný útgáfa).
