# Catálogo de modelos · verificado el 13-11-2026

Modelos de texto con ID de API confirmado en documentación oficial. No se incluyen modelos de imagen, audio, acceso restringido como Claude Mythos, ni versiones anteriores en el menú principal. La presencia en el catálogo no garantiza acceso desde una cuenta concreta.

Tarifas estándar de texto en USD por millón de tokens, sin herramientas, enrutamiento global y sin descuentos de caché, Batch o Flex:

| Proveedor | Modelo | ID API | Entrada | Salida |
|---|---|---|---:|---:|
| OpenAI | GPT-6 Luna | `gpt-6-luna` | 0,10 | 0,50 |
| OpenAI | GPT-6.1 Terra | `gpt-6.1-terra` | 1,00 | 5,00 |
| OpenAI | GPT-6.1 Sol | `gpt-6.1-sol` | 2,00 | 10,00 |
| OpenAI | GPT-6 Astra | `gpt-6-astra` | 10,00 | 50,00 |
| Google | Gemini 4 Hydrogen | `gemini-4-hydrogen` | 1,50 | 7,50 |
| Google | Gemini 4 Argon | `gemini-4-argon` | 2,00* | 10,00* |
| Google | Gemini 4 Carbon | `gemini-4-carbon` | 2,00* | 10,00* |
| Anthropic | Claude Haiku 5.5 | `claude-haiku-5-5` | 0,10** | 0,50** |
| Anthropic | Claude Sonnet 5.5 | `claude-sonnet-5-5` | 2,00 | 10,00 |
| Anthropic | Claude Opus 5.5 | `claude-opus-5-5` | 4,00 | 20,00 |
| Anthropic | Claude Fable 5.2 | `claude-fable-5-2` | 8,00 | 40,00 |

*Argon y Carbon pasan a US$4/20 a partir del 01-12-2026. El catálogo aplica automáticamente ese cambio de tarifa según la fecha; no selecciona la tarifa promocional una vez vencida.*

**Haiku aplica US$0,10/0,50 hasta 100.000 tokens de entrada y US$0,50/2,50 por encima. Esta app limita el texto de cada petición a 50.000 bytes más un margen de protocolo, por debajo del umbral. Hydrogen tiene nivel gratuito con cuotas y condiciones propias; el control de gasto usa la tarifa de pago como referencia conservadora.**

## Fuentes oficiales

- OpenAI: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [GPT-6.1 Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra).
- Google: [catálogo](https://aistudio.google.com/docs/models), [precios](https://aistudio.google.com/docs/pricing), [Hydrogen](https://aistudio.google.com/docs/whats-new-gemini-4-hydrogen), [Argon](https://aistudio.google.com/docs/models/gemini-4-argon).
- Anthropic: [catálogo y versiones](https://platform.claude.com/docs/en/models/overview), [precios](https://platform.claude.com/docs/en/about-claude/pricing), [Fable 5.2](https://platform.claude.com/docs/en/models/fable-5-2/overview).

## Conexiones y límites prácticos

OpenAI usa Responses; Google, Interactions; Anthropic, Messages. Cada conexión usa la clave personal del proveedor correspondiente. Cambiar de proveedor elimina la clave anterior de la conexión activa. No se introducen secretos en el código, el repositorio ni localStorage. Las llamadas van directamente al dominio oficial correspondiente.

La opción económica predeterminada es GPT-6 Luna, con razonamiento desactivado. Sol y Astra utilizan esfuerzo bajo; Gemini, nivel bajo; Claude, pensamiento adaptativo y esfuerzo bajo. Para esos modelos se reservan al menos 2.048 tokens por respuesta; la reserva de Gemini añade margen para pensamiento. No se hacen reintentos de pago automáticos. Un presupuesto bajo puede bloquear Fable, Astra u otros modelos antes de la primera petición. No se aumenta el presupuesto sin que el usuario lo cambie.

El coste contabilizado incluye el pensamiento informado por el proveedor: OpenAI lo incluye en output_tokens; Google separa total_output_tokens y total_thought_tokens; Claude incluye su pensamiento en output_tokens. Si falta uso verificable, se conserva la reserva preventiva. Las tarifas personalizadas siguen siendo responsabilidad de quien introduce el modelo.

Las organizaciones de Anthropic con ZDR, Compliance API u otras restricciones pueden rechazar llamadas desde navegador. La app utiliza el encabezado oficial para acceso directo desde navegador, sin evitar las políticas de la organización. En esos casos hace falta un backend autorizado; GitHub Pages por sí solo no lo resuelve. [Autenticación oficial y CORS](https://platform.claude.com/docs/en/manage-claude/authentication).

Los contratos HTTP y el control de presupuesto se prueban con respuestas simuladas. No se ha comprobado acceso, CORS, facturación ni calidad de juego con claves reales de los tres proveedores. Los modelos de razonamiento pueden alcanzar el límite de salida antes de responder; la app lo indica sin reintentar automáticamente.
