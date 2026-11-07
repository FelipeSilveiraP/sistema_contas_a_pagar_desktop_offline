import { iniciarMenu } from "./telas/menu";
import { iniciarSubmenu } from "./telas/submenu";
import { iniciarFormBanco } from "./telas/form-banco";
import { SUBMENUS, TelaSubmenu } from "./submenus-config";

const tela = (document.body.dataset.tela ?? "menu") as TelaSubmenu | "menu" | "form-banco";
if (tela === "menu") {
  iniciarMenu();
} else if (tela === "form-banco") {
  iniciarFormBanco();
} else if (SUBMENUS[tela]) {
  iniciarSubmenu(tela, SUBMENUS[tela]);
} else {
  console.error("[ContasAPagar] tela desconhecida:", tela);
}
