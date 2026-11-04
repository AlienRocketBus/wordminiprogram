/* shift one phone's wall clock (Date.now / new Date()) by OFF ms, like a phone with automatic time switched off */
export async function skewPhone(ph, OFF) {
  await ph.ctx.addInitScript((OFF) => {
    const RD = Date, rnow = RD.now.bind(RD);
    function SD() {
      if (!new.target) return new RD(rnow() + OFF).toString();
      return arguments.length === 0 ? Reflect.construct(RD, [rnow() + OFF], new.target) : Reflect.construct(RD, arguments, new.target);
    }
    SD.prototype = RD.prototype;
    SD.now = () => rnow() + OFF; SD.parse = RD.parse; SD.UTC = RD.UTC;
    Object.defineProperty(SD.prototype, 'constructor', { value: SD, writable: true, configurable: true });
    window.Date = SD;
  }, OFF);
  await ph.page.reload({ waitUntil: 'domcontentloaded' });
  await ph.page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoom && window.HansenPkRoomUI && window.HansenLadderUI && window.HansenSbProfile && window.HANSEN_VOCAB_ALL), null, { timeout: 45000 });
  await new Promise((r) => setTimeout(r, 600));
  const d = await ph.eval(() => [Date.now(), new Date().getTime(), new Date(5).getTime(), (new Date()) instanceof Date]);
  return { offsetMs: d[0] - Date.now(), newDateOffset: d[1] - Date.now(), explicitOk: d[2] === 5, instanceofOk: d[3] };
}
