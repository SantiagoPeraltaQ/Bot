const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot');
const QRPortalWeb     = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const JsonFileAdapter = require('@bot-whatsapp/database/json');
const path = require('path');
const fs   = require('fs');

/* ====== HELPERS: JID & LOGS (soporta @lid) ====== */
const normalizeJid = (jid) => {
  if (!jid) return null;
  if (jid.endsWith('@c.us')) return jid.replace('@c.us', '@s.whatsapp.net');
  return jid;
};

// Determina el destinatario correcto para cualquier tipo de mensaje.
const getRealJid = (ctx) => {
  try {
    const rjid = ctx?.key?.remoteJid;
    const pjid = ctx?.key?.participant;
    const from = ctx?.from;
    const senderPn      = ctx?.key?.senderPn || ctx?.key?.senderPhoneNumber;
    const participantPn = ctx?.key?.participantPn;

    // Grupo
    if (rjid && rjid.endsWith('@g.us')) return rjid;

    // 1:1 con lid
    if (rjid && rjid.endsWith('@lid')) {
      if (senderPn)      return `${String(senderPn).replace(/\D/g, '')}@s.whatsapp.net`;
      if (participantPn) return `${String(participantPn).replace(/\D/g, '')}@s.whatsapp.net`;
      console.log('ℹ️ LID sin teléfono: respondiendo al @lid directamente', rjid);
      return rjid;
    }

    // 1:1 normal
    const candidates = [rjid, pjid, from];
    for (const c of candidates) {
      const n = normalizeJid(c);
      if (n) return n;
    }
    return null;
  } catch (e) {
    console.log('Error determinando JID:', e);
    return null;
  }
};

// Log útil para depurar
const logIncoming = (ctx, tag = 'MSG') => {
  console.log(`>>> ${tag} <<<`);
  console.log('remoteJid:', ctx?.key?.remoteJid, '| participant:', ctx?.key?.participant, '| from:', ctx?.from);
  if (ctx?.key?.senderPn || ctx?.key?.participantPn) {
    console.log('senderPn:', ctx?.key?.senderPn, '| participantPn:', ctx?.key?.participantPn);
  }
  console.log('body:', ctx?.body);
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

/* ====== Envío directo vía Baileys ====== */
let adapterProvider;
const sendTo = async (jid, text) => {
  const sock = await adapterProvider.getInstance();
  await sock.sendMessage(jid, { text });
};
const sendImage = async (jid, imgPath, caption) => {
  const sock = await adapterProvider.getInstance();
  const buf = fs.readFileSync(imgPath);
  await sock.sendMessage(jid, { image: buf, caption });
};

/* ====== Flujos ====== */
const flujoConsulta = addKeyword(EVENTS.ACTION)
  // Inicio: pregunta por supervisor
  .addAction(async (ctx, tools) => {
    logIncoming(ctx, 'SUP_INIT');
    const jid = getRealJid(ctx); if (!jid) return;
    await sendTo(jid, '¿Qué supervisor deseas buscar?\n\n' + obtenerOpcionesEnumeradas('supervisor', data));
    tools.state.update({ step: 'sup' });
  })
  // Recibe supervisor
  .addAnswer('', { capture: true }, async (ctx, tools) => {
    logIncoming(ctx, 'SUP');
    const jid = getRealJid(ctx); if (!jid) return;
    const seleccionSupervisor = parseInt(String(ctx.body || '').trim(), 10);
    const supervisores = [...new Set(data.map(i => i.supervisor))];
    const supervisor = supervisores[seleccionSupervisor - 1];
    if (!supervisor) { await sendTo(jid, 'Opción no válida. Intenta de nuevo.'); return; }
    const vendedoresFiltrados = data.filter(i => i.supervisor === supervisor);
    await tools.state.update({ supervisor, vendedoresFiltrados });
    await sendTo(jid, '¿Cuál de sus vendedores?\n\n' + obtenerOpcionesEnumeradas('vendedor', vendedoresFiltrados));
  })
  // Recibe vendedor
  .addAnswer('', { capture: true }, async (ctx, tools) => {
    logIncoming(ctx, 'VEND');
    const jid = getRealJid(ctx); if (!jid) return;
    const seleccionVendedor = parseInt(String(ctx.body || '').trim(), 10);
    const vendedoresFiltrados = tools.state.getMyState().vendedoresFiltrados;
    const vendedor = obtenerValorPorOpcion([...new Set(vendedoresFiltrados.map(i => i.vendedor))], seleccionVendedor);
    if (!vendedor) { await sendTo(jid, 'Opción no válida. Intenta de nuevo.'); return; }
    const diasFiltrados = vendedoresFiltrados.filter(i => i.vendedor === vendedor);
    await tools.state.update({ vendedor, diasFiltrados });
    await sendTo(jid, '¿Qué día?\n\n' + obtenerOpcionesEnumeradas('dia', diasFiltrados));
  })
  // Recibe día y muestra resultados
  .addAnswer('', { capture: true }, async (ctx, tools) => {
    logIncoming(ctx, 'DIA');
    const jid = getRealJid(ctx); if (!jid) return;
    const seleccionDia = parseInt(String(ctx.body || '').trim(), 10);
    const diasFiltrados = tools.state.getMyState().diasFiltrados;
    const dia = obtenerValorPorOpcion([...new Set(diasFiltrados.map(i => i.dia))], seleccionDia);
    if (!dia) { await sendTo(jid, 'Opción no válida. Intenta de nuevo.'); return; }
    const { supervisor, vendedor } = tools.state.getMyState();
    const resultados = filtrarPorCriterios(supervisor, vendedor, dia).split('\n');
    if (!resultados || resultados[0] === '') { await sendTo(jid, 'No se encontraron resultados.'); return; }
    const primerosCinco = resultados.slice(0, 5).join('\n');
    await sendTo(jid, `Tienes que visitar estos clientes SÍ o SÍ:\n\n${primerosCinco}`);
    if (resultados.length > 5) {
      await sendTo(jid, `Tené en cuenta que:\n\n${resultados[5]}`);
    }
  });

const constMenu = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, tools) => {
    logIncoming(ctx, 'MENU_INIT');
    const jid = getRealJid(ctx); if (!jid) return;
    await sendTo(jid, Cliente);
  })
  .addAnswer('', { capture: true }, async (ctx, tools) => {
    logIncoming(ctx, 'MENU');
    const jid = getRealJid(ctx); if (!jid) return;
    const numero = String(ctx.body || '').trim();
    if (isNaN(numero)) { await sendTo(jid, 'Respuesta no válida, por favor escriba un número'); return; }
    const lineas = leerLineas(numero);
    if (!lineas.length) { await sendTo(jid, 'Opción no válida.'); return; }
    for (const linea of lineas) {
      await sendTo(jid, `Cliente 👉🏻  ${linea.valor1}`);
      await sendTo(jid, `- ${linea.valor2}`);
      await sendTo(jid, `Ofrece estos descuentos exclusivos 📋👇🏻:\n\n- ${linea.valor3}`);
    }
    await tools.gotoFlow(constPregunta);
  });

