import { iniciarMenu } from "./telas/menu";
import { iniciarSubmenu } from "./telas/submenu";
import { iniciarFormBanco } from "./telas/form-banco";
import { iniciarFormPagador } from "./telas/form-pagador";
import { iniciarFormEmpresa } from "./telas/form-empresa";
import { SUBMENUS, TelaSubmenu } from "./submenus-config";

const tela = (document.body.dataset.tela ?? "menu") as TelaSubmenu | "menu" | "form-banco" | "form-pagador" | "form-empresa";
if (tela === "menu") {
  iniciarMenu();
} else if (tela === "form-banco") {
  iniciarFormBanco();
} else if (tela === "form-pagador") {
  iniciarFormPagador();
} else if (tela === "form-empresa") {
  iniciarFormEmpresa();
} else if (SUBMENUS[tela]) {
  iniciarSubmenu(tela, SUBMENUS[tela]);
} else {
  console.error("[ContasAPagar] tela desconhecida:", tela);
}
