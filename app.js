const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot');
const QRPortalWeb     = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const JsonFileAdapter = require('@bot-whatsapp/database/json');
const path = require('path');
const fs   = require('fs');

/* ====== Helpers para obtener el JID correcto ====== */
const normalizeJid = (jid) => {
  if (!jid) return null;
  if (jid.endsWith('@c.us')) return jid.replace('@c.us', '@s.whatsapp.net');
  return jid;
};

const getRealJid = (ctx) => {
  const rjid = ctx?.key?.remoteJid;
  const pjid = ctx?.key?.participant;
  const from = ctx?.from;
  const senderPn      = ctx?.key?.senderPn || ctx?.key?.senderPhoneNumber;
  const participantPn = ctx?.key?.participantPn;

  // Grupos
  if (rjid && rjid.endsWith('@g.us')) return rjid;

  // Mensajes con @lid → corregimos usando senderPn
  if (rjid && rjid.endsWith('@lid')) {
    if (senderPn)      return `${String(senderPn).replace(/\D/g, '')}@s.whatsapp.net`;
    if (participantPn) return `${String(participantPn).replace(/\D/g, '')}@s.whatsapp.net`;
    return rjid;
  }

  const candidates = [rjid, pjid, from];
  for (const c of candidates) {
    const n = normalizeJid(c);
    if (n) return n;
  }
  return null;
};

/* ====== Carga de textos ====== */
const menu       = fs.readFileSync(path.join(__dirname, 'mensajes', 'Menu.txt'), 'utf8');
const Cliente    = fs.readFileSync(path.join(__dirname, 'mensajes', 'Cliente.txt'), 'utf8');
const csvContent = fs.readFileSync(path.join(__dirname, 'mensajes', 'CSV.csv'), 'utf8');
const csvContent2= fs.readFileSync(path.join(__dirname, 'mensajes', 'CSV3.csv'), 'utf8');

/* ====== Utilidades CSV ====== */
const cargarDatosCSV = () => {
  const lineas = csvContent2.split('\n');
  const data = [];
  lineas.forEach((linea, index) => {
    const [codigo, dia, supervisor, , , razonSocial, vendedor] = linea.split(';');
    if (index > 0 && codigo && supervisor && vendedor && dia && razonSocial) {
      data.push({
        codigo: codigo.trim(),
        dia: dia.trim(),
        supervisor: supervisor.trim(),
        vendedor: vendedor.trim(),
        razonSocial: razonSocial.trim(),
      });
    }
  });
  return data;
};
const data = cargarDatosCSV();

const obtenerOpcionesEnumeradas = (campo, lista) => {
  const unicas = [...new Set(lista.map(item => item[campo]))];
  return unicas.map((op, idx) => `${idx + 1} - ${op}`).join('\n');
};
const obtenerValorPorOpcion = (lista, numero) => lista[numero - 1];
const filtrarPorCriterios = (supervisor, vendedor, dia) =>
  data.filter(i => i.supervisor === supervisor && i.vendedor === vendedor && i.dia === dia)
      .map(i => `${i.codigo} - ${i.razonSocial}`)
      .join('\n');

const leerLineas = (num) => {
  const lineas = csvContent.split('\n');
  const coincidencias = lineas.filter(l => l.startsWith(num + ';'));
  return coincidencias.map((linea) => {
    const valores = linea.split(';');
    const val = (s) => s.split(',').filter(v => /\w/.test(v)).join('\n \n- ');
    return { valor1: val(valores[1]), valor2: val(valores[2]), valor3: val(valores[3]) };
  });
};

/* ====== Flujos ====== */
const flujoConsulta = addKeyword(EVENTS.ACTION)
  .addAnswer('¿Qué supervisor deseas buscar?\n\n' + obtenerOpcionesEnumeradas('supervisor', data),
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      const jid = getRealJid(ctx);
      const seleccionSupervisor = parseInt(ctx.body.trim(), 10);
      const supervisores = [...new Set(data.map(i => i.supervisor))];
      const supervisor = supervisores[seleccionSupervisor - 1];
      if (!supervisor) {
        await flowDynamic('Opción no válida. Intenta de nuevo.', { from: jid });
        return;
      }
      const vendedoresFiltrados = data.filter(i => i.supervisor === supervisor);
      await state.update({ supervisor, vendedoresFiltrados });
      await flowDynamic('¿Cuál de sus vendedores?\n\n' + obtenerOpcionesEnumeradas('vendedor', vendedoresFiltrados), { capture: true, from: jid });
    })
  .addAnswer('-----------------------------------------',
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      const jid = getRealJid(ctx);
      const seleccionVendedor = parseInt(ctx.body.trim(), 10);
      const vendedoresFiltrados = state.getMyState().vendedoresFiltrados;
      const vendedor = obtenerValorPorOpcion([...new Set(vendedoresFiltrados.map(i => i.vendedor))], seleccionVendedor);
      if (!vendedor) {
        await flowDynamic('Opción no válida. Intenta de nuevo.', { from: jid });
        return;
      }
      const diasFiltrados = vendedoresFiltrados.filter(i => i.vendedor === vendedor);
      await state.update({ vendedor, diasFiltrados });
      await flowDynamic('¿Qué día?\n\n' + obtenerOpcionesEnumeradas('dia', diasFiltrados), { capture: true, from: jid });
    })
  .addAnswer('------------------',
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      const jid = getRealJid(ctx);
      const seleccionDia = parseInt(ctx.body.trim(), 10);
      const diasFiltrados = state.getMyState().diasFiltrados;
      const dia = obtenerValorPorOpcion([...new Set(diasFiltrados.map(i => i.dia))], seleccionDia);
      if (!dia) {
        await flowDynamic('Opción no válida. Intenta de nuevo.', { from: jid });
        return;
      }
      const { supervisor, vendedor } = state.getMyState();
      const resultados = filtrarPorCriterios(supervisor, vendedor, dia).split('\n');
      if (resultados.length === 0) {
        await flowDynamic('No se encontraron resultados.', { from: jid });
        return;
      }
      const primerosCinco = resultados.slice(0, 5).join('\n');
      await flowDynamic(`Tienes que visitar estos clientes SÍ o SÍ:\n\n${primerosCinco}`, { from: jid });
      if (resultados.length > 5) {
        await flowDynamic(`Tené en cuenta que:\n\n${resultados[5]}`, { from: jid });
      }
    });

