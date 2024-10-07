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

          await flowDynamic(`Tu Situación es 📋👇🏻:

- ${linea.valor2}`);

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
 if (!["1", "2", "30", "0"].includes(ctx.body)) {
 return fallBack(
 "Respuesta no válida, por favor selecciona una de las opciones."
 );
 }
 switch (ctx.body) {
 case "1":
 return  gotoFlow(constMenu);
 case "2":
 return  gotoFlow(constAACC);
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
    const adapterFlow = createFlow([menuFlow,constMenu,constAACC,constConsulta, constPregunta, AACCVaFood, AACCRNE, AACCRNO, AACCRegidor, AACCInterior])
    const adapterProvider = createProvider(BaileysProvider)

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    QRPortalWeb()
}

main()
