import { Tela } from "./navegacao";

export type TelaSubmenu = Exclude<Tela, "menu" | "form-banco">;

export interface BotaoSubmenu {
  chave: string;
  rotulo: string;
  cor: string;
  selo: string;
  seloTexto: string;
  icone: string;
  traco?: string;
  destino?: Tela;
}

export interface ConfigSubmenu {
  titulo: string;
  botoes: BotaoSubmenu[];
}

const SVG = {
  prancheta:
    '<rect height="16" rx="1" width="13" x="3" y="4"></rect><path d="M7 4V2a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-2"></path><line x1="6" x2="13" y1="9" y2="9"></line><line x1="6" x2="13" y1="13" y2="13"></line><line x1="6" x2="10" y1="17" y2="17"></line>',
  recorrente:
    '<path d="M21 12a9 9 0 0 0-15.5-6.36L3 8"></path><polyline points="3 3 3 8 8 8"></polyline><path d="M3 12a9 9 0 0 0 15.5 6.36L21 16"></path><polyline points="21 21 21 16 16 16"></polyline>',
  pago: '<rect height="14" rx="1" width="20" x="2" y="5"></rect><line x1="2" x2="22" y1="10" y2="10"></line><path d="M6 15l2 2 4-4"></path>',
  envelope: '<rect height="14" rx="1" width="20" x="2" y="5"></rect><path d="M2 7l10 6 10-6"></path>',
  editar:
    '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path>',
  pasta: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"></path>',
  quadradoMais:
    '<rect height="18" rx="1" width="18" x="3" y="3"></rect><line x1="12" x2="12" y1="8" y2="16"></line><line x1="8" x2="16" y1="12" y2="12"></line>',
  circuloMais:
    '<circle cx="12" cy="12" r="9"></circle><line x1="12" x2="12" y1="8" y2="16"></line><line x1="8" x2="16" y1="12" y2="12"></line>',
  empresa:
    '<path d="M4 21V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16"></path><path d="M16 9h3a1 1 0 0 1 1 1v11"></path><line x1="3" x2="21" y1="21" y2="21"></line><path d="M8 8h2"></path><path d="M8 12h2"></path><path d="M8 16h2"></path>',
  pagador:
    '<circle cx="10" cy="8" r="4"></circle><path d="M3 20a7 7 0 0 1 14 0"></path><line x1="19" x2="19" y1="8" y2="14"></line><line x1="16" x2="22" y1="11" y2="11"></line>',
  banco:
    '<path d="M3 10h18"></path><path d="M5 10v8"></path><path d="M9 10v8"></path><path d="M15 10v8"></path><path d="M19 10v8"></path><line x1="3" x2="21" y1="21" y2="21"></line><path d="M12 3l9 5H3z"></path>',
};

export const SUBMENUS: Record<TelaSubmenu, ConfigSubmenu> = {
  controle: {
    titulo: "Controle",
    botoes: [
      {
        chave: "todas-as-contas",
        rotulo: "TODAS AS CONTAS",
        cor: "bg-[#2563eb]",
        selo: "receipt_long",
        seloTexto: "text-white",
        icone: SVG.prancheta,
      },
      {
        chave: "contas-recorrentes",
        rotulo: "CONTAS RECORRENTES",
        cor: "bg-[#38bdf8]",
        selo: "autorenew",
        seloTexto: "text-[#1c1b1b]",
        icone: SVG.recorrente,
        traco: "3",
        destino: "recorrentes",
      },
      {
        chave: "pagos",
        rotulo: "PAGOS",
        cor: "bg-[#10b981]",
        selo: "check",
        seloTexto: "text-[#1c1b1b]",
        icone: SVG.pago,
      },
    ],
  },
  cadastros: {
    titulo: "Cadastros",
    botoes: [
      {
        chave: "todos-os-cadastros",
        rotulo: "TODOS OS CADASTROS",
        cor: "bg-[#ea580c]",
        selo: "folder",
        seloTexto: "text-[#1c1b1b]",
        icone: SVG.pasta,
      },
      {
        chave: "novo-cadastro",
        rotulo: "NOVO CADASTRO",
        cor: "bg-[#f59e0b]",
        selo: "add_circle",
        seloTexto: "text-[#1c1b1b]",
        icone: SVG.quadradoMais,
        destino: "novo-cadastro",
      },
    ],
  },
  mensagens: {
    titulo: "Mensagens",
    botoes: [
      {
        chave: "todas-as-mensagens",
        rotulo: "TODAS AS MENSAGENS",
        cor: "bg-[#ec4899]",
        selo: "mail",
        seloTexto: "text-white",
        icone: SVG.envelope,
      },
      {
        chave: "criar-nova-mensagem",
        rotulo: "CRIAR NOVA MENSAGEM",
        cor: "bg-[#f43f5e]",
        selo: "edit_note",
        seloTexto: "text-white",
        icone: SVG.editar,
      },
    ],
  },
  recorrentes: {
    titulo: "Contas Recorrentes",
    botoes: [
      {
        chave: "todas-contas-recorrentes",
        rotulo: "TODAS CONTAS RECORRENTES",
        cor: "bg-[#38bdf8]",
        selo: "autorenew",
        seloTexto: "text-[#1c1b1b]",
        icone: SVG.recorrente,
        traco: "3",
      },
      {
        chave: "cadastrar-nova-recorrente",
        rotulo: "CADASTRAR NOVA CONTA RECORRENTE",
        cor: "bg-[#7c3aed]",
        selo: "add_circle",
        seloTexto: "text-white",
        icone: SVG.circuloMais,
      },
    ],
  },
  "novo-cadastro": {
    titulo: "Novo Cadastro",
    botoes: [
      {
        chave: "empresa",
        rotulo: "CADASTRAR NOVA EMPRESA",
        cor: "bg-[#f59e0b]",
        selo: "apartment",
        seloTexto: "text-[#1c1b1b]",
        icone: SVG.empresa,
      },
      {
        chave: "pagador",
        rotulo: "CADASTRAR NOVO PAGADOR",
        cor: "bg-[#dc2626]",
        selo: "person_add",
        seloTexto: "text-white",
        icone: SVG.pagador,
      },
      {
        chave: "banco",
        rotulo: "CADASTRAR NOVO BANCO",
        cor: "bg-[#16a34a]",
        selo: "account_balance",
        seloTexto: "text-white",
        icone: SVG.banco,
        destino: "form-banco",
      },
    ],
  },
};
