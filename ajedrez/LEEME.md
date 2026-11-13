# Between Bishops · BB

Juego de ajedrez y entrenamiento a partir de tus propios errores. Se aloja como HTML, CSS, JavaScript y WebAssembly en GitHub Pages, sin un servidor de la aplicación.

## Partida → revisión → ejercicios

El color se sortea. Cada lado dispone de 10 minutos, sin incremento y sin deshacer. El reloj del rival incluye su cálculo, el análisis oculto de tu última jugada y la espera de la API. Al terminar puedes elegir **Revisar partida** o **Jugar nuevamente**, sin escribir una autoevaluación. La revisión reutiliza los análisis guardados durante la partida y muestra una barra de progreso por etapas hasta el 100%. Si algún cálculo falló, intenta recuperar solo ese análisis. Crea hasta tres puzles desde posiciones anteriores a tus errores. Los puzles no cambian la partida original.

La revisión local cuenta los errores y ofrece una explicación sencilla basada en respuestas legales calculadas: jaques o capturas que aparecían después de tus errores, cuando esa evidencia existe. Señala el primer error detectado y lo incluye entre los ejercicios, junto con hasta dos errores relevantes adicionales. No atribuye motivos tácticos ni carencias personales que el cálculo no permita comprobar.

Cada puzle indica su longitud, de una a cuatro jugadas tuyas según la variante legal disponible. Se muestra primero la jugada previa del rival, animada, y después la pregunta «¿Qué harías ahora?». Si corresponde a tu primera jugada, no se inventa una jugada previa. Una buena jugada conserva una pérdida inferior a 50 centipeones; se aceptan alternativas razonables. El rival responde y continúas hasta completar la secuencia o terminar la posición. La solución completa permanece oculta hasta resolver el puzle. Si fallas, origen y destino se tiñen de rojo tenue durante un instante y el tablero vuelve al paso pendiente. **Reiniciar puzle** vuelve al inicio sin borrar intentos; **Pista** destaca en azul la pieza recomendada, sin señalar el destino. Los intentos con pista también quedan identificados. Cada intento se añade automáticamente al cuaderno como correcto o incorrecto: acertar después no borra el fallo. El historial no entrena ni modifica los modelos de IA externos.

El reloj se mide en el navegador con tiempo monotónico y sigue corriendo al cambiar de pestaña. Si cierras o recargas se pierde la partida; esta versión no guarda partidas activas. Las tablas por triple repetición y 50 movimientos se adjudican automáticamente. No hay pistas ni evaluaciones durante el juego.

Mientras el rival calcula, analiza tu jugada o espera la API, aparece **Pensando…** en una franja neutra y visible sobre el tablero, con puntos animados. El reloj activo usa gris oscuro. Las piezas se desplazan visualmente de origen a destino (también la torre en un enroque). La selección de otra casilla no reinicia una animación en curso y el sistema respeta la preferencia del navegador de reducir movimiento.

## Dos rivales

- **IA generativa (usa tokens)**: un modelo de OpenAI elige entre hasta cinco continuaciones verificadas por Stockfish. Se prioriza desarrollo y centro en la apertura, sin excluir jaques, capturas o mates. La IA no puede introducir jugadas arbitrarias ni ilegales.
- **Sin conexión a GPT (gratis)**: Stockfish juega y realiza la revisión y los ejercicios localmente. Después de la descarga inicial de archivos no necesita una API de pago. El sitio debe poder cargar sus archivos para arrancar; no se incluye una instalación completamente offline.

El índice adaptativo comienza en 350 y se guarda en el navegador: victoria +40, derrota -30, tablas +5, y hasta -20 adicionales por errores graves. Acotado entre 300 y 2.000. Ajusta el margen de pérdida admitido entre alternativas del rival (100/65/35/15 centipeones por tramos). Es una regla inicial, **no un Elo calibrado**. Este rival puede seguir siendo fuerte para principiantes: no se introducen regalos deliberados para garantizar resultados.

Puedes elegir tu Elo de referencia o seleccionar **Estimar mi Elo jugando una partida**. La estimación necesita al menos 8 jugadas propias evaluadas y muestra un rango amplio de práctica según la frecuencia de errores graves y errores. Los tramos se asignan con una regla exploratoria: no se han contrastado con una muestra de jugadores con Elo conocido. No equivalen a una medición de Elo ni garantizan el rendimiento en otra plataforma. Una partida corta o atípica puede no ser representativa; repetir varias partidas ofrece más contexto, pero no convierte la regla en un sistema de clasificación calibrado.

## Conexión y costes

Arriba a la derecha puedes elegir OpenAI, Google Gemini o Anthropic, cargar tu propia clave del proveedor y seleccionar un modelo. La clave queda solo en memoria y se envía directamente a su API oficial. No hay una clave compartida del sitio. Cambiar de proveedor requiere su clave correspondiente.

El catálogo actualizado el 13-11-2026 incluye GPT-6/6.1, Gemini 4 Hydrogen, Argon y Carbon, y Claude 5.5 hasta Fable 5.2. El valor económico predeterminado es GPT-6 Luna. Consulta [MODELOS.md](MODELOS.md) para los IDs, tarifas, fuentes, cambios de precio anunciados y limitaciones de acceso desde navegador.

