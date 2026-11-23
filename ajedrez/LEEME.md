# Between Bishops · Entrenador de partidas importadas (borrador)

[English](README.md)

Pega un PGN de Chess.com, Lichess u otra app. Escribe tu usuario exacto o elige tu color. Se leen la fecha, el resultado y tu Elo, y Stockfish analiza solo tus jugadas. No necesitas cuenta, modelo generativo ni API de pago.

## Flujo

1. **Importar y revisar.** La partida queda en el registro. El motor evalúa cada posición anterior y posterior a tus jugadas, con progreso y cancelación. Se guardan los cálculos completados. Pegar de nuevo una partida incompleta continúa lo pendiente; una ya analizada se reutiliza.
2. **Elegir hasta tres momentos útiles.** Se incluyen errores graves, errores normales y oportunidades omitidas. Las anotaciones `$2`, `$4`, `$9`, etc. del PGN no se aceptan como conclusiones: se usa el cálculo propio. No se seleccionan posiciones que ya estaban muy perdidas. Se priorizan los patrones repetidos y se busca variedad. Se reduce el peso de diferencias numéricas enormes en posiciones que ya estaban ganadas. Si no hay tres errores útiles, se guardan menos. Una misma partida no supera tres puzles ni pierde sus repasos anteriores por volver a importarla.
3. **Acumular el banco.** Cada puzle conserva partida, fecha, posición y jugada de origen, tipo de error, Elo de esa partida, intentos, pistas y fechas de repaso. El Elo de origen no es un rating calibrado del puzle.
4. **Entrenar la racha personal.** La cola prioriza repasos pendientes y debilidades repetidas para el nivel actual. El Elo actual viene de la partida más reciente por fecha PGN: pegar después una partida antigua no lo reemplaza. Si no hay fecha conocida se usa la fecha de importación. Los puzles de partidas de más de 400 puntos sobre la referencia actual quedan fuera de la cola automática, pero se pueden abrir desde el banco.
5. **Repetición espaciada.** Resolver limpiamente un puzle cuando está pendiente lo programa en 1, 3, 7, 14, 30 o 60 días. Fallar o usar pista reinicia su etapa y lo trae de vuelta a los diez minutos. Acertar después no borra el fallo anterior. La práctica anticipada no adelanta la fecha de repaso ni suma puntos de racha.

## Puzles y patrones

Cada puzle parte de una decisión real de tu partida. Se anima la jugada previa del rival si existe. Se resuelven hasta dos jugadas propias para Elo inferior a 600, tres para menos de 1100 y cuatro a partir de ahí, según la variante disponible. El rival responde entre pasos. Se aceptan alternativas que pierdan menos de medio peón frente a la mejor opción. No se penaliza un mate forzado ganador simplemente por tardar un número distinto de jugadas.

Un fallo tiñe las casillas de rojo tenue y devuelve el tablero al paso pendiente. **Reiniciar** no borra los fallos ni las pistas usados en esa sesión. **Pista** destaca en azul solo la pieza recomendada. El PGN original no cambia. El banco muestra las fechas de los intentos y repasos: los doce eventos más recientes en pantalla y el historial completo en el respaldo.

El resumen de patrones usa todos los errores evaluados, no solo los tres elegidos para puzles. Las categorías incluyen seguridad del rey, material expuesto, capturas omitidas, cálculo de respuestas, mates, ataques dobles, decisiones de apertura y jugadas forzantes. Son interpretaciones provisionales basadas en reglas y variantes comprobadas. Una sola partida se señala como evidencia inicial; la repetición entre varias se identifica por separado. No es un diagnóstico ni una estimación Elo calibrados.

El análisis usa unos 850 ms por posición y los puzles unos 1300 ms por posición. Las etiquetas y recuentos pueden cambiar con la profundidad. Se usa imprecisión desde 50 centipeones, error desde 100 y error grave desde 200. Son umbrales prácticos de entrenamiento. Una partida de 26 jugadas propias puede tardar alrededor de un minuto, según el dispositivo.

## Datos y respaldos

El banco se guarda en IndexedDB de este navegador; si no está disponible se usa localStorage con capacidad limitada. No se borran las claves del prototipo anterior. Exporta respaldos JSON para conservar o trasladar partidas, puzles, intentos y repasos. Restaurar integra registros sin duplicar partidas ni IDs de intentos. No hay cuenta ni sincronización en la nube. Borrar los datos del sitio elimina la base local. Límites actuales: 500 partidas, 1500 puzles y respaldos de hasta 100 MB.

La banderita alterna entre inglés y español y guarda la preferencia. El PGN no se envía a una API externa. La app necesita cargar sus archivos y el motor para arrancar.

## Probar y publicar

Ejecuta `node preview-pages.cjs` y abre `http://127.0.0.1:8766/ajedrez/`. Se retiró el enlace de la portada pública y la entrada publicada muestra un aviso de mantenimiento. El rediseño se mantiene en borrador hasta que solicites publicarlo.

## Licencias

Aplicación GPL-3.0. [Stockfish.js 19.0.1](https://github.com/nmrugg/stockfish.js/tree/v19.0.1), GPL-3.0, compilación del paquete npm sin modificar; el enlace contiene la fuente de esa versión. Licencia en `vendor/STOCKFISH-LICENSE`. [chess.js 1.4.0](https://github.com/jhlywa/chess.js/tree/v1.4.0), BSD-2-Clause; licencia en `vendor/CHESS-LICENSE`. Piezas y logo de alfil adaptado del diseño Cburnett de Colin M. L. Burnett, distribuidos aquí bajo GPL-3.0; ver `pieces/CREDITOS.md`.
