// Contenido del Manual de uso (18/10). Cada bloque = una captura con marcas rojas
// numeradas + los pasos con el mismo número. Las capturas viven en
// public/manual/ y se regeneran con `video/generador/manual.mjs` (datos ficticios).
// Textos cortos, un paso por renglón, sin palabras técnicas.

export interface ManualBlock {
  img: string;
  alt: string;
  steps: string[]; // el índice + 1 es el número de la marca en la imagen
  tip?: string;
}
export interface ManualTopic {
  key: string;
  title: string;
  summary: string;
  blocks: ManualBlock[];
}

export const MANUAL: ManualTopic[] = [
  {
    key: 'entrar',
    title: '1. Entrar a la app y conocer la pantalla',
    summary: 'Cómo ingresar y qué es cada parte de la pantalla principal.',
    blocks: [
      {
        img: '/manual/01-login.jpg', alt: 'Pantalla para iniciar sesión',
        steps: ['Escribí tu email.', 'Escribí tu contraseña.', 'Tocá «Ingresar».'],
        tip: 'Si te olvidaste la contraseña, tocá «Olvidé mi contraseña» y te llega un mail para cambiarla.',
      },
      {
        img: '/manual/01-pantalla.jpg', alt: 'Pantalla principal (Dashboard)',
        steps: [
          'El menú: desde acá vas a cada sección (Carga rápida, Trabajos, Kanban, Presupuestos…).',
          'El buscador: escribí un cliente o un trabajo para encontrarlo rápido.',
          'La campana: tus avisos (te asignaron un trabajo, te mencionaron, etc.). El número rojo dice cuántos no leíste.',
          'Las tarjetas: cuántos trabajos hay en cada etapa. Tocá una para ver solo esos trabajos.',
          '«A mí» muestra tus trabajos, «Por mí» los que cargaste vos y «Todos» los de todo el estudio.',
        ],
      },
    ],
  },
  {
    key: 'cargar',
    title: '2. Cargar un trabajo nuevo',
    summary: 'Todo se carga desde «Carga rápida», en una sola pantalla.',
    blocks: [
      {
        img: '/manual/02-carga-datos.jpg', alt: 'Carga rápida: datos del trabajo',
        steps: [
          'El cliente. Si ya existe, aparece mientras escribís: elegilo de la lista.',
          'Un nombre corto para el trabajo.',
          'El tipo de trabajo (máquina o proceso).',
          'La fecha de entrega. Podés tocar «Mañana», «3 días», etc.',
          'Qué hay que hacer. Acá también podés pegar el mail o el chat de WhatsApp del cliente.',
          'La prioridad. Se sugiere sola según la fecha, pero la podés cambiar.',
        ],
      },
      {
        img: '/manual/02-carga-productos.jpg', alt: 'Carga rápida: productos y medidas',
        steps: [
          'El nombre de la pieza (por ejemplo «Corpóreo 3D»).',
          'El material: tocá uno o varios.',
          'Cantidad, ancho y alto. Con la tecla Enter pasás al casillero siguiente.',
          'Si hay otra medida, tocá «Agregar medida».',
        ],
        tip: 'Si el trabajo tiene varias piezas distintas, tocá «Agregar producto» para sumar otra.',
      },
      {
        img: '/manual/02-carga-asignar.jpg', alt: 'Carga rápida: responsable y crear',
        steps: ['Elegí quién se encarga del trabajo (el responsable).', 'Tocá «Crear trabajo». ¡Listo!'],
        tip: 'Si falta algún dato no pasa nada: el trabajo se crea igual y lo completás después desde la ficha.',
      },
    ],
  },
  {
    key: 'encontrar',
    title: '3. Encontrar un trabajo',
    summary: 'Con el buscador de arriba o desde la lista de Trabajos.',
    blocks: [
      {
        img: '/manual/03-buscador.jpg', alt: 'Buscador',
        steps: ['Escribí el cliente, el nombre del trabajo o el número, y tocá el resultado.'],
      },
      {
        img: '/manual/03-trabajos.jpg', alt: 'Lista de trabajos',
        steps: ['Buscador de la lista.', 'Filtros: prioridad, estado, cliente o responsable.', 'Tocá cualquier trabajo para abrir su ficha.'],
      },
    ],
  },
  {
    key: 'ficha',
    title: '4. La ficha de un trabajo',
    summary: 'Todo lo de un trabajo en un solo lugar: datos, detalle, producción e historial.',
    blocks: [
      {
        img: '/manual/04-ficha-cabecera.jpg', alt: 'Cabecera de la ficha',
        steps: [
          'El lápiz: corregí el cliente o el nombre del trabajo.',
          'La prioridad.',
          'El estado del trabajo (en qué etapa está).',
          'Las pestañas: General, Detalle, Producción, Historial…',
        ],
      },
      {
        img: '/manual/04-ficha-general.jpg', alt: 'Pestaña General',
        steps: ['Para pasarle el trabajo a otra persona, elegila en «Responsable interno». Queda anotado quién lo cambió.', 'La fecha de entrega se puede cambiar acá.'],
      },
      {
        img: '/manual/04-ficha-detalle.jpg', alt: 'Pestaña Detalle',
        steps: ['Tocá «Editar detalle del trabajo» para cambiar piezas, materiales o medidas.'],
      },
    ],
  },
  {
    key: 'estado',
    title: '5. Cambiar el estado de un trabajo',
    summary: 'Desde el desplegable de estado o arrastrando la tarjeta en el Kanban.',
    blocks: [
      {
        img: '/manual/05-kanban.jpg', alt: 'Kanban',
        steps: [
          'Cada tarjeta es un trabajo. Mantenela apretada y arrastrala…',
          '…hasta la columna de la etapa nueva y soltala.',
        ],
        tip: 'También podés cambiar el estado con el desplegable de color en el Dashboard, en Trabajos o en la ficha.',
      },
    ],
  },
  {
    key: 'avisar',
    title: '6. Avisarle a alguien',
    summary: 'Comentarios con @, la campana y los avisos de cambio de estado.',
    blocks: [
      {
        img: '/manual/06-mencion.jpg', alt: 'Comentario con mención',
        steps: ['Escribí el comentario en la ficha. Para avisarle a alguien escribí @ y su nombre.', 'Elegí a la persona de la lista y mandá el comentario.'],
        tip: 'A esa persona le llega un aviso a la campana.',
      },
      {
        img: '/manual/06-campana.jpg', alt: 'Campana de avisos',
        steps: ['Tocá la campana para ver tus avisos. Tocá uno para ir a ese trabajo.'],
      },
      {
        img: '/manual/06-aviso-estado.jpg', alt: 'Aviso de cambio de estado',
        steps: ['Cuando otra persona cambia el estado de un trabajo, aparece este cartel abajo a la derecha. Tocalo para abrir la ficha, o la X para cerrarlo.'],
        tip: 'Si alguien cambió algo mientras tenías la compu apagada, el aviso te aparece cuando volvés a abrir la app.',
      },
    ],
  },
  {
    key: 'bloquear',
    title: '7. Bloquear o cancelar un trabajo',
    summary: 'Cuando un trabajo está frenado o el cliente lo canceló.',
    blocks: [
      {
        img: '/manual/07-bloquear.jpg', alt: 'Bloquear o cancelar',
        steps: [
          '«Bloquear trabajo»: cuando está frenado (falta un archivo, una aprobación, material…). Elegís el motivo y queda marcado en rojo.',
          '«Cancelar trabajo»: cuando el cliente ya no lo quiere. Pide confirmación.',
        ],
      },
    ],
  },
  {
    key: 'cliente',
    title: '8. Muestra al cliente y aviso de «listo»',
    summary: 'Seguir una muestra y avisarle al cliente cuando el trabajo está terminado.',
    blocks: [
      {
        img: '/manual/08-muestra.jpg', alt: 'Muestra al cliente',
        steps: ['Si el cliente pidió una muestra, marcá en qué paso está (en producción, enviada, aprobada).'],
      },
      {
        img: '/manual/08-mensaje-cliente.jpg', alt: 'Mensaje para el cliente',
        steps: [
          'Cuando el trabajo está «Listo para entregar», tocá «Mensaje para el cliente» y después «Copiar mensaje» para pegarlo donde quieras…',
          '…o «Abrir en WhatsApp» para mandárselo directo.',
        ],
      },
    ],
  },
  {
    key: 'produccion',
    title: '9. Planilla de producción y contact sheet',
    summary: 'La hoja para imprimir y completar a mano en el taller.',
    blocks: [
      {
        img: '/manual/09-produccion.jpg', alt: 'Pestaña Producción',
        steps: [
          'Subí la imagen del contact sheet: copiala y pegala con Ctrl+V, o arrastrala acá.',
          'Marcá qué procesos lleva cada pieza (impresión, láser, montado…).',
          'Tocá «Exportar PDF de producción» para imprimir la planilla.',
        ],
      },
    ],
  },
  {
    key: 'presupuestos',
    title: '10. Presupuestos',
    summary: 'Cargar un presupuesto, ponerle precio, exportarlo y confirmarlo.',
    blocks: [
      {
        img: '/manual/10-presupuestos.jpg', alt: 'Lista de presupuestos',
        steps: ['Tocá «Nuevo presupuesto» y cargá cliente, nombre y piezas.'],
      },
      {
        img: '/manual/10-presupuesto-ficha.jpg', alt: 'Ficha de un presupuesto',
        steps: [
          'Cargá el importe, elegí si incluye IVA y tocá «Guardar valor».',
          '«Exportar presupuesto» arma la hoja para mandarle al cliente.',
          'Cuando el cliente acepta, tocá «Confirmar presupuesto»: se crea el trabajo solo.',
        ],
      },
    ],
  },
  {
    key: 'celular',
    title: '11. Usarla desde el celular',
    summary: 'La misma app, desde el navegador del teléfono.',
    blocks: [
      {
        img: '/manual/11-celular.jpg', alt: 'App en el celular',
        steps: ['Tocá las tres rayitas para abrir el menú.'],
        tip: 'En el celular los trabajos se ven como tarjetas, una abajo de la otra. En el Kanban deslizá el dedo de costado para ver las otras columnas.',
      },
    ],
  },
];
