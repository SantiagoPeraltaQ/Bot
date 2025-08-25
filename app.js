const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot')
const QRPortalWeb     = require('@bot-whatsapp/portal')
const BaileysProvider = require('@bot-whatsapp/provider/baileys')
const JsonFileAdapter = require('@bot-whatsapp/database/json')
const path = require('path')
const fs   = require('fs')

/* ========== HELPERS: JID & LOGS (soporta @lid) ========== */
const normalizeJid = (jid) => {
  if (!jid) return null
  if (jid.endsWith('@c.us')) return jid.replace('@c.us', '@s.whatsapp.net')
  return jid
}

/**
 * Obtiene SIEMPRE un destinatario seguro.
 * - Grupos: devuelve @g.us
 * - 1:1 con @lid: intenta usar key.senderPn / key.participantPn (soportado en alphas recientes);
 *   si no están, responde al propio @lid (no inventa números).
 * - 1:1 normal: usa remoteJid / participant / from (en ese orden), normalizando.
 */
const getRealJid = (ctx) => {
  try {
    const rjid = ctx?.key?.remoteJid
    const pjid = ctx?.key?.participant
    const from = ctx?.from
    const senderPn       = ctx?.key?.senderPn || ctx?.key?.senderPhoneNumber // por si el provider los mapea distinto
    const participantPn  = ctx?.key?.participantPn

    // Grupo
    if (rjid && rjid.endsWith('@g.us')) return rjid

    // 1:1 con LID
    if (rjid && rjid.endsWith('@lid')) {
      if (senderPn)      return `${String(senderPn).replace(/\D/g,'')}@s.whatsapp.net`
      if (participantPn) return `${String(participantPn).replace(/\D/g,'')}@s.whatsapp.net`
      // sin número real disponible: responder al LID (válido) y loguear
      console.log('ℹ️ LID sin phone: respondiendo al @lid directamente:', rjid)
      return rjid
    }

    // 1:1 normal
    const candidates = [rjid, pjid, from]
    for (const c of candidates) {
      const n = normalizeJid(c)
      if (n) return n
    }
    return null
  } catch (e) {
    console.log('getRealJid error:', e)
    return null
  }
}

const logIncoming = (ctx, tag = 'MSG') => {
  try {
    console.log(`>>> ${tag} <<<`)
    console.log('remoteJid:', ctx?.key?.remoteJid, '| participant:', ctx?.key?.participant, '| from:', ctx?.from)
    if (ctx?.key?.senderPn || ctx?.key?.participantPn) {
      console.log('senderPn:', ctx?.key?.senderPn, '| participantPn:', ctx?.key?.participantPn)
    }
    console.log('body:', ctx?.body)
  } catch {}
}

/* ========== MENSAJES / ARCHIVOS ========== */
const menuPath = path.join(__dirname, 'mensajes', 'Menu.txt')
const menu = fs.readFileSync(menuPath, 'utf8')

const ClientePath = path.join(__dirname, 'mensajes', 'Cliente.txt')
const Cliente = fs.readFileSync(ClientePath, 'utf8')

const CBPath = path.join(__dirname, 'mensajes', 'CB.txt')
const CB = fs.readFileSync(CBPath, 'utf8')

const CBAACC = path.join(__dirname, 'mensajes', 'AACC.txt')
const AACC = fs.readFileSync(CBAACC, 'utf8')

const csvPath  = path.join(__dirname, 'mensajes', 'CSV.csv')
const csvContent = fs.readFileSync(csvPath, 'utf8')

const csvPath2  = path.join(__dirname, 'mensajes', 'CSV3.csv')
const csvContent2 = fs.readFileSync(csvPath2, 'utf8')

/* ========== CSV UTILS ========== */
const cargarDatosCSV = () => {
  const lineas = csvContent2.split('\n')
  const data = []
  lineas.forEach((linea, index) => {
    const [codigo, dia, supervisor, , , razonSocial, vendedor] = linea.split(';')
    if (index > 0 && codigo && supervisor && vendedor && dia && razonSocial) {
      data.push({
        codigo: codigo.trim(),
        dia: dia.trim(),
        supervisor: supervisor.trim(),
        vendedor: vendedor.trim(),
        razonSocial: razonSocial.trim(),
      })
    }
  })
  return data
}
const data = cargarDatosCSV()

