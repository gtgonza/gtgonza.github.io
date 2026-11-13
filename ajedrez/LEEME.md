# Entre jugadas

Juego de ajedrez y entrenamiento a partir de tus propios errores. Se aloja como HTML, CSS, JavaScript y WebAssembly en GitHub Pages, sin un servidor de la aplicación.

## Partida → revisión → ejercicios

El color se sortea. Cada lado dispone de 10 minutos, sin incremento y sin deshacer. El reloj del rival incluye su cálculo y la espera de la API. Al terminar, primero escribes tu autoevaluación. El motor revisa tus jugadas y crea hasta tres ejercicios desde las posiciones anteriores a tus mayores pérdidas de evaluación. Cada intento debe incluir la respuesta que esperabas del rival. Los ejercicios no cambian la partida original.

El reloj se mide en el navegador con tiempo monotónico y sigue corriendo al cambiar de pestaña. Si cierras o recargas se pierde la partida; esta versión no guarda partidas activas. Las tablas por triple repetición y 50 movimientos se adjudican automáticamente. No hay pistas ni evaluaciones durante el juego.

Mientras el rival decide, aparece «Pensando…» junto a su nombre, con puntos animados. Sus piezas se desplazan visualmente de origen a destino (también la torre en un enroque). La selección de otra casilla no reinicia una animación en curso y el sistema respeta la preferencia del navegador de reducir movimiento.

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

Stockfish 19 lite single-threaded funciona en un Web Worker. El motor evalúa las alternativas durante unos 950 ms por turno. La revisión final analiza cada posición durante unos 1.100 ms y los ejercicios durante 1.800 ms. Una partida larga puede tardar uno o dos minutos en revisar; la pantalla muestra el progreso.

Etiquetas orientativas: imprecisión desde 50 centipeones, error desde 100 y error grave desde 200. Dependen de la búsqueda y no sustituyen un análisis profundo. Los valores positivos favorecen a blancas. La IA recibe las variantes calculadas para explicar, pero sus interpretaciones pueden contener errores. La conexión a la API debe probarse con una clave válida y acceso al modelo; las pruebas del proyecto simulan respuestas y no generan cargos.

El cuaderno de errores y el índice quedan en localStorage de este navegador. Los aprendizajes no se sincronizan y desaparecen si borras los datos del sitio. Puedes descargar el PGN de la partida.

## Publicación y licencias

La carpeta completa `ajedrez` se puede copiar al sitio de GitHub Pages. Sus enlaces son relativos, de modo que funciona en `/ajedrez/` sin cambiar la portada. Se requieren navegador moderno con WebAssembly, Web Workers y acceso HTTPS a la API elegida.

El código de la aplicación se distribuye bajo GPL-3.0. [Stockfish.js 19.0.1](https://github.com/nmrugg/stockfish.js/tree/v19.0.1) está bajo GPL-3.0; archivo `vendor/STOCKFISH-LICENSE`. La compilación distribuida proviene del paquete npm stockfish 19.0.1, sin cambios al motor. Su fuente correspondiente está disponible en el repositorio y etiqueta enlazados. [chess.js 1.4.0](https://github.com/jhlywa/chess.js/tree/v1.4.0) está bajo BSD-2-Clause; archivo `vendor/CHESS-LICENSE`. Copias de las licencias incluidas.

Las piezas SVG usan el diseño Cburnett de Colin M. L. Burnett, GPL-2.0 o posterior, distribuido aquí bajo GPL-3.0; ver `pieces/CREDITOS.md`.