El límite predeterminado es US$0,02 por partida y se puede cambiar. Antes de una petición se reserva una cota conservadora del texto de entrada y del límite de salida; después se registra el uso informado por la API, sin aplicar descuentos de caché. Si no hay respuesta o uso verificable, se cuenta preventivamente la reserva. No hay reintentos automáticos de pago. El límite es un **freno estimado en este navegador**, no una cuota de facturación del proveedor. Una recarga lo reinicia y no limita otras páginas o aplicaciones que usen tu clave. Puedes aumentar el límite durante la partida o continuar con el rival local.

Los informes y explicaciones ya generados se reutilizan. Una partida en el modo sin conexión a GPT no solicita automáticamente informes generativos aunque tengas una clave cargada; una explicación adicional solo usa la IA si la pides explícitamente.

## Motor y análisis

Stockfish 19 lite single-threaded funciona en un Web Worker. Durante el turno del rival evalúa la posición anterior a tu jugada durante unos 1.100 ms y la posición posterior durante unos 950 ms; esta última búsqueda también proporciona los candidatos del rival. Ambos resultados se guardan y quedan ocultos hasta la revisión. Una jugada tuya que termina la partida también se analiza antes de cerrar la operación. Los puzles usan búsquedas de 1.800 ms antes y después de cada intento; una pista reutiliza su análisis para el siguiente intento. El porcentaje final corresponde a las etapas de recopilación, preparación de puzles y explicación, no a un temporizador ficticio. La explicación generativa puede requerir esperar la API.

Etiquetas orientativas: imprecisión desde 50 centipeones, error desde 100 y error grave desde 200. Dependen de la búsqueda y no sustituyen un análisis profundo. Los valores positivos favorecen a blancas. La IA recibe las variantes calculadas para explicar, pero sus interpretaciones pueden contener errores. La conexión a la API debe probarse con una clave válida y acceso al modelo; las pruebas del proyecto simulan respuestas y no generan cargos.

El cuaderno de errores y el índice quedan en localStorage de este navegador. Los aprendizajes no se sincronizan y desaparecen si borras los datos del sitio. Puedes descargar el PGN de la partida.

## Publicación y licencias

La carpeta completa `ajedrez` se puede copiar al sitio de GitHub Pages. Sus enlaces son relativos, de modo que funciona en `/ajedrez/` sin cambiar la portada. Se requieren navegador moderno con WebAssembly, Web Workers y acceso HTTPS a la API elegida.

El código de la aplicación se distribuye bajo GPL-3.0. [Stockfish.js 19.0.1](https://github.com/nmrugg/stockfish.js/tree/v19.0.1) está bajo GPL-3.0; archivo `vendor/STOCKFISH-LICENSE`. La compilación distribuida proviene del paquete npm stockfish 19.0.1, sin cambios al motor. Su fuente correspondiente está disponible en el repositorio y etiqueta enlazados. [chess.js 1.4.0](https://github.com/jhlywa/chess.js/tree/v1.4.0) está bajo BSD-2-Clause; archivo `vendor/CHESS-LICENSE`. Copias de las licencias incluidas.

El logo de alfil adapta los colores de la pieza del mismo diseño. Las piezas SVG usan el diseño Cburnett de Colin M. L. Burnett, GPL-2.0 o posterior, distribuido aquí bajo GPL-3.0; ver `pieces/CREDITOS.md`.

## Partidas nuevas orientadas a tus debilidades

La revisión guarda un perfil local de patrones aproximados: seguridad del rey, piezas expuestas, capturas y cálculo de respuestas. Al empezar una partida normal desde la posición inicial se selecciona un patrón pendiente. Entre las alternativas de Stockfish que ya pasan el filtro habitual de calidad, el rival generativo recibe el objetivo y señales comprobadas para elegir un plan; el rival local prioriza esas señales con reglas. No se amplía la tolerancia ni se carga una posición anterior. No se garantiza que el patrón llegue a aparecer: depende también de tus jugadas.

Solo se contabilizan oportunidades concretas observadas, como un jaque no terminal, una pieza atacada sin defensor directo o una continuación táctica legal en la variante calculada. Son indicadores exploratorios, no una clasificación táctica exhaustiva. Tras revisar la partida se distinguen las respuestas con pérdida inferior a 50 centipeones de las que superan ese umbral. Dos respuestas buenas al patrón pendiente en una partida nueva, sin nuevos errores del mismo patrón, permiten espaciarlo 1, 3, 7, 14, 30 y 60 días. Un fallo vuelve a priorizarlo después de 10 minutos. Los intervalos son una regla de producto pendiente de calibración. Sin oportunidades suficientes no se acredita mejora.

Cada intento de ejercicio persiste, incluido el incorrecto antes de acertar. Resolver un ejercicio no adelanta el repaso en partida. El perfil y su registro de rendimiento se guardan en este navegador; el cuaderno antiguo se conserva, sin convertir notas libres en diagnósticos inventados. La integración se prueba con respuestas simuladas: falta validar la calidad pedagógica de planes generativos en muchas partidas reales.