const constPregunta = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx) => {
    logIncoming(ctx, 'PREG_INIT');
    const jid = getRealJid(ctx); if (!jid) return;
    await sendTo(jid, '¿Desea buscar otro número? 1 ✅ 2 ❎');
  })
  .addAnswer('', { capture: true }, async (ctx, tools) => {
    logIncoming(ctx, 'PREG');
    const jid = getRealJid(ctx); if (!jid) return;
    const b = String(ctx.body || '').trim();
    if (b === '1') return tools.gotoFlow(constMenu);
    if (b === '2') { await sendTo(jid, 'Saliendo. Muchas gracias por utilizar el BOT 😁'); return; }
    await sendTo(jid, 'Respuesta no válida, por favor seleccione una de las opciones.');
  });

const constAACC = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, tools) => {
    logIncoming(ctx, 'AACC_INIT');
    const jid = getRealJid(ctx); if (!jid) return;
    await sendTo(jid, 'Seleccione una opción:\n\n1. Ver AACC VaFood\n\n2. Ver AACC RN Este\n\n3. Ver AACC RN Oeste\n\n4. Ver AACC Regidor\n\n5. Ver AACC Interior');
  })
  .addAnswer('', { capture: true }, async (ctx, tools) => {
    logIncoming(ctx, 'AACC');
    const jid = getRealJid(ctx); if (!jid) return;
    const b = String(ctx.body || '').trim();
    const base = path.join(__dirname, 'AACC BOT');
    if      (b === '1') await sendImage(jid, path.join(base, 'VF.png'), 'AACC VaFood');
    else if (b === '2') await sendImage(jid, path.join(base, 'RN Con Pena.png'), 'AACC Roca Negra Este');
    else if (b === '3') await sendImage(jid, path.join(base, 'RN.png'), 'AACC Roca Negra Oeste');
    else if (b === '4') await sendImage(jid, path.join(base, 'Regidor.png'), 'AACC Regidor');
    else if (b === '5') await sendImage(jid, path.join(base, 'Interior.png'), 'AACC Interior');
    else await sendTo(jid, 'Respuesta no válida, por favor seleccione una de las opciones.');
  });

const constConsulta = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx) => {
    logIncoming(ctx, 'CONSULTA');
    const jid = getRealJid(ctx); if (!jid) return;
    await sendTo(jid, 'Acá la idea es agregar consultas extra');
  });

const menuFlow = addKeyword(EVENTS.WELCOME)
  .addAction(async (ctx, tools) => {
    logIncoming(ctx, 'WELCOME');
    const jid = getRealJid(ctx); if (!jid) return;
    await sendTo(jid, menu);
    tools.state.update({ step: 'menu' });
  })
  .addAnswer('', { capture: true }, async (ctx, tools) => {
    logIncoming(ctx, 'WELCOME-CHOICE');
    const jid = getRealJid(ctx); if (!jid) return;
    const b = String(ctx.body || '').trim();
    if (b === '1') return tools.gotoFlow(constMenu);
    if (b === '2') return tools.gotoFlow(flujoConsulta);
    if (b === '88') return tools.gotoFlow(constConsulta);
    if (b === '0') { await sendTo(jid, "Saliendo... Puedes volver a acceder escribiendo 'Menu'"); return; }
    await sendTo(jid, 'Respuesta no válida, por favor selecciona una de las opciones.');
  });

/* ====== MAIN ====== */
const main = async () => {
  const adapterDB = new JsonFileAdapter();
  const adapterFlow = createFlow([
    menuFlow, constMenu, constAACC, constConsulta, constPregunta,
    AACCVaFood, AACCRNE, AACCRNO, AACCRegidor, AACCInterior, flujoConsulta,
  ]);
  adapterProvider = createProvider(BaileysProvider);
  createBot({ flow: adapterFlow, provider: adapterProvider, database: adapterDB });
  QRPortalWeb();
  process.on('unhandledRejection', (r) => console.log('unhandledRejection:', r));
  process.on('uncaughtException',  (e) => console.log('uncaughtException:', e));
};
main();