const constMenu = addKeyword(EVENTS.ACTION)
  .addAnswer(Cliente,
    { capture: true },
    async (ctx, { flowDynamic, gotoFlow, fallBack }) => {
      const jid = getRealJid(ctx);
      const numero = ctx.body.trim();
      if (isNaN(numero)) {
        return fallBack('Respuesta no válida, por favor escriba un número');
      }
      const lineas = leerLineas(numero);
      if (lineas.length === 0) {
        return fallBack('Opción no válida.');
      }
      for (const linea of lineas) {
        await flowDynamic(`Cliente 👉🏻  ${linea.valor1}`, { from: jid });
        await flowDynamic(`- ${linea.valor2}`, { from: jid });
        await flowDynamic(`Ofrece estos descuentos exclusivos 📋👇🏻:\n\n- ${linea.valor3}`, { from: jid });
      }
      return gotoFlow(constPregunta);
    });

const constPregunta = addKeyword(EVENTS.ACTION)
  .addAnswer('¿Desea buscar otro número? 1 ✅ 2 ❎',
    { capture: true },
    async (ctx, { gotoFlow, flowDynamic, fallBack }) => {
      const jid = getRealJid(ctx);
      const b = ctx.body.trim();
      if (b === '1') {
        return gotoFlow(constMenu);
      } else if (b === '2') {
        return flowDynamic('Saliendo. Muchas gracias por utilizar el BOT 😁', { from: jid });
      } else {
        return fallBack('Respuesta no válida, por favor seleccione una de las opciones.');
      }
    });

const constAACC = addKeyword(EVENTS.ACTION)
  .addAnswer('Seleccione una opción:\n\n1. Ver AACC VaFood\n\n2. Ver AACC RN Este\n\n3. Ver AACC RN Oeste\n\n4. Ver AACC Regidor\n\n5. Ver AACC Interior',
    { capture: true },
    async (ctx, { flowDynamic, fallBack }) => {
      const jid = getRealJid(ctx);
      const choice = ctx.body.trim();
      const base = path.join(__dirname, 'AACC BOT');
      if      (choice === '1') await flowDynamic([{ body: 'AACC VaFood',           media: path.join(base,'VF.png')        }], { from: jid });
      else if (choice === '2') await flowDynamic([{ body: 'AACC Roca Negra Este',  media: path.join(base,'RN Con Pena.png') }], { from: jid });
      else if (choice === '3') await flowDynamic([{ body: 'AACC Roca Negra Oeste', media: path.join(base,'RN.png')         }], { from: jid });
      else if (choice === '4') await flowDynamic([{ body: 'AACC Regidor',          media: path.join(base,'Regidor.png')    }], { from: jid });
      else if (choice === '5') await flowDynamic([{ body: 'AACC Interior',         media: path.join(base,'Interior.png')   }], { from: jid });
      else return fallBack('Respuesta no válida, por favor seleccione una de las opciones.');
    });

const constConsulta = addKeyword(EVENTS.ACTION)
  .addAnswer('Acá la idea es agregar consultas extra');

const menuFlow = addKeyword(EVENTS.WELCOME)
  .addAnswer(menu,
    { capture: true },
    async (ctx, { gotoFlow, flowDynamic, fallBack }) => {
      const jid = getRealJid(ctx);
      const b = ctx.body.trim();
      if (b === '1') return gotoFlow(constMenu);
      if (b === '2') return gotoFlow(flujoConsulta);
      if (b === '88') return gotoFlow(constConsulta);
      if (b === '0')  return flowDynamic("Saliendo... Puedes volver a acceder escribiendo 'Menu'", { from: jid });
      return fallBack('Respuesta no válida, por favor selecciona una de las opciones.');
    });

/* ====== MAIN ====== */
const main = async () => {
  const adapterDB   = new JsonFileAdapter();
  const adapterFlow = createFlow([
    menuFlow, constMenu, constAACC, constConsulta, constPregunta, flujoConsulta,
  ]);
  const adapterProvider = createProvider(BaileysProvider);

  // Workaround para mensajes con @lid
  adapterProvider.init = ((originalInit) => async function(...args) {
    const sock = await originalInit.apply(this, args);

    sock.ev.on("messages.upsert", async (m) => {
      if (m.messages && m.messages[0] && /@lid/.test(m.messages[0].key.remoteJid)) {
        if (m.messages[0].key.senderPn) {
          m.messages[0].key.remoteJid = m.messages[0].key.senderPn;
          console.log("🔧 Corregido remoteJid:", m.messages[0].key.remoteJid);
        }
      }
    });

    return sock;
  })(adapterProvider.init);

  createBot({ flow: adapterFlow, provider: adapterProvider, database: adapterDB });
  QRPortalWeb();
};
main();
