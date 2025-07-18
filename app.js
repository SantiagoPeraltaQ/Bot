const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot')



const QRPortalWeb = require('@bot-whatsapp/portal')
const BaileysProvider = require('@bot-whatsapp/provider/baileys')
const MockAdapter = require('@bot-whatsapp/database/mock')
const path = require("path")
const fs = require("fs")

const menuPath = path.join(__dirname, "mensajes", "Menu.txt")
const menu = fs.readFileSync(menuPath, "utf8")

const ClientePath = path.join(__dirname, "mensajes", "Cliente.txt")
const Cliente = fs.readFileSync(ClientePath, "utf8")

const CBPath = path.join(__dirname, "mensajes", "CB.txt");
const CB = fs.readFileSync(CBPath, "utf8");

const CBAACC = path.join(__dirname, "mensajes", "AACC.txt");
const AACC = fs.readFileSync(CBAACC, "utf8");

const csvPath = path.join(__dirname, "mensajes", "CSV.csv");
const csvContent = fs.readFileSync(csvPath, 'utf8');

const csvPath2 = path.join(__dirname, "mensajes", "CSV3.csv");
const csvContent2 = fs.readFileSync(csvPath2, 'utf8');

// Procesar el CSV y cargar los datos en una lista
const cargarDatosCSV = () => {
    const lineas = csvContent2.split('\n');
    const data = [];

    lineas.forEach((linea, index) => {
        const [codigo, dia, supervisor, , , razonSocial, vendedor] = linea.split(';');
        if (index > 0 && codigo && supervisor && vendedor && dia && razonSocial) { // Ignorar la primera línea de encabezados
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

// Función para obtener opciones únicas enumeradas
const obtenerOpcionesEnumeradas = (campo, listaFiltrada) => {
    const opcionesUnicas = [...new Set(listaFiltrada.map(item => item[campo]))];
    return opcionesUnicas.map((opcion, index) => `${index + 1} - ${opcion}`).join('\n');
};

// Función para obtener valor de la opción seleccionada dentro de una lista específica
const obtenerValorPorOpcion = (listaFiltrada, numero) => {
    return listaFiltrada[numero - 1]; // Seleccionar valor de la lista filtrada
};

// Función para filtrar los datos según criterios
const filtrarPorCriterios = (supervisor, vendedor, dia) => {
    return data
        .filter(
            item =>
                item.supervisor === supervisor &&
                item.vendedor === vendedor &&
                item.dia === dia
        )
        .map(item => `${item.codigo} - ${item.razonSocial}`)
        .join('\n');
};

// Flujo para preguntas enumeradas
const flujoConsulta = addKeyword(EVENTS.ACTION)
    .addAnswer('¿Qué supervisor deseas buscar?\n\n' + obtenerOpcionesEnumeradas('supervisor', data), 
        { capture: true },
        async (ctx, { flowDynamic, state }) => {
            const seleccionSupervisor = parseInt(ctx.body.trim(), 10);
            const supervisores = [...new Set(data.map(item => item.supervisor))];
            const supervisor = supervisores[seleccionSupervisor - 1];
            
            if (!supervisor) {
                await flowDynamic('Opción no válida. Por favor selecciona una opción correcta.');
                return;
            }

            const vendedoresFiltrados = data.filter(item => item.supervisor === supervisor);
            await state.update({ supervisor, vendedoresFiltrados });

            await flowDynamic('¿Cuál de sus vendedores?\n\n' + obtenerOpcionesEnumeradas('vendedor', vendedoresFiltrados), { capture: true });
        }
    )
    .addAnswer('-----------------------------------------', 
        { capture: true },
        async (ctx, { flowDynamic, state }) => {
            const seleccionVendedor = parseInt(ctx.body.trim(), 10);
            const vendedoresFiltrados = state.getMyState().vendedoresFiltrados;
            const vendedor = obtenerValorPorOpcion([...new Set(vendedoresFiltrados.map(item => item.vendedor))], seleccionVendedor);
            
            if (!vendedor) {
                await flowDynamic('Opción no válida. Por favor selecciona una opción correcta.');
                return;
            }

            const diasFiltrados = vendedoresFiltrados.filter(item => item.vendedor === vendedor);
            await state.update({ vendedor, diasFiltrados });

            await flowDynamic('¿Qué día?\n\n' + obtenerOpcionesEnumeradas('dia', diasFiltrados), { capture: true });
        }
    )
    .addAnswer('------------------', 
        { capture: true },
        async (ctx, { flowDynamic, state }) => {
            const seleccionDia = parseInt(ctx.body.trim(), 10);
            const diasFiltrados = state.getMyState().diasFiltrados;
            const dia = obtenerValorPorOpcion([...new Set(diasFiltrados.map(item => item.dia))], seleccionDia);
            
            if (!dia) {
                await flowDynamic('Opción no válida. Por favor selecciona una opción correcta.');
                return;
            }

            const { supervisor, vendedor } = state.getMyState();
            const resultados = filtrarPorCriterios(supervisor, vendedor, dia).split('\n'); // Dividir en resultados individuales

            if (resultados.length === 0) {
                await flowDynamic('No se encontraron resultados.');
                return;
            }

            // Mensaje para los primeros cinco resultados
            const primerosCinco = resultados.slice(0, 5).join('\n');
            await flowDynamic(`Tienes que visitar estos clientes SÍ o SÍ:\n\n${primerosCinco}`);

            // Mensaje separado para el sexto resultado si existe
            if (resultados.length > 5) {
                const sextoResultado = resultados[5];
                await flowDynamic(`Tene en cuenta que:\n\n${sextoResultado}`);
            }
        }
    );



const leerLineas = (num) => {
  const lineas = csvContent.split('\n');
  const coincidencias = lineas.filter((linea) => linea.startsWith(num + ';'));
  return coincidencias.map((linea) => {
    const valores = linea.split(';');
    const valor1 = valores[1].split(',').filter(v => /\w/.test(v)).join('\n \n- ');
    const valor2 = valores[2].split(',').filter(v => /\w/.test(v)).join('\n \n- ');
    const valor3 = valores[3].split(',').filter(v => /\w/.test(v)).join('\n \n- ');
    return {
      valor1,
      valor2,
      valor3,
    };
  });
};



const constMenu = addKeyword(EVENTS.ACTION)
  .addAnswer(
    Cliente,
    { capture: true },
    async (ctx, { fallBack, flowDynamic, gotoFlow }) => {
      console.log("Mensaje recibido:", ctx.body);
      const numero = ctx.body;
      if (isNaN(numero)) {
        return fallBack('Respuesta no válida, por favor escriba un número');
      }
      const lineas = leerLineas(numero);
      if (lineas.length === 0) {
        return fallBack('Opción no válida.');
      } else {
        for (const linea of lineas) {
          
await flowDynamic(`Cliente 👉🏻  ${linea.valor1}`);

          await flowDynamic(`- ${linea.valor2}`);

await flowDynamic(`Ofrece estos descuentos exclusivos 📋👇🏻:

- ${linea.valor3}`);
  

        }
        return gotoFlow(constPregunta);
      }
    }
  );


const constPregunta = addKeyword(EVENTS.ACTION)
    .addAnswer(
      "¿Desea buscar otro número? 1 ✅ 2 ❎",
      { capture: true },
      async (ctx, { fallBack, flowDynamic, gotoFlow }) => {
        if (ctx.body === "1") {
          return gotoFlow(constMenu);
        } else if (ctx.body === "2") {
          return await flowDynamic("Saliendo. Muchas gracias por utilizar el BOT, hasta la próxima venta 😁");
        } else {
          return fallBack("Respuesta no válida, por favor seleccione una de las opciones.");
        }
      }
    );
  

  constAACC = addKeyword(EVENTS.ACTION)
    .addAnswer(
      "Seleccione una opción:\n\n1. Ver AACC VaFood\n\n2. Ver AACC RN Este\n\n3. Ver AACC RN Oeste\n\n4. Ver AACC Regidor\n\n5. Ver AACC Interior",
      { capture: true },
      async (ctx, { fallBack, flowDynamic, gotoFlow }) => {
        if (!["1", "2", "3", "4", "5"].includes(ctx.body)) {
          return fallBack("Respuesta no válida, por favor seleccione una de las opciones.");
        }
        switch (ctx.body) {
          case "1":
          return  gotoFlow(AACCVaFood);
          case "2":
          return  gotoFlow(AACCRNE);
          case "3":
          return  gotoFlow(AACCRNO);
          case "4":
          return  gotoFlow(AACCRegidor);
          case "5":
          return  gotoFlow(AACCInterior);
         
         }
         }
         );


         const AACCVaFood = addKeyword(EVENTS.ACTION)
         .addAnswer("AACC VaFood", { media: path.join(__dirname, "AACC BOT", "VF.png") });
       
       const AACCRNE = addKeyword(EVENTS.ACTION)
         .addAnswer("AACC Roca Negra Este", { media: path.join(__dirname, "AACC BOT", "RN Con Pena.png") });
       
       const AACCRNO = addKeyword(EVENTS.ACTION)
         .addAnswer("AACC Roca Negra Oeste", { media: path.join(__dirname, "AACC BOT", "RN.png") });
       
       const AACCRegidor = addKeyword(EVENTS.ACTION)
         .addAnswer("AACC Regidor", { media: path.join(__dirname, "AACC BOT", "Regidor.png") });
       
       const AACCInterior = addKeyword(EVENTS.ACTION)
         .addAnswer("AACC Interior", { media: path.join(__dirname, "AACC BOT", "Interior.png") });
       
       const constConsulta = addKeyword(EVENTS.ACTION)
         .addAnswer("Aca la idea es agregar consultas extra");
                      


const menuFlow = addKeyword(EVENTS.WELCOME).addAnswer(
 menu,
 { capture: true },
 async (ctx, { gotoFlow, fallBack, flowDynamic }) => {
 if (!["1", "2", "88", "0"].includes(ctx.body)) {
 return fallBack(
 "Respuesta no válida, por favor selecciona una de las opciones."
 );
 }
 switch (ctx.body) {
 case "1":
 return  gotoFlow(constMenu);
 case "2":
 return  gotoFlow(flujoConsulta);
 case "88":
 return  gotoFlow(constConsulta);
 case "0":
 return await flowDynamic(
 "Saliendo... Puedes volver a acceder a este menú escribiendo 'Menu'"
 );

}
}
);


const main = async () => {
    const adapterDB = new MockAdapter()
    const adapterFlow = createFlow([menuFlow,constMenu,constAACC,constConsulta, constPregunta, AACCVaFood, AACCRNE, AACCRNO, AACCRegidor, AACCInterior, flujoConsulta])
    const adapterProvider = createProvider(BaileysProvider)

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    QRPortalWeb()
}

main()