const obtenerOpcionesEnumeradas = (campo, listaFiltrada) => {
  const opcionesUnicas = [...new Set(listaFiltrada.map(i => i[campo]))]
  return opcionesUnicas.map((op, idx) => `${idx + 1} - ${op}`).join('\n')
}
const obtenerValorPorOpcion = (listaFiltrada, numero) => listaFiltrada[numero - 1]
const filtrarPorCriterios = (supervisor, vendedor, dia) =>
  data
    .filter(i => i.supervisor === supervisor && i.vendedor === vendedor && i.dia === dia)
    .map(i => `${i.codigo} - ${i.razonSocial}`)
    .join('\n')

const leerLineas = (num) => {
  const lineas = csvContent.split('\n')
  const coincidencias = lineas.filter(l => l.startsWith(num + ';'))
  return coincidencias.map((linea) => {
    const valores = linea.split(';')
    const val = (s) => s.split(',').filter(v => /\w/.test(v)).join('\n \n- ')
    return { valor1: val(valores[1]), valor2: val(valores[2]), valor3: val(valores[3]) }
  })
}

/* ========== FLOWS ========== */
const flujoConsulta = addKeyword(EVENTS.ACTION)
  .addAnswer(
    '¿Qué supervisor deseas buscar?\n\n' + obtenerOpcionesEnumeradas('supervisor', data),
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      logIncoming(ctx, 'SUP')
      const jid = getRealJid(ctx); if (!jid) return console.log('⚠️ sin JID (SUP)')
      const seleccionSupervisor = parseInt(String(ctx.body || '').trim(), 10)
      const supervisores = [...new Set(data.map(i => i.supervisor))]
      const supervisor = supervisores[seleccionSupervisor - 1]
      if (!supervisor) return flowDynamic('Opción no válida. Por favor selecciona una opción correcta.', { from: jid })

      const vendedoresFiltrados = data.filter(i => i.supervisor === supervisor)
      await state.update({ supervisor, vendedoresFiltrados })
      return flowDynamic('¿Cuál de sus vendedores?\n\n' + obtenerOpcionesEnumeradas('vendedor', vendedoresFiltrados), { capture: true, from: jid })
    }
  )
  .addAnswer(
    '-----------------------------------------',
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      logIncoming(ctx, 'VEND')
      const jid = getRealJid(ctx); if (!jid) return console.log('⚠️ sin JID (VEND)')
      const seleccionVendedor = parseInt(String(ctx.body || '').trim(), 10)
      const vendedoresFiltrados = state.getMyState().vendedoresFiltrados
      const vendedor = obtenerValorPorOpcion([...new Set(vendedoresFiltrados.map(i => i.vendedor))], seleccionVendedor)
      if (!vendedor) return flowDynamic('Opción no válida. Por favor selecciona una opción correcta.', { from: jid })

      const diasFiltrados = vendedoresFiltrados.filter(i => i.vendedor === vendedor)
      await state.update({ vendedor, diasFiltrados })
      return flowDynamic('¿Qué día?\n\n' + obtenerOpcionesEnumeradas('dia', diasFiltrados), { capture: true, from: jid })
    }
  )
  .addAnswer(
    '------------------',
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      logIncoming(ctx, 'DIA')
      const jid = getRealJid(ctx); if (!jid) return console.log('⚠️ sin JID (DIA)')
      const seleccionDia = parseInt(String(ctx.body || '').trim(), 10)
      const diasFiltrados = state.getMyState().diasFiltrados
      const dia = obtenerValorPorOpcion([...new Set(diasFiltrados.map(i => i.dia))], seleccionDia)
      if (!dia) return flowDynamic('Opción no válida. Por favor selecciona una opción correcta.', { from: jid })

      const { supervisor, vendedor } = state.getMyState()
      const resultados = filtrarPorCriterios(supervisor, vendedor, dia).split('\n')
      if (!resultados || resultados[0] === '') return flowDynamic('No se encontraron resultados.', { from: jid })

      const primerosCinco = resultados.slice(0, 5).join('\n')
      await flowDynamic(`Tienes que visitar estos clientes SÍ o SÍ:\n\n${primerosCinco}`, { from: jid })
      if (resultados.length > 5) {
        await flowDynamic(`Tené en cuenta que:\n\n${resultados[5]}`, { from: jid })
      }
    }
  )

const constMenu = addKeyword(EVENTS.ACTION).addAnswer(
  Cliente,
  { capture: true },
  async (ctx, { fallBack, flowDynamic, gotoFlow }) => {
    logIncoming(ctx, 'MENU')
    const jid = getRealJid(ctx); if (!jid) return console.log('⚠️ sin JID (MENU)')
    const numero = String(ctx.body || '').trim()
    if (isNaN(numero)) return fallBack('Respuesta no válida, por favor escriba un número')

    const lineas = leerLineas(numero)
    if (!lineas.length) return fallBack('Opción no válida.')

    for (const linea of lineas) {
      await flowDynamic(`Cliente 👉🏻  ${linea.valor1}`, { from: jid })
      await flowDynamic(`- ${linea.valor2}`, { from: jid })
      await flowDynamic(`Ofrece estos descuentos exclusivos 📋👇🏻:\n\n- ${linea.valor3}`, { from: jid })
    }
    return gotoFlow(constPregunta)
  }
)

const constPregunta = addKeyword(EVENTS.ACTION).addAnswer(
  '¿Desea buscar otro número? 1 ✅ 2 ❎',
  { capture: true },
  async (ctx, { fallBack, flowDynamic, gotoFlow }) => {
    logIncoming(ctx, 'PREG')
    const jid = getRealJid(ctx); if (!jid) return console.log('⚠️ sin JID (PREG)')
    const b = String(ctx.body || '').trim()
    if (b === '1') return gotoFlow(constMenu)
    if (b === '2') return flowDynamic('Saliendo. Muchas gracias por utilizar el BOT 😁', { from: jid })
    return fallBack('Respuesta no válida, por favor seleccione una de las opciones.')
  }
)

const constAACC = addKeyword(EVENTS.ACTION).addAnswer(
  'Seleccione una opción:\n\n1. Ver AACC VaFood\n\n2. Ver AACC RN Este\n\n3. Ver AACC RN Oeste\n\n4. Ver AACC Regidor\n\n5. Ver AACC Interior',
  { capture: true },
  async (ctx, { fallBack, gotoFlow }) => {
    logIncoming(ctx, 'AACC')
    const b = String(ctx.body || '').trim()
    if (!['1', '2', '3', '4', '5'].includes(b)) return fallBack('Respuesta no válida, por favor seleccione una de las opciones.')
    switch (b) {
      case '1': return gotoFlow(AACCVaFood)
      case '2': return gotoFlow(AACCRNE)
      case '3': return gotoFlow(AACCRNO)
      case '4': return gotoFlow(AACCRegidor)
      case '5': return gotoFlow(AACCInterior)
    }
  }
)

const AACCVaFood   = addKeyword(EVENTS.ACTION).addAnswer('AACC VaFood',           { media: path.join(__dirname, 'AACC BOT', 'VF.png') })
const AACCRNE      = addKeyword(EVENTS.ACTION).addAnswer('AACC Roca Negra Este',  { media: path.join(__dirname, 'AACC BOT', 'RN Con Pena.png') })
const AACCRNO      = addKeyword(EVENTS.ACTION).addAnswer('AACC Roca Negra Oeste', { media: path.join(__dirname, 'AACC BOT', 'RN.png') })
const AACCRegidor  = addKeyword(EVENTS.ACTION).addAnswer('AACC Regidor',          { media: path.join(__dirname, 'AACC BOT', 'Regidor.png') })
const AACCInterior = addKeyword(EVENTS.ACTION).addAnswer('AACC Interior',         { media: path.join(__dirname, 'AACC BOT', 'Interior.png') })

const constConsulta = addKeyword(EVENTS.ACTION).addAnswer('Aca la idea es agregar consultas extra')

const menuFlow = addKeyword(EVENTS.WELCOME).addAnswer(
  menu,
  { capture: true },
  async (ctx, { gotoFlow, fallBack, flowDynamic }) => {
    logIncoming(ctx, 'WELCOME')
    const jid = getRealJid(ctx); if (!jid) return console.log('⚠️ sin JID (WELCOME)')
    const b = String(ctx.body || '').trim()
    if (!['1', '2', '88', '0'].includes(b)) return fallBack('Respuesta no válida, por favor selecciona una de las opciones.')
    switch (b) {
      case '1': return gotoFlow(constMenu)
      case '2': return gotoFlow(flujoConsulta)
      case '88': return gotoFlow(constConsulta)
      case '0':  return flowDynamic("Saliendo... Puedes volver a acceder escribiendo 'Menu'", { from: jid })
    }
  }
)

/* ========== MAIN ========== */
const main = async () => {
  const adapterDB   = new JsonFileAdapter()
  const adapterFlow = createFlow([
    menuFlow, constMenu, constAACC, constConsulta, constPregunta,
    AACCVaFood, AACCRNE, AACCRNO, AACCRegidor, AACCInterior, flujoConsulta,
  ])
  const adapterProvider = createProvider(BaileysProvider)

  createBot({ flow: adapterFlow, provider: adapterProvider, database: adapterDB })
  QRPortalWeb()

  process.on('unhandledRejection', (r) => console.log('unhandledRejection:', r))
  process.on('uncaughtException',  (e) => console.log('uncaughtException:', e))
}
main()
